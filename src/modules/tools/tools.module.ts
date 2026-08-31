import { Module } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { RemindersModule } from '../reminders/reminders.module';

@Module({
  imports: [RemindersModule],
  providers: [ToolRegistryService],
  exports: [ToolRegistryService],
})
export class ToolsModule {}
