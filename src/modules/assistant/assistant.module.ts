import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ToolsModule } from '../tools/tools.module';
import { N8nModule } from '../n8n/n8n.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConversationsModule, ToolsModule, N8nModule, UsersModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}

