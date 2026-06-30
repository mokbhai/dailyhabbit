import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ActivityKind, type Activity, type User } from '@workspace-starter/db';
import {
  GuidanceService,
  buildGuidanceContext,
  interpolateGuidancePrompt,
} from '../src/services/guidance.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const USER_ID = 'user-1';
const GROUP_ID = 'group-1';
const ACTIVITY_ID = 'activity-diet';

const dietActivity: Activity = {
  id: ACTIVITY_ID,
  groupId: GROUP_ID,
  ownerUserId: null,
  seedKey: 'DIET',
  title: 'Diet',
  emoji: '🥗',
  kind: ActivityKind.SUBPOINTS,
  scored: true,
  isPersonal: false,
  xpComplete: null,
  xpMiss: null,
  unitLabel: null,
  xpPerUnit: null,
  xpCap: null,
  missXp: null,
  subPoints: null,
  tiers: null,
  deductMultiplier: 2,
  sortOrder: 0,
  active: true,
  createdAt: new Date(),
};

const user: User = {
  id: USER_ID,
  name: 'Sam',
  email: null,
  phone: '+919876543210',
  passwordHash: 'hash',
  timezone: 'UTC',
  avatarUrl: null,
  groupId: GROUP_ID,
  reminderTime: null,
  whatsappOptIn: true,
  createdAt: new Date(),
};

function createService(apiKey?: string): GuidanceService {
  const config = {
    get: (key: string) => {
      if (key === 'OPENAI_API_KEY') return apiKey;
      if (key === 'OPENAI_BASE_URL') return undefined;
      if (key === 'OPENAI_VISION_MODEL') return 'gpt-4o-mini';
      return undefined;
    },
  } as unknown as ConfigService;
  return new GuidanceService(config);
}

function createPrisma(activity: Activity | null = dietActivity): PrismaService {
  return {
    user: {
      findUnique: vi.fn(async () => user),
    },
    activity: {
      findUnique: vi.fn(async () => activity),
    },
  } as unknown as PrismaService;
}

describe('buildGuidanceContext', () => {
  it('includes salad-with-mayo rule for DIET sub-points', () => {
    const context = buildGuidanceContext('Diet', 'DIET');
    expect(context.ruleBlock).toContain('Salad with mayonnaise counts as junk');
    expect(context.tipsText).toContain('Junk-food substitutes');
  });

  it('notes missing canonical rules for custom activities', () => {
    const context = buildGuidanceContext('Morning stretch', null);
    expect(context.ruleBlock).toContain('No canonical rule block');
    expect(context.ruleBlock).toContain('Morning stretch');
  });
});

describe('GuidanceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unavailable when API key is missing without throwing', async () => {
    const service = createService(undefined);
    const prisma = createPrisma();

    await expect(
      service.ask(prisma, USER_ID, {
        activityId: ACTIVITY_ID,
        question: 'Does mayo salad count?',
      }),
    ).resolves.toEqual({ available: false, answer: null });
  });

  it('returns unavailable when OpenAI throws without throwing', async () => {
    const service = createService('test-key');
    const prisma = createPrisma();
    const openai = (
      service as unknown as {
        openai: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).openai;
    openai.chat.completions.create = vi
      .fn()
      .mockRejectedValue(new Error('API down'));

    await expect(
      service.ask(prisma, USER_ID, {
        activityId: ACTIVITY_ID,
        question: 'Does mayo salad count?',
      }),
    ).resolves.toEqual({ available: false, answer: null });
  });

  it('grounds the system prompt in the activity rule block', async () => {
    const service = createService('test-key');
    const prisma = createPrisma();
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Yes, mayo salad is junk.' } }],
    });
    const openai = (
      service as unknown as {
        openai: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).openai;
    openai.chat.completions.create = create;

    const result = await service.ask(prisma, USER_ID, {
      activityId: ACTIVITY_ID,
      question: 'Does salad with mayo count as junk?',
    });

    expect(result).toEqual({
      available: true,
      answer: 'Yes, mayo salad is junk.',
    });

    const messages = create.mock.calls[0]?.[0]?.messages as Array<{
      role: string;
      content: string;
    }>;
    const systemPrompt = messages.find((m) => m.role === 'system')?.content;
    expect(systemPrompt).toContain('Salad with mayonnaise counts as junk');
    expect(systemPrompt).toMatch(/off-topic|defer|canonical/i);
    expect(systemPrompt).toContain('Diet');
  });

  it('passes optional chat history to OpenAI', async () => {
    const service = createService('test-key');
    const prisma = createPrisma();
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Use yogurt dressing instead.' } }],
    });
    (
      service as unknown as {
        openai: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).openai.chat.completions.create = create;

    await service.ask(prisma, USER_ID, {
      activityId: ACTIVITY_ID,
      question: 'What should I use instead?',
      history: [
        { role: 'user', content: 'Is mayo ok?' },
        { role: 'assistant', content: 'No, mayo salad is junk.' },
      ],
    });

    const messages = create.mock.calls[0]?.[0]?.messages;
    expect(messages).toHaveLength(4);
    expect(messages?.[1]).toEqual({
      role: 'user',
      content: 'Is mayo ok?',
    });
  });
});

describe('interpolateGuidancePrompt', () => {
  it('substitutes template placeholders', () => {
    const result = interpolateGuidancePrompt(
      'Activity: {{activityTitle}}\nRules: {{ruleBlock}}',
      { activityTitle: 'Water', ruleBlock: '3L plain water' },
    );
    expect(result).toContain('Water');
    expect(result).toContain('3L plain water');
  });
});
