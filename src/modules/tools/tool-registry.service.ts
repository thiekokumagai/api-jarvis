import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Tool, ToolContext } from './tool.interface';
import { CalendarCreateEventTool, CalendarListEventsTool } from './mocks/calendar.tool';
import { ContactsSearchTool } from './mocks/contacts.tool';
import { WhatsAppSendMessageTool } from './mocks/whatsapp.tool';
import { ReminderCreateTool, ReminderListTool, ReminderDeleteTool } from './reminders.tool';
import { RemindersService } from '../reminders/reminders.service';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly tools = new Map<string, Tool>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly remindersService: RemindersService,
  ) {}

  onModuleInit() {
    this.registerTool(new CalendarCreateEventTool());
    this.registerTool(new CalendarListEventsTool());
    this.registerTool(new ContactsSearchTool());
    this.registerTool(new WhatsAppSendMessageTool());
    this.registerTool(new ReminderCreateTool(this.remindersService));
    this.registerTool(new ReminderListTool(this.remindersService));
    this.registerTool(new ReminderDeleteTool(this.remindersService));
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new NotFoundException(`Ferramenta '${name}' não encontrada no ToolRegistry`);
    }
    return tool;
  }

  getAllTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  async executeTool(userId: string, toolName: string, input: Record<string, any>) {
    const tool = this.getTool(toolName);
    let output: any;
    let status = 'SUCCESS';

    try {
      const context: ToolContext = { userId };
      output = await tool.execute(input, context);
    } catch (error) {
      status = 'FAILED';
      output = {
        error: error.message || 'Erro durante a execução da ferramenta',
      };
    }

    // Record execution in database
    await this.prisma.toolExecution.create({
      data: {
        userId,
        tool: toolName,
        input: input || {},
        output: output || {},
        status,
      },
    });

    return output;
  }
}
