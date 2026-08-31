import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ToolsModule } from './modules/tools/tools.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { N8nModule } from './modules/n8n/n8n.module';
import { RemindersModule } from './modules/reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    EncryptionModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    IntegrationsModule,
    ToolsModule,
    ConversationsModule,
    AssistantModule,
    N8nModule,
    RemindersModule,
  ],
})
export class AppModule {}
