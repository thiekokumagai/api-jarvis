import { Tool, ToolContext } from '../tool.interface';

export class ContactsSearchTool implements Tool {
  name = 'contacts.search';
  description = 'Pesquisa um contato na agenda do Google Contacts';

  async execute(input: { query: string }, context?: ToolContext) {
    const query = input.query || '';
    const contactsMock = [
      { id: 'c1', name: 'Carlos Silva', phone: '+55 11 98765-4321', email: 'carlos@empresa.com' },
      { id: 'c2', name: 'João Santos', phone: '+55 11 91234-5678', email: 'joao@empresa.com' },
      { id: 'c3', name: 'Maria Oliveira', phone: '+55 11 99887-7665', email: 'maria@empresa.com' },
    ];

    const results = contactsMock.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query),
    );

    return {
      success: true,
      query,
      contacts: results.length > 0 ? results : [
        { id: `c_gen`, name: query || 'Contato', phone: '+55 11 99999-8888', email: `${(query || 'contato').toLowerCase()}@exemplo.com` },
      ],
    };
  }
}
