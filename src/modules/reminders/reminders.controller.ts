import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RemindersService, CreateReminderDto } from './reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('reminders')
  async createReminder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReminderDto,
  ) {
    return this.remindersService.createReminder(userId, dto);
  }

  @Get('reminders')
  async getUserReminders(@CurrentUser('userId') userId: string) {
    return this.remindersService.getUserReminders(userId);
  }

  @Delete('reminders/:id')
  async cancelReminder(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.remindersService.cancelReminder(userId, id);
  }

  @Post('users/web-push-subscription')
  async savePushSubscription(
    @CurrentUser('userId') userId: string,
    @Body() body: { subscription: any },
  ) {
    return this.remindersService.savePushSubscription(userId, body?.subscription);
  }
}
