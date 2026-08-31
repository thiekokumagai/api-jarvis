import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  async getIntegrations(@CurrentUser('userId') userId: string) {
    return this.integrationsService.getUserIntegrations(userId);
  }

  @Post('google/connect')
  async connectGoogle(@CurrentUser('userId') userId: string, @Body() body: { code?: string }) {
    return this.integrationsService.connectGoogle(userId, body?.code);
  }

  @Post('google/disconnect')
  async disconnectGoogle(@CurrentUser('userId') userId: string) {
    return this.integrationsService.disconnectGoogle(userId);
  }

  @Post('whatsapp/connect')
  async connectWhatsApp(@CurrentUser('userId') userId: string, @Body() body: { phoneNumber?: string }) {
    return this.integrationsService.connectWhatsApp(userId, body?.phoneNumber);
  }

  @Post('whatsapp/disconnect')
  async disconnectWhatsApp(@CurrentUser('userId') userId: string) {
    return this.integrationsService.disconnectWhatsApp(userId);
  }
}
