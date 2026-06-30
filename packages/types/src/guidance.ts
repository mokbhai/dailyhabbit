export const BUILTIN_SEED_KEYS = [
  'DIET',
  'ACTIVITY',
  'WATER',
  'READING',
  'PROGRESS_PHOTO',
  'NO_REELS',
  'NO_SOCIAL',
] as const;

export type GuidanceSeedKey = (typeof BUILTIN_SEED_KEYS)[number];

export type GuidanceLink = {
  label: string;
  url: string;
};

export type GuidanceTips = {
  title: string;
  bullets: string[];
  links?: GuidanceLink[];
};

export type SubPointGuidance = {
  ruleBlock: string;
  tips: GuidanceTips;
};

export type ActivityGuidance = {
  ruleBlock: string;
  tips: GuidanceTips;
  subPoints?: Record<string, SubPointGuidance>;
};

const GUIDANCE: Record<GuidanceSeedKey, ActivityGuidance> = {
  DIET: {
    ruleBlock:
      'Eat whole, minimally processed meals with protein, fiber, and vegetables at each sitting. Home-cooked food with moderate oil is fine.',
    tips: {
      title: 'Healthy eating habits',
      bullets: [
        'Build each meal around protein (eggs, dal, chicken, tofu) plus vegetables.',
        'Swap white rice/bread for whole grains when easy.',
        'Prep one protein + veg batch on Sunday to reduce takeout temptation.',
        'Drink water before meals to blunt junk cravings.',
      ],
    },
    subPoints: {
      HEALTHY: {
        ruleBlock:
          'Healthy = balanced whole-food meals with adequate protein, fiber, and vegetables. Packaged “health” bars and sugary smoothies do not count.',
        tips: {
          title: 'What counts as healthy',
          bullets: [
            'Aim for a palm-sized protein + two fist-sized veg portions per meal.',
            'Home cooking beats restaurant portions you cannot see.',
            'Fruit with meals is fine; fruit juice alone is not a meal.',
          ],
        },
      },
      NO_JUNK: {
        ruleBlock:
          'Junk = deep-fried food, refined-sugar desserts, packaged snacks, and sugary drinks. Salad with mayonnaise counts as junk (mayo is a processed high-oil dressing) — use yogurt or olive-oil dressing instead. Home-cooked with moderate oil is fine.',
        tips: {
          title: 'Junk-food substitutes',
          bullets: [
            'Craving chips? Try roasted chana, makhana, or nuts (small portion).',
            'Sweet tooth: fruit, dark chocolate (1–2 squares), or dates.',
            'Replace mayo with Greek yogurt + mustard or lemon-olive-oil dressing.',
            'Keep junk out of arm’s reach; visibility drives snacking.',
          ],
        },
      },
      NO_ALCOHOL: {
        ruleBlock:
          'Zero alcohol of any kind, including beer and wine. Cooking wine burned off in food is exempt.',
        tips: {
          title: 'Staying alcohol-free',
          bullets: [
            'At social events, order sparkling water with lime — same hand-to-mouth habit.',
            'Tell one accountability partner your no-alcohol commitment.',
            'Notice triggers (stress, Friday night) and plan a non-alcoholic ritual instead.',
          ],
        },
      },
    },
  },

  ACTIVITY: {
    ruleBlock:
      'Move deliberately every day — outdoor time is a bonus on top of your movement goal.',
    tips: {
      title: 'Staying active',
      bullets: [
        'Schedule movement like a meeting; morning walks beat “I’ll do it later.”',
        'Combine movement with something you enjoy (podcast, audiobook, friend call).',
        'Track cumulative minutes honestly — a 20-min walk + 25-min workout counts.',
      ],
    },
    subPoints: {
      MIN_45: {
        ruleBlock:
          'Continuous or cumulative 45 min of deliberate movement. Walking counts; routine housework does not.',
        tips: {
          title: 'Hitting 45 minutes',
          bullets: [
            'Brisk walk, jog, cycling, gym, yoga flow, sports — all count.',
            'Split into chunks: 15 min morning + 30 min evening is valid.',
            'Housework (dishes, tidying) does not count unless it is a dedicated workout block.',
            'Indoor fallback: bodyweight circuit, stairs, or a follow-along workout video.',
          ],
        },
      },
      OUTSIDE: {
        ruleBlock:
          'Spend meaningful time outdoors (not just stepping to the car). A walk, run, or outdoor workout session counts.',
        tips: {
          title: 'Getting outside',
          bullets: [
            'Morning sunlight helps sleep and mood — even 10 min outside counts toward the habit.',
            'Walk a loop around the block instead of scrolling on the balcony.',
            'Rainy day? Covered walkway or porch steps still count as outside.',
          ],
        },
      },
    },
  },

  WATER: {
    ruleBlock:
      '3–3.8 L of plain water per day. Tea, coffee, and juice do not count toward the total.',
    tips: {
      title: 'Hydration pacing',
      bullets: [
        'Use a 1 L bottle and refill 3–4 times — easier than counting glasses.',
        'Drink a full glass on waking and before each meal.',
        'Set phone reminders every 2 hours until the habit sticks.',
        'Urine pale yellow = on track; dark yellow = drink more plain water.',
      ],
    },
  },

  READING: {
    ruleBlock:
      'Read a physical or e-book daily — fiction is fine for the page goal; non-fiction is a separate sub-point.',
    tips: {
      title: 'Building a reading habit',
      bullets: [
        'Keep the book on your pillow or phone home screen — reduce friction.',
        'Read 10 pages right after a fixed anchor (morning coffee, before bed).',
        'Phone in another room while reading to protect focus.',
      ],
    },
    subPoints: {
      PAGES_10: {
        ruleBlock:
          'Read at least 10 pages of a book (physical or e-book). Articles and social posts do not count.',
        tips: {
          title: '10-page habit',
          bullets: [
            'Stop mid-chapter if you must — momentum matters more than finishing.',
            'Use a dedicated reading app or Kindle to avoid notification traps.',
            'Track pages with a bookmark note or app streak.',
          ],
        },
      },
      NON_FICTION: {
        ruleBlock:
          'Non-fiction = factual or educational (biography, science, history, self-improvement). Novels, manga, and fiction do not count.',
        tips: {
          title: 'Non-fiction starters',
          bullets: [
            'Pick one topic you are curious about — curiosity beats “should read.”',
            'Try: Atomic Habits, Sapiens, The Psychology of Money, or a field-specific primer.',
            'Mix formats: audiobook for commutes counts if you are actively listening.',
            'Take one note per chapter to make it stick.',
          ],
        },
      },
    },
  },

  PROGRESS_PHOTO: {
    ruleBlock:
      'Take one progress photo today. Same pose, lighting, and distance each time so changes are visible. Photos are private/self-view only.',
    tips: {
      title: 'Consistent progress photos',
      bullets: [
        'Pick a weekly spot (bathroom mirror, same wall) and stick to it.',
        'Same time of day — morning before food/water skews less.',
        'Front + side optional; one angle done consistently beats many angles sporadically.',
        'These are for you — honest lighting beats flattering filters.',
      ],
    },
  },

  NO_REELS: {
    ruleBlock:
      'All time on Reels, Shorts, TikTok-style vertical feeds, and similar short-form video counts toward your tier. There is no “productive reels” exemption — log total minutes honestly.',
    tips: {
      title: 'Checking Reels/Shorts time',
      bullets: [
        'iOS: Settings → Screen Time → See All Activity → find Instagram/YouTube/TikTok → check time on Reels/Shorts.',
        'Android: Settings → Digital Wellbeing → Dashboard → tap the app → review video/shorts usage.',
        'Add a daily Screen Time limit on Reels/Shorts apps as a guardrail.',
        'Replace the habit loop: when you reach for Shorts, open a saved article or stretch for 2 min instead.',
        'Log your honest total — the honor system only works if you are strict with yourself.',
      ],
      links: [
        {
          label: 'Apple Screen Time',
          url: 'https://support.apple.com/guide/iphone/use-screen-time-iphbfa595995/ios',
        },
        {
          label: 'Android Digital Wellbeing',
          url: 'https://wellbeing.google/',
        },
      ],
    },
  },

  NO_SOCIAL: {
    ruleBlock:
      'Tracked time = non-productive scrolling (feed browsing, reels, time-pass). Excluded: using the platform for work, learning, or a practical task (messaging a client, watching a tutorial, posting your own progress). Log only the doom-scroll minutes.',
    tips: {
      title: 'Honest social-media logging',
      bullets: [
        'iOS: Settings → Screen Time → See All Activity → per-app breakdown for Instagram, X, Facebook, LinkedIn, etc.',
        'Android: Settings → Digital Wellbeing → Dashboard → tap each social app.',
        'Count feed scrolling and passive watching; exclude work DMs, course videos, and posting your own content.',
        'LinkedIn job outreach or client messages do not count; mindless feed scrolling does.',
        'If unsure, ask: “Was I doing something useful, or killing time?” — log only kill-time minutes.',
      ],
      links: [
        {
          label: 'Apple Screen Time',
          url: 'https://support.apple.com/guide/iphone/use-screen-time-iphbfa595995/ios',
        },
        {
          label: 'Android Digital Wellbeing',
          url: 'https://wellbeing.google/',
        },
      ],
    },
  },
};

export function isGuidanceSeedKey(seedKey: string): seedKey is GuidanceSeedKey {
  return (BUILTIN_SEED_KEYS as readonly string[]).includes(seedKey);
}

export function getGuidance(
  seedKey: string | null | undefined,
): ActivityGuidance | undefined {
  if (!seedKey || !isGuidanceSeedKey(seedKey)) {
    return undefined;
  }
  return GUIDANCE[seedKey];
}

export function getSubPointGuidance(
  seedKey: string | null | undefined,
  subPointKey: string,
): SubPointGuidance | undefined {
  const activity = getGuidance(seedKey);
  return activity?.subPoints?.[subPointKey];
}
