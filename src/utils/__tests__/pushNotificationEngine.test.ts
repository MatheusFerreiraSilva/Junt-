import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PUSH_SETTINGS,
  checkAndTriggerScheduledPushNotifications,
  getBrowserPermissionStatus,
  isPushSupported,
} from '../pushNotificationEngine';
import { AppState } from '../../types/finance';

describe('Push Notification Engine', () => {
  it('has valid default push settings', () => {
    expect(DEFAULT_PUSH_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_PUSH_SETTINGS.dailyTriageEnabled).toBe(true);
    expect(DEFAULT_PUSH_SETTINGS.weeklySummaryEnabled).toBe(true);
    expect(DEFAULT_PUSH_SETTINGS.monthlySummaryEnabled).toBe(true);
  });

  it('checks browser notification support gracefully', () => {
    const supported = isPushSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('gets current permission status', () => {
    const status = getBrowserPermissionStatus();
    expect(['granted', 'denied', 'default']).toContain(status);
  });

  it('checks pending triage and triggers in-app notification when daily triage is enabled', () => {
    const mockUpdateSettings = vi.fn();
    const mockAddNotification = vi.fn();

    const sampleState: Partial<AppState> = {
      pushSettings: {
        ...DEFAULT_PUSH_SETTINGS,
        dailyTriageEnabled: true,
        lastDailyTriageNotifiedAt: undefined,
      },
      expenses: [
        {
          id: 'exp-1',
          description: 'Uber Unimed',
          amount: 35,
          category: 'transporte',
          date: '2026-10-26',
          paidBy: 'both',
          triageDone: false,
        },
      ],
      pendingConfirmations: [],
      currentMonth: '2026-10',
    };

    checkAndTriggerScheduledPushNotifications(
      sampleState as AppState,
      mockUpdateSettings,
      mockAddNotification
    );

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Fechamento do Dia|Triagem Diária/i),
      })
    );
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        lastDailyTriageNotifiedAt: expect.any(String),
      })
    );
  });
});
