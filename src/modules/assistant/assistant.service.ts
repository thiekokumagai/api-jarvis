import { Injectable, Logger } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { N8nService } from '../n8n/n8n.service';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly n8nService: N8nService,
  ) {}

  async processMessage(userId: string, messageText: string, conversationId?: string) {
    // 1. Get or create conversation
    const conversation = await this.conversationsService.getOrCreateActiveConversation(userId, conversationId);

    // 2. Persist user message
    await this.conversationsService.addMessage(conversation.id, 'user', messageText);

    // 3. Command intent recognition & tool dispatching (Mock AI engine stage)
    const textLower = messageText.toLowerCase();
    let replyText = '';
    const executedTools: Array<{ tool: string; result: any }> = [];

    if (textLower.includes('agende') || textLower.includes('agendar') || textLower.includes('marcar')) {
      // Intent: calendar.create_event
      const result = await this.toolRegistryService.executeTool(userId, 'calendar.create_event', {
        title: messageText,
        start: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      executedTools.push({ tool: 'calendar.create_event', result });
      replyText = `Compreendido, senhor. ${result.message || 'Seu compromisso foi agendado com sucesso no Google Calendar.'}`;
    } else if (textLower.includes('compromisso') || textLower.includes('agenda') || textLower.includes('hoje')) {
      // Intent: calendar.list_events
      const result = await this.toolRegistryService.executeTool(userId, 'calendar.list_events', {
        date: new Date().toISOString().split('T')[0],
      });
      executedTools.push({ tool: 'calendar.list_events', result });

      const eventsList = (result.events || [])
        .map((e: any) => `• ${e.title} às ${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
        .join('\n');

      replyText = `Senhor, aqui estão os seus compromissos para hoje:\n${eventsList}`;
    } else if (textLower.includes('contato') || textLower.includes('procure') || textLower.includes('busca')) {
      // Intent: contacts.search
      const match = messageText.match(/(?:contato|procure|busca)(?:\s+do|\s+da|\s+de)?\s+([A-Za-zÀ-ÿ]+)/i);
      const queryName = match ? match[1] : 'Carlos';

      const result = await this.toolRegistryService.executeTool(userId, 'contacts.search', {
        query: queryName,
      });
      executedTools.push({ tool: 'contacts.search', result });

      const firstContact = result.contacts?.[0];
      if (firstContact) {
        replyText = `Encontrei o contato de ${firstContact.name}: Telefone ${firstContact.phone}, E-mail ${firstContact.email}.`;
      } else {
        replyText = `Não foi possível localizar o contato pesquisado na sua agenda, senhor.`;
      }
    } else if (textLower.includes('whatsapp') || textLower.includes('mande') || textLower.includes('enviar')) {
      // Intent: whatsapp.send_message
      const recipientMatch = messageText.match(/(?:para|com|ao)\s+([A-Za-zÀ-ÿ]+)/i);
      const recipient = recipientMatch ? recipientMatch[1] : 'Carlos';

      const msgMatch = messageText.match(/(?:dizendo|mensagem|que)\s+(.+)/i);
      const bodyMsg = msgMatch ? msgMatch[1] : 'Olá, entraria em contato em breve.';

      const result = await this.toolRegistryService.executeTool(userId, 'whatsapp.send_message', {
        recipient,
        message: bodyMsg,
      });
      executedTools.push({ tool: 'whatsapp.send_message', result });

      replyText = `Mensagem enviada com sucesso via WhatsApp para ${recipient}: "${bodyMsg}".`;
    } else {
      // Default JARVIS assistant response
      replyText = `Compreendido, senhor. Sistemas operacionais. Como posso auxiliá-lo com suas tarefas e agenda hoje?`;
    }

    // Trigger n8n async webhook if available
    await this.n8nService.executeWebhook({
      userId,
      action: 'ASSISTANT_MESSAGE_PROCESSED',
      payload: {
        message: messageText,
        reply: replyText,
        executedTools,
      },
    });

    // 4. Save assistant response
    await this.conversationsService.addMessage(conversation.id, 'assistant', replyText);

    return {
      conversationId: conversation.id,
      userMessage: messageText,
      assistantResponse: replyText,
      executedTools,
    };
  }
}
