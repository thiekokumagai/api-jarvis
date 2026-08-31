import { Tool, ToolContext } from './tool.interface';
import { RemindersService } from '../reminders/reminders.service';

export class ReminderCreateTool implements Tool {
  name = 'reminder.create';
  description = 'Cria um novo lembrete agendado para o usuário';

  constructor(private readonly remindersService: RemindersService) {}

  async execute(input: Record<string, any>, context?: ToolContext): Promise<any> {
    if (!context?.userId) {
      throw new Error('UserId obrigatório no contexto da tool');
    }
    const reminder = await this.remindersService.createReminder(context.userId, {
      title: input.title,
      message: input.message || input.title,
      remindAt: input.remindAt,
      channel: input.channel || 'PUSH',
    });
    return {
      success: true,
      message: `Lembrete agendado com sucesso para ${new Date(reminder.remindAt).toLocaleString('pt-BR')}: "${reminder.title}"`,
      reminder,
    };
  }
}

export class ReminderListTool implements Tool {
  name = 'reminder.list';
  description = 'Lista os lembretes do usuário';

  constructor(private readonly remindersService: RemindersService) {}

  async execute(input: Record<string, any>, context?: ToolContext): Promise<any> {
    if (!context?.userId) {
      throw new Error('UserId obrigatório no contexto da tool');
    }
    const reminders = await this.remindersService.getUserReminders(context.userId);
    return {
      success: true,
      reminders,
    };
  }
}

export class ReminderDeleteTool implements Tool {
  name = 'reminder.delete';
  description = 'Cancela ou remove um lembrete existente';

  constructor(private readonly remindersService: RemindersService) {}

  async execute(input: Record<string, any>, context?: ToolContext): Promise<any> {
    if (!context?.userId) {
      throw new Error('UserId obrigatório no contexto da tool');
    }
    await this.remindersService.cancelReminder(context.userId, input.id);
    return {
      success: true,
      message: 'Lembrete cancelado com sucesso.',
    };
  }
}
