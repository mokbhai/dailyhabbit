import type { Challenge } from '@workspace-starter/db';
import { isChallengeCompleted } from './challenge-range';

export type MemberStatusValue = 'ACTIVE' | 'COMPLETED';

export function getMemberStatus(
  challenge: Challenge | null,
  timezone = 'UTC',
  now = new Date(),
): MemberStatusValue {
  if (isChallengeCompleted(challenge, timezone, now)) {
    return 'COMPLETED';
  }

  return 'ACTIVE';
}
