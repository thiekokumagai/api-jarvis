import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface N8nWebhookParams {
  userId: string;
  action: string;
  payload: Record<string, any>;
}

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(private readonly configService: ConfigService) {}

  async executeWebhook(params: N8nWebhookParams) {
    const webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');

    if (!webhookUrl) {
      this.logger.warn('N8N_WEBHOOK_URL não está configurado. Webhook ignorado.');
      return {
        executed: false,
        reason: 'N8N_WEBHOOK_URL_NOT_CONFIGURED',
      };
    }

    try {
      this.logger.log(`Disparando webhook n8n para a ação: ${params.action}`);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      return {
        executed: true,
        status: response.status,
        data,
      };
    } catch (error) {
      this.logger.error(`Erro ao chamar webhook n8n: ${error.message}`);
      return {
        executed: false,
        error: error.message,
      };
    }
  }
}
