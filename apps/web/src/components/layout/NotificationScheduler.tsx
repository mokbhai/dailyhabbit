import { useEffect } from 'react';
import { getToken } from '../../lib/auth';
import {
  hasNotificationPermission,
  markFiredToday,
  shouldFireReminder,
  shouldFireTenPmWarning,
  showNotification,
  wasFiredToday,
} from '../../lib/notifications';
import { trpc } from '../../lib/trpc';

const POLL_INTERVAL_MS = 60_000;

function isActivityIncomplete(
  log: {
    state: string | null;
    tier: string | null;
    value: number | null;
    subPoints: Record<string, string> | null;
  } | null,
): boolean {
  if (!log) {
    return true;
  }
  if (log.state != null && log.state !== 'UNLOGGED') {
    return false;
  }
  if (log.tier != null || log.value != null) {
    return false;
  }
  if (log.subPoints != null && Object.keys(log.subPoints).length > 0) {
    return false;
  }
  return true;
}

export function NotificationScheduler() {
  const hasToken = Boolean(getToken());

  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: hasToken,
  });
  const activitiesQuery = trpc.activities.getToday.useQuery(undefined, {
    enabled: hasToken,
  });

  useEffect(() => {
    if (!hasToken) return;

    async function tick() {
      if (!hasNotificationPermission()) return;

      const now = new Date();
      const [profileResult, activitiesResult] = await Promise.all([
        profileQuery.refetch(),
        activitiesQuery.refetch(),
      ]);

      const reminderTime = profileResult.data?.reminderTime;
      if (
        reminderTime &&
        shouldFireReminder(reminderTime, now) &&
        !wasFiredToday('reminder')
      ) {
        showNotification(
          'DRCODE 75 Hard',
          'Time for your daily check-in. Log your activities before midnight.',
        );
        markFiredToday('reminder');
      }

      const activities = activitiesResult.data?.scoredActivities ?? [];
      const hasIncomplete = activities.some((activity) =>
        isActivityIncomplete(activity.log),
      );

      if (
        shouldFireTenPmWarning(now) &&
        hasIncomplete &&
        !wasFiredToday('warning')
      ) {
        showNotification(
          'DRCODE 75 Hard',
          'Incomplete activities remain for today. Log them before midnight.',
        );
        markFiredToday('warning');
      }
    }

    void tick();
    const intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [hasToken, profileQuery, activitiesQuery]);

  return null;
}
