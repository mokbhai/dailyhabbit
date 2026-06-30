import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import path from 'node:path';
import { DayEvaluatorService } from './cron/day-evaluator.service';
import { AuthModule } from './modules/auth.module';
import { ActivitiesModule } from './modules/activities.module';
import { PrismaModule } from './prisma/prisma.module';

const repoRoot = path.resolve(__dirname, '../../..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(repoRoot, '.env'),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ActivitiesModule,
  ],
  providers: [DayEvaluatorService],
})
export class AppModule {}
