import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../modules/activities.module';
import { EvolutionApiClient } from './evolution.client';
import { OpenAiReminderService } from './openai-reminder.service';
import { ReminderContextService } from './reminder-context.service';

@Module({
  imports: [ActivitiesModule],
  providers: [
    EvolutionApiClient,
    ReminderContextService,
    OpenAiReminderService,
  ],
  exports: [EvolutionApiClient, ReminderContextService, OpenAiReminderService],
})
export class WhatsappModule {}
