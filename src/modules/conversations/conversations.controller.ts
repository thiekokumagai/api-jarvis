import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations(@CurrentUser('userId') userId: string) {
    return this.conversationsService.getUserConversations(userId);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.getMessages(userId, conversationId);
  }
}
