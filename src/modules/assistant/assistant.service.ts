import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ConversationsService } from '../conversations/conversations.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { N8nService } from '../n8n/n8n.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly n8nService: N8nService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  private getOpenAIClient(): OpenAI | null {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey.trim().length > 0) {
      return new OpenAI({ apiKey: apiKey.trim() });
    }
    return null;
  }

  async processMessage(userId: string, messageText: string, conversationId?: string) {
    // 0. Fetch user registered name
    let userName = 'Usuário';
    try {
      const user = await this.usersService.findById(userId);
      if (user && user.name) {
        userName = user.name.trim();
      }
    } catch (e) {
      this.logger.warn(`Não foi possível carregar dados do usuário ${userId}`);
    }
    const firstName = userName.split(' ')[0];

    // 1. Get or create conversation
    const conversation = await this.conversationsService.getOrCreateActiveConversation(userId, conversationId);

    // Fetch previous conversation history for full context awareness
    const historyMessages = await this.conversationsService.getMessages(userId, conversation.id);

    // 2. Persist user message
    await this.conversationsService.addMessage(conversation.id, 'user', messageText);

    // Format previous messages for OpenAI context (take last 14 messages)
    const historyFormatted: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = historyMessages
      .slice(-14)
      .map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

    let replyText = '';
    const executedTools: Array<{ tool: string; result: any }> = [];

    // 3. Try real OpenAI API call if key is available
    const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'reminder_create',
          description: 'Cria e agenda um novo lembrete com título e data/hora no banco de dados do usuário.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título ou assunto resumido do lembrete' },
              remindAt: { type: 'string', description: 'Data e hora em formato ISO 8601 para disparar o lembrete (ex: 2026-08-31T15:00:00.000Z)' },
              message: { type: 'string', description: 'Mensagem detalhada (opcional)' },
            },
            required: ['title', 'remindAt'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'reminder_list',
          description: 'Lista os lembretes pendentes do usuário.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calendar_create_event',
          description: 'Agenda um compromisso no calendário.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título do compromisso' },
              start: { type: 'string', description: 'Data e hora em formato ISO' },
            },
            required: ['title', 'start'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calendar_list_events',
          description: 'Lista compromissos da agenda para uma data.',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Data YYYY-MM-DD' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'contacts_search',
          description: 'Busca contatos na agenda telefônica do usuário.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nome do contato' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'whatsapp_send_message',
          description: 'Envia uma mensagem via WhatsApp.',
          parameters: {
            type: 'object',
            properties: {
              recipient: { type: 'string', description: 'Nome ou número do contato' },
              message: { type: 'string', description: 'Conteúdo da mensagem' },
            },
            required: ['recipient', 'message'],
          },
        },
      },
    ];

    const systemPrompt = `Você é o J.A.R.V.I.S., o assistente pessoal inteligente, refinado e eficiente. Trate o usuário pelo nome (${firstName}) em vez de usar "senhor" ou "senhora". 
ATENÇÃO: Você possui integração direta com o banco de dados do sistema! SEMPRE que o usuário pedir para criar, agendar ou colocar um lembrete (ex: "comprar carne amanhã às 15h"), você DEVE obrigatoriamente invocar a ferramenta (tool) 'reminder_create'. NUNCA diga que não tem capacidade de marcar lembretes ou que o usuário deve usar outro aplicativo.
Mantenha a memória e o contexto de todas as mensagens anteriores enviadas nesta conversa.
A data e hora atual do sistema é ${new Date().toISOString()}.`;

    const openAiMessagesPayload: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historyFormatted,
      { role: 'user', content: messageText },
    ];

    const openai = this.getOpenAIClient();
    if (openai) {
      try {
        this.logger.log('Processando mensagem via OpenAI API com histórico e Function Calling...');
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: openAiMessagesPayload,
          tools: openAiTools,
          tool_choice: 'auto',
          temperature: 0.7,
        });

        const choiceMessage = response.choices?.[0]?.message;

        if (choiceMessage?.tool_calls && choiceMessage.tool_calls.length > 0) {
          const toolCall = choiceMessage.tool_calls[0];
          if (toolCall.type === 'function') {
            const toolNameMap: Record<string, string> = {
              reminder_create: 'reminder.create',
              reminder_list: 'reminder.list',
              calendar_create_event: 'calendar.create_event',
              calendar_list_events: 'calendar.list_events',
              contacts_search: 'contacts.search',
              whatsapp_send_message: 'whatsapp.send_message',
            };
            const actualToolName = toolNameMap[toolCall.function.name] || toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');

            const toolResult = await this.toolRegistryService.executeTool(userId, actualToolName, args);
            executedTools.push({ tool: actualToolName, result: toolResult });

            // Send tool output back to OpenAI for a natural, elegant user reply
            const followUp = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                ...openAiMessagesPayload,
                choiceMessage,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            });

            replyText = followUp.choices?.[0]?.message?.content || toolResult.message || `Pronto, ${firstName}! Tarefa realizada com sucesso.`;
          }
        } else if (choiceMessage?.content) {
          replyText = choiceMessage.content;
        }
      } catch (err: any) {
        this.logger.warn(`Erro na chamada OpenAI (${err?.message}). Alternando para motor interno.`);
      }
    }

    // 4. Intent recognition & Tool execution fallback if replyText is still empty
    if (!replyText) {
      const textLower = messageText.toLowerCase();

      if (
        textLower.includes('lembra') ||
        textLower.includes('lembrete') ||
        textLower.includes('lembrar') ||
        textLower.includes('avise') ||
        textLower.includes('avisar')
      ) {
        let remindAtDate = new Date();

        // Check relative minutes e.g. "daqui a 5 minutos" / "em 10 minutos"
        const relMinMatch = textLower.match(/(?:daqui\s+a|em)\s+(\d+)\s+minuto/i);
        if (relMinMatch) {
          const mins = parseInt(relMinMatch[1], 10);
          remindAtDate = new Date(Date.now() + mins * 60 * 1000);
        } else if (textLower.includes('amanhã')) {
          remindAtDate.setDate(remindAtDate.getDate() + 1);
          remindAtDate.setHours(9, 0, 0, 0);
        } else {
          // Default to 10 minutes from now if no specific time
          remindAtDate = new Date(Date.now() + 10 * 60 * 1000);
        }

        // Check explicit hour e.g. "às 14" or "às 14:30"
        const timeMatch = textLower.match(/às\s+(\d{1,2})(?::(\d{2}))?/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          remindAtDate.setHours(hours, minutes, 0, 0);
          // If time has already passed today, set to tomorrow
          if (remindAtDate.getTime() <= Date.now()) {
            remindAtDate.setDate(remindAtDate.getDate() + 1);
          }
        }

        const titleMatch = messageText.match(/(?:lembra|lembrete|lembrar|avise|avisar)(?:\s+de|\s+que|\s+para|\s+sobre)?\s+(.+)/i);
        const title = titleMatch ? titleMatch[1].trim() : messageText;

        const result = await this.toolRegistryService.executeTool(userId, 'reminder.create', {
          title,
          remindAt: remindAtDate.toISOString(),
          channel: 'PUSH',
        });
        executedTools.push({ tool: 'reminder.create', result });

        const timeStr = remindAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = remindAtDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        replyText = `Com certeza, ${firstName}! Já anotei o seu lembrete "${title}" para ${dateStr} às ${timeStr}. Pode deixar que te aviso!`;
      } else if (textLower.includes('agende') || textLower.includes('agendar') || textLower.includes('marcar')) {
        const result = await this.toolRegistryService.executeTool(userId, 'calendar.create_event', {
          title: messageText,
          start: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        });
        executedTools.push({ tool: 'calendar.create_event', result });
        replyText = `Tudo certo, ${firstName}! Agendei seu compromisso com sucesso no calendário.`;
      } else if (textLower.includes('compromisso') || textLower.includes('agenda') || textLower.includes('hoje')) {
        const result = await this.toolRegistryService.executeTool(userId, 'calendar.list_events', {
          date: new Date().toISOString().split('T')[0],
        });
        executedTools.push({ tool: 'calendar.list_events', result });

        const eventsList = (result.events || [])
          .map((e: any) => `${e.title} às ${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
          .join(', ');

        replyText = eventsList
          ? `${firstName}, você tem os seguintes compromissos hoje: ${eventsList}.`
          : `${firstName}, verifiquei sua agenda e você não possui compromissos marcados para hoje.`;
      } else if (textLower.includes('contato') || textLower.includes('procure') || textLower.includes('busca')) {
        const match = messageText.match(/(?:contato|procure|busca)(?:\s+do|\s+da|\s+de)?\s+([A-Za-zÀ-ÿ]+)/i);
        const queryName = match ? match[1] : 'Carlos';

        const result = await this.toolRegistryService.executeTool(userId, 'contacts.search', {
          query: queryName,
        });
        executedTools.push({ tool: 'contacts.search', result });

        const firstContact = result.contacts?.[0];
        if (firstContact) {
          replyText = `Localizei o contato de ${firstContact.name}. O telefone é ${firstContact.phone} e o e-mail é ${firstContact.email}.`;
        } else {
          replyText = `Não consegui encontrar o contato do ${queryName} na sua agenda, ${firstName}.`;
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

        replyText = `Enviei a mensagem por WhatsApp para ${recipient} com o seguinte texto: "${bodyMsg}".`;
      } else {
        replyText = `Olá, ${firstName}! Estou pronto para te ajudar. Você pode me pedir para criar lembretes, agendar compromissos, pesquisar contatos ou enviar mensagens.`;
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

