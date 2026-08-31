import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getUserIntegrations(userId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const defaultProviders = ['google', 'whatsapp', 'n8n'];
    const result = defaultProviders.map((provider) => {
      const found = integrations.find((i) => i.provider.toLowerCase() === provider);
      if (found) return found;
      return {
        id: null,
        provider,
        status: provider === 'n8n' ? 'NOT_CONFIGURED' : 'DISCONNECTED',
        expiresAt: null,
        metadata: null,
        createdAt: null,
        updatedAt: null,
      };
    });

    return result;
  }

  async connectGoogle(userId: string, mockCode?: string) {
    // Encrypt simulated OAuth token securely
    const mockAccessToken = `google_access_token_mock_${Date.now()}`;
    const mockRefreshToken = `google_refresh_token_mock_${Date.now()}`;

    const accessTokenEncrypted = this.encryptionService.encrypt(mockAccessToken);
    const refreshTokenEncrypted = this.encryptionService.encrypt(mockRefreshToken);

    const integration = await this.prisma.integration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'google',
        },
      },
      update: {
        status: 'CONNECTED',
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        metadata: { connectedAt: new Date().toISOString() },
      },
      create: {
        userId,
        provider: 'google',
        status: 'CONNECTED',
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        metadata: { connectedAt: new Date().toISOString() },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: 'Google conectado com sucesso',
      integration,
    };
  }

  async disconnectGoogle(userId: string) {
    await this.prisma.integration.updateMany({
      where: { userId, provider: 'google' },
      data: {
        status: 'DISCONNECTED',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        expiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Google desconectado',
    };
  }

  async connectWhatsApp(userId: string, phoneNumber?: string) {
    const mockToken = `whatsapp_session_token_${Date.now()}`;
    const accessTokenEncrypted = this.encryptionService.encrypt(mockToken);

    const integration = await this.prisma.integration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'whatsapp',
        },
      },
      update: {
        status: 'CONNECTED',
        accessTokenEncrypted,
        metadata: { phoneNumber: phoneNumber || '+5511999999999', connectedAt: new Date().toISOString() },
      },
      create: {
        userId,
        provider: 'whatsapp',
        status: 'CONNECTED',
        accessTokenEncrypted,
        metadata: { phoneNumber: phoneNumber || '+5511999999999', connectedAt: new Date().toISOString() },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: 'WhatsApp conectado com sucesso',
      integration,
    };
  }

  async disconnectWhatsApp(userId: string) {
    await this.prisma.integration.updateMany({
      where: { userId, provider: 'whatsapp' },
      data: {
        status: 'DISCONNECTED',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
      },
    });

    return {
      success: true,
      message: 'WhatsApp desconectado',
    };
  }
}
