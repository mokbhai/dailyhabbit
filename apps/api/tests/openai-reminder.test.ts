import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  OpenAiReminderService,
  buildFallbackMessage,
  interpolatePrompt,
} from '../src/whatsapp/openai-reminder.service';
import type { ReminderContext } from '../src/whatsapp/reminder-context.service';

const baseContext: ReminderContext = {
  name: 'Sam',
  dayNumber: 10,
  tasksDone: 2,
  tasksRemaining: 3,
  todayNetXp: 150,
  xpAtRisk: 75,
  rank: 4,
  totalXp: 2000,
};

function createService(apiKey?: string): OpenAiReminderService {
  const config = {
    get: (key: string) => {
      if (key === 'OPENAI_API_KEY') return apiKey;
      if (key === 'OPENAI_BASE_URL') return undefined;
      if (key === 'OPENAI_VISION_MODEL') return 'gpt-4o-mini';
      return undefined;
    },
  } as unknown as ConfigService;
  return new OpenAiReminderService(config);
}

describe('OpenAiReminderService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns template fallback when API key is missing', async () => {
    const service = createService(undefined);
    const text = await service.compose('MORNING', baseContext);
    expect(text).toBe(buildFallbackMessage('MORNING', baseContext));
  });

  it('returns template fallback when OpenAI throws', async () => {
    const service = createService('test-key');
    const openai = (
      service as unknown as {
        openai: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).openai;
    openai.chat.completions.create = vi
      .fn()
      .mockRejectedValue(new Error('API down'));

    const text = await service.compose('EVENING', baseContext);
    expect(text).toBe(buildFallbackMessage('EVENING', baseContext));
  });

  it('never throws on compose failure', async () => {
    const service = createService('test-key');
    const openai = (
      service as unknown as {
        openai: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).openai;
    openai.chat.completions.create = vi
      .fn()
      .mockRejectedValue(new Error('boom'));

    await expect(service.compose('MORNING', baseContext)).resolves.toBeTypeOf(
      'string',
    );
  });
});

describe('interpolatePrompt', () => {
  it('substitutes context values and rank line', () => {
    const template =
      'Hi {{name}}, day {{dayNumber}}, remaining {{tasksRemaining}}. {{rankLine}}';
    const result = interpolatePrompt(template, baseContext, 'MORNING');
    expect(result).toContain('Sam');
    expect(result).toContain('10');
    expect(result).toContain('3');
    expect(result).toContain('rank: 4');
  });

  it('omits rank line when rank is null', () => {
    const template = 'Hello {{name}}. {{rankLine}}';
    const result = interpolatePrompt(
      template,
      { ...baseContext, rank: null },
      'EVENING',
    );
    expect(result).not.toContain('rank');
  });
});

describe('buildFallbackMessage', () => {
  it('produces morning and evening templates', () => {
    expect(buildFallbackMessage('MORNING', baseContext)).toContain(
      'Good morning',
    );
    expect(buildFallbackMessage('EVENING', baseContext)).toContain(
      'XP at risk',
    );
  });
});
