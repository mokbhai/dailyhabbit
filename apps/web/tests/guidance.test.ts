import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SEED_KEYS,
  getGuidance,
  getSubPointGuidance,
} from '@workspace-starter/types';

describe('activity guidance', () => {
  it('provides ruleBlock and tips for all 7 seeded activities', () => {
    for (const seedKey of BUILTIN_SEED_KEYS) {
      const guidance = getGuidance(seedKey);
      expect(guidance, `missing guidance for ${seedKey}`).toBeDefined();
      expect(guidance!.ruleBlock.length).toBeGreaterThan(20);
      expect(guidance!.tips.title.length).toBeGreaterThan(0);
      expect(guidance!.tips.bullets.length).toBeGreaterThanOrEqual(3);
      expect(guidance!.tips.bullets.length).toBeLessThanOrEqual(6);
    }
  });

  it('returns undefined for custom activities without a seedKey', () => {
    expect(getGuidance(null)).toBeUndefined();
    expect(getGuidance(undefined)).toBeUndefined();
    expect(getGuidance('CUSTOM_MEDITATION')).toBeUndefined();
  });

  it('encodes no-junk edge case: mayonnaise counts as junk', () => {
    const junk = getSubPointGuidance('DIET', 'NO_JUNK');
    expect(junk?.ruleBlock).toMatch(/mayonnaise/i);
    expect(junk?.ruleBlock).toMatch(/junk/i);
    expect(junk?.ruleBlock).toMatch(/yogurt|olive-oil/i);
  });

  it('encodes no-alcohol rule with cooking-wine exemption', () => {
    const alcohol = getSubPointGuidance('DIET', 'NO_ALCOHOL');
    expect(alcohol?.ruleBlock).toMatch(/zero alcohol/i);
    expect(alcohol?.ruleBlock).toMatch(/cooking wine/i);
  });

  it('encodes 45-min activity rule: walking counts, housework does not', () => {
    const min45 = getSubPointGuidance('ACTIVITY', 'MIN_45');
    expect(min45?.ruleBlock).toMatch(/45 min/i);
    expect(min45?.ruleBlock).toMatch(/walking counts/i);
    expect(min45?.ruleBlock).toMatch(/housework does not/i);
  });

  it('encodes water rule: plain water only, not tea/coffee/juice', () => {
    const water = getGuidance('WATER');
    expect(water?.ruleBlock).toMatch(/3/);
    expect(water?.ruleBlock).toMatch(/plain water/i);
    expect(water?.ruleBlock).toMatch(/tea|coffee|juice/i);
    expect(water?.ruleBlock).toMatch(/do not count/i);
  });

  it('encodes no-social doomscroll rule excluding work and learning', () => {
    const social = getGuidance('NO_SOCIAL');
    expect(social?.ruleBlock).toMatch(/non-productive scrolling/i);
    expect(social?.ruleBlock).toMatch(/work/i);
    expect(social?.ruleBlock).toMatch(/learning/i);
    expect(social?.ruleBlock).toMatch(/messaging a client/i);
    expect(social?.tips.bullets.join(' ')).toMatch(/LinkedIn/i);
    expect(social?.tips.bullets.join(' ')).toMatch(
      /Screen Time|Digital Wellbeing/i,
    );
  });

  it('encodes no-reels rule: all reels/shorts time counts', () => {
    const reels = getGuidance('NO_REELS');
    expect(reels?.ruleBlock).toMatch(/reels|shorts/i);
    expect(reels?.tips.bullets.join(' ')).toMatch(
      /Screen Time|Digital Wellbeing/i,
    );
  });

  it('encodes non-fiction reading rule excluding novels and manga', () => {
    const nonFiction = getSubPointGuidance('READING', 'NON_FICTION');
    expect(nonFiction?.ruleBlock).toMatch(/non-fiction/i);
    expect(nonFiction?.ruleBlock).toMatch(/novels|manga|fiction/i);
    expect(nonFiction?.ruleBlock).toMatch(/do not count/i);
  });
});
