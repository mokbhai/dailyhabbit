import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { loadPromptFile } from '../services/prompt-loader';
import type { ReminderContext } from './reminder-context.service';

export type ReminderKind = 'MORNING' | 'EVENING';

const PROMPT_FILES: Record<ReminderKind, string> = {
  MORNING: 'reminder-morning.md',
  EVENING: 'reminder-evening.md',
};

@Injectable()
export class OpenAiReminderService {
  private readonly logger = new Logger(OpenAiReminderService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL');
    this.model =
      this.config.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
    } else {
      this.openai = null;
    }
  }

  async compose(kind: ReminderKind, context: ReminderContext): Promise<string> {
    if (!this.openai) {
      return buildFallbackMessage(kind, context);
    }

    try {
      const prompt = await loadPromptFile(PROMPT_FILES[kind]);
      const userPrompt = interpolatePrompt(prompt.user, context, kind);

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 120,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty OpenAI response');
      }

      return content;
    } catch (error) {
      this.logger.error(`Reminder compose failed (${kind}):`, error);
      return buildFallbackMessage(kind, context);
    }
  }
}

export function interpolatePrompt(
  template: string,
  context: ReminderContext,
  kind: ReminderKind,
): string {
  const rankLine =
    context.rank != null ? `Current leaderboard rank: ${context.rank}.` : '';

  const replacements: Record<string, string> = {
    name: context.name,
    dayNumber: String(context.dayNumber),
    tasksDone: String(context.tasksDone),
    tasksRemaining: String(context.tasksRemaining),
    todayNetXp: String(context.todayNetXp),
    xpAtRisk: String(context.xpAtRisk),
    totalXp: String(context.totalXp),
    rank: context.rank != null ? String(context.rank) : '',
    rankLine,
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Remove leftover handlebars-style conditionals from prompt templates
  result = result.replace(/\{\{#if rank\}\}[\s\S]*?\{\{\/if\}\}/g, rankLine);
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  void kind;
  return result.trim();
}

export function buildFallbackMessage(
  kind: ReminderKind,
  context: ReminderContext,
): string {
  const rankSuffix =
    context.rank != null ? ` You're rank #${context.rank}.` : '';

  if (kind === 'MORNING') {
    return `Good morning, ${context.name}! Day ${context.dayNumber}: ${context.tasksRemaining} task(s) left today.${rankSuffix}`;
  }

  return `Hi ${context.name}, ${context.tasksRemaining} task(s) still open — ${context.xpAtRisk} XP at risk before midnight.${rankSuffix}`;
}
