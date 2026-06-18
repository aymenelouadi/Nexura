import { describe, expect, it } from 'vitest';

import { WelcomeSettingsService } from '../services/settings-service.js';
import type { PluginStorage } from '@nexura/shared';

function createMockStorage(initial: Record<string, unknown> = {}): PluginStorage {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async <T>(key: string) => (data.get(key) as T | null) ?? null,
    set: async <T>(key: string, value: T) => {
      data.set(key, value);
    },
    delete: async (key: string) => {
      data.delete(key);
    },
    list: async <T>(prefix?: string) =>
      Array.from(data.entries())
        .filter(([key]) => !prefix || key.startsWith(prefix))
        .map(([key, value]) => ({ key, value: value as T })),
  };
}

describe('WelcomeSettingsService', () => {
  it('returns default welcome settings when none are stored', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    const settings = await service.getWelcome();
    expect(settings.enabled).toBe(false);
    expect(settings.channelId).toBeNull();
    expect(settings.templateId).toBe('Default Welcome');
  });

  it('saves and retrieves welcome settings', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    await service.saveWelcome({
      enabled: true,
      channelId: '1234567890123456789',
      messageType: 'text',
      templateId: 'Custom Welcome',
      mentionUser: true,
      deleteIfUserLeavesBeforeSend: true,
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    });
    const settings = await service.getWelcome();
    expect(settings.enabled).toBe(true);
    expect(settings.channelId).toBe('1234567890123456789');
    expect(settings.templateId).toBe('Custom Welcome');
  });

  it('returns default leave settings when none are stored', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    const settings = await service.getLeave();
    expect(settings.enabled).toBe(false);
    expect(settings.channelId).toBeNull();
    expect(settings.templateId).toBe('Leave Message');
  });

  it('saves and retrieves leave settings', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    await service.saveLeave({
      enabled: true,
      channelId: '9876543210987654321',
      messageType: 'embed',
      templateId: 'Custom Leave',
      autoDeleteEnabled: true,
      autoDeleteAfterSeconds: 60,
    });
    const settings = await service.getLeave();
    expect(settings.enabled).toBe(true);
    expect(settings.channelId).toBe('9876543210987654321');
    expect(settings.messageType).toBe('embed');
  });

  it('returns default DM settings when none are stored', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    const settings = await service.getDm();
    expect(settings.enabled).toBe(false);
    expect(settings.fallbackIfDmClosed).toBe(false);
    expect(settings.templateId).toBe('DM Welcome');
  });

  it('saves and retrieves DM settings', async () => {
    const storage = createMockStorage();
    const service = new WelcomeSettingsService(storage);
    await service.saveDm({
      enabled: true,
      messageType: 'text',
      templateId: 'Custom DM',
      fallbackIfDmClosed: true,
      fallbackChannelId: '5555555555555555555',
    });
    const settings = await service.getDm();
    expect(settings.enabled).toBe(true);
    expect(settings.fallbackIfDmClosed).toBe(true);
    expect(settings.fallbackChannelId).toBe('5555555555555555555');
  });
});
