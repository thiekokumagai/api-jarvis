import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations(@CurrentUser('userId') userId: string) {
    return this.conversationsService.getUserConversations(userId);
  }

  @Get('active')
  async getActiveConversation(@CurrentUser('userId') userId: string) {
    const conversation = await this.conversationsService.getOrCreateActiveConversation(userId);
    const messages = await this.conversationsService.getMessages(userId, conversation.id);
    return {
      conversationId: conversation.id,
      title: conversation.title,
      messages,
    };
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.getMessages(userId, conversationId);
  }
}
