import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as webpush from 'web-push';

export interface CreateReminderDto {
  title: string;
  message?: string;
  remindAt: string | Date;
  channel?: string;
}

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@jarvis.app';
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(vapidSubject, publicKey, privateKey);
      this.logger.log('VAPID WebPush configurado com sucesso.');
    } else {
      this.logger.warn('Chaves VAPID não encontradas no .env. Notificações Push funcionarão em modo local/simulado.');
    }
  }

  async createReminder(userId: string, dto: CreateReminderDto) {
    const remindAtDate = new Date(dto.remindAt);

    const reminder = await this.prisma.reminder.create({
      data: {
        userId,
        title: dto.title,
        message: dto.message || null,
        remindAt: remindAtDate,
        channel: dto.channel || 'PUSH',
        status: 'PENDING',
      },
    });

    this.logger.log(`Lembrete criado [ID: ${reminder.id}] para o usuário ${userId} às ${remindAtDate.toISOString()}`);
    return reminder;
  }

  async getUserReminders(userId: string) {
    return this.prisma.reminder.findMany({
      where: { userId },
      orderBy: { remindAt: 'asc' },
    });
  }

  async cancelReminder(userId: string, reminderId: string) {
    return this.prisma.reminder.updateMany({
      where: { id: reminderId, userId },
      data: { status: 'CANCELLED' },
    });
  }

  async savePushSubscription(userId: string, subscription: any) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return { success: false, message: 'Dados de subscrição inválidos' };
    }

    const { endpoint, keys } = subscription;
    const p256dh = keys.p256dh;
    const auth = keys.auth;

    // Remove registros antigos com a mesma endpoint para o usuário
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });

    const subRecord = await this.prisma.pushSubscription.create({
      data: {
        userId,
        endpoint,
        p256dh,
        auth,
      },
    });

    this.logger.log(`Subscrição Web Push registrada para o usuário ${userId}`);
    return { success: true, subscription: subRecord };
  }

  @Cron('*/1 * * * *')
  async processDueReminders() {
    const now = new Date();

    const dueReminders = await this.prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        remindAt: {
          lte: now,
        },
      },
      include: {
        user: {
          include: {
            pushSubscriptions: true,
          },
        },
      },
    });

    if (dueReminders.length === 0) return;

    this.logger.log(`Processando ${dueReminders.length} lembrete(s) vencido(s)...`);

    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    for (const reminder of dueReminders) {
      const payload = JSON.stringify({
        title: `⏰ Lembrete: ${reminder.title}`,
        body: reminder.message || reminder.title,
        data: {
          reminderId: reminder.id,
          url: '/app',
          icon: '/cyber_llama_avatar.png',
        },
      });

      const subscriptions = reminder.user.pushSubscriptions || [];

      if (subscriptions.length > 0 && publicKey && privateKey) {
        for (const sub of subscriptions) {
          try {
            const pushConfig = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            };
            await webpush.sendNotification(pushConfig, payload);
            this.logger.log(`Notificação Push enviada para usuário ${reminder.userId}`);
          } catch (err: any) {
            this.logger.warn(`Erro ao enviar WebPush para endpoint [${sub.endpoint}]: ${err?.message}`);
            // Se subscrição expirou (404/410), limpa do banco
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      } else {
        this.logger.log(`[Simulação Push] Disparado alerta para Lembrete: "${reminder.title}" (Usuário: ${reminder.userId})`);
      }

      // Atualiza status do lembrete para SENT
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'SENT' },
      });
    }
  }
}
