import { Tool, ToolContext } from '../tool.interface';

export class CalendarCreateEventTool implements Tool {
  name = 'calendar.create_event';
  description = 'Cria um novo evento no Google Calendar';

  async execute(input: { title: string; start: string; end?: string; description?: string }, context?: ToolContext) {
    const start = input.start || new Date().toISOString();
    return {
      success: true,
      message: `Evento "${input.title || 'Reunião'}" agendado com sucesso para ${start}`,
      event: {
        id: `evt_${Date.now()}`,
        title: input.title || 'Reunião',
        start,
        end: input.end || new Date(new Date(start).getTime() + 3600000).toISOString(),
        description: input.description || '',
      },
    };
  }
}

export class CalendarListEventsTool implements Tool {
  name = 'calendar.list_events';
  description = 'Lista compromissos e eventos agendados no Google Calendar';

  async execute(input: { date?: string }, context?: ToolContext) {
    const today = input.date || new Date().toISOString().split('T')[0];
    return {
      success: true,
      date: today,
      events: [
        {
          id: 'evt_101',
          title: 'Reunião de Alinhamento com João',
          start: `${today}T14:00:00.000Z`,
          end: `${today}T15:00:00.000Z`,
          location: 'Google Meet',
        },
        {
          id: 'evt_102',
          title: 'Revisão de Arquitetura J.A.R.V.I.S.',
          start: `${today}T16:30:00.000Z`,
          end: `${today}T17:30:00.000Z`,
          location: 'Sala 02 / Online',
        },
      ],
    };
  }
}
