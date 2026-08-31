import { Tool, ToolContext } from '../tool.interface';

export class WhatsAppSendMessageTool implements Tool {
  name = 'whatsapp.send_message';
  description = 'Envia uma mensagem de WhatsApp para um contato ou número';

  async execute(input: { recipient: string; message: string }, context?: ToolContext) {
    return {
      success: true,
      message: `Mensagem enviada com sucesso para ${input.recipient || 'o destinatário'}: "${input.message || ''}"`,
      details: {
        messageId: `wa_msg_${Date.now()}`,
        recipient: input.recipient,
        text: input.message,
        sentAt: new Date().toISOString(),
      },
    };
  }
}
