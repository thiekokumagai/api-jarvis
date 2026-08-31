import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
    private readonly configService: ConfigService,
  ) {}

  private getOpenAIClient(): OpenAI | null {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey.trim().length > 0) {
      return new OpenAI({ apiKey: apiKey.trim() });
    }
    return null;
  }

  async processMessage(userId: string, messageText: string, conversationId?: string) {
    // 1. Get or create conversation
    const conversation = await this.conversationsService.getOrCreateActiveConversation(userId, conversationId);

    // 2. Persist user message
    await this.conversationsService.addMessage(conversation.id, 'user', messageText);

    let replyText = '';
    const executedTools: Array<{ tool: string; result: any }> = [];

    // 3. Try real OpenAI API call if key is available
    const openai = this.getOpenAIClient();
    if (openai) {
      try {
        this.logger.log('Processando mensagem via OpenAI API...');
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'Você é o J.A.R.V.I.S., um assistente de inteligência artificial futurista, altamente cortês, refinado e eficiente. Trate o usuário por "senhor" ou "senhora" com tom sofisticado e prestativo.',
            },
            {
              role: 'user',
              content: messageText,
            },
          ],
          temperature: 0.7,
        });

        const choiceText = response.choices?.[0]?.message?.content;
        if (choiceText) {
          replyText = choiceText;
        }
      } catch (err: any) {
        this.logger.warn(`Erro na chamada OpenAI (${err?.message}). Alternando para motor interno.`);
      }
    }

    // 4. Intent recognition & Tool execution fallback if replyText is still empty
    if (!replyText) {
      const textLower = messageText.toLowerCase();

      if (textLower.includes('lembra') || textLower.includes('lembrete') || textLower.includes('lembrar')) {
        // Parse time & title for reminder
        let remindAtDate = new Date(Date.now() + 60 * 1000); // default 1 minute from now
        if (textLower.includes('amanhã')) {
          remindAtDate = new Date();
          remindAtDate.setDate(remindAtDate.getDate() + 1);
          remindAtDate.setHours(9, 0, 0, 0);
        }

        // Try extracting time like "às 14" or "às 9:30"
        const timeMatch = textLower.match(/às\s+(\d{1,2})(?::(\d{2}))?/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          remindAtDate.setHours(hours, minutes, 0, 0);
        }

        const titleMatch = messageText.match(/(?:lembra|lembrete|lembrar)(?:\s+de|\s+que|\s+para)?\s+(.+)/i);
        const title = titleMatch ? titleMatch[1].trim() : messageText;

        const result = await this.toolRegistryService.executeTool(userId, 'reminder.create', {
          title,
          remindAt: remindAtDate.toISOString(),
          channel: 'PUSH',
        });
        executedTools.push({ tool: 'reminder.create', result });
        replyText = `Compreendido, senhor. ${result.message || `Lembrete agendado com sucesso para ${remindAtDate.toLocaleString('pt-BR')}.`}`;
      } else if (textLower.includes('agende') || textLower.includes('agendar') || textLower.includes('marcar')) {
        const result = await this.toolRegistryService.executeTool(userId, 'calendar.create_event', {
          title: messageText,
          start: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        });
        executedTools.push({ tool: 'calendar.create_event', result });
        replyText = `Compreendido, senhor. ${result.message || 'Seu compromisso foi agendado com sucesso no Google Calendar.'}`;
      } else if (textLower.includes('compromisso') || textLower.includes('agenda') || textLower.includes('hoje')) {
        const result = await this.toolRegistryService.executeTool(userId, 'calendar.list_events', {
          date: new Date().toISOString().split('T')[0],
        });
        executedTools.push({ tool: 'calendar.list_events', result });

        const eventsList = (result.events || [])
          .map((e: any) => `• ${e.title} às ${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
          .join('\n');

        replyText = `Senhor, aqui estão os seus compromissos para hoje:\n${eventsList}`;
      } else if (textLower.includes('contato') || textLower.includes('procure') || textLower.includes('busca')) {
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
        replyText = `Compreendido, senhor. Sistemas operacionais. Como posso auxiliá-lo com suas tarefas e agenda hoje?`;
      }
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

    // 5. Save assistant response
    await this.conversationsService.addMessage(conversation.id, 'assistant', replyText);

    return {
      conversationId: conversation.id,
      userMessage: messageText,
      assistantResponse: replyText,
      executedTools,
    };
  }
}

