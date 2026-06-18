import { describe, expect, it, vi } from 'vitest';

import { InviteTracker, unavailableInvite } from '../services/invite-tracker.js';
import type { PluginEvents, PluginInvite, PluginLogger, PluginStorage } from '@nexura/shared';

describe('InviteTracker', () => {
  function createMockDeps(invites: PluginInvite[]) {
    const storageData = new Map<string, unknown>();
    const storage: PluginStorage = {
      get: async <T>(key: string) => (storageData.get(key) as T | null) ?? null,
      set: vi.fn(async <T>(key: string, value: T) => {
        storageData.set(key, value);
      }),
      delete: vi.fn(),
      list: vi.fn(),
    };
    const events: PluginEvents = {
      on: vi.fn(() => vi.fn()),
      getGuildInvites: vi.fn(async () => invites),
    };
    const logger: PluginLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
    };
    return { storage, events, logger };
  }

  it('primes invite cache on first call', async () => {
    const { storage, events, logger } = createMockDeps([
      { code: 'abc123', uses: 5, inviterId: 'user1', inviterName: 'Alice' },
    ]);
    const tracker = new InviteTracker(events, storage, logger);
    await tracker.prime();
    expect(events.getGuildInvites).toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith('invite-cache', [
      { code: 'abc123', uses: 5, inviterId: 'user1', inviterName: 'Alice' },
    ]);
  });

  it('resolves the used invite by comparing snapshots', async () => {
    const { storage, events, logger } = createMockDeps([
      { code: 'abc123', uses: 6, inviterId: 'user1', inviterName: 'Alice' },
    ]);
    const tracker = new InviteTracker(events, storage, logger);
    await storage.set('invite-cache', [
      { code: 'abc123', uses: 5, inviterId: 'user1', inviterName: 'Alice' },
    ]);
    const resolved = await tracker.resolveUsedInvite();
    expect(resolved.inviter).toBe('<@user1>');
    expect(resolved.inviterName).toBe('Alice');
    expect(resolved.invitesCount).toBe('6');
    expect(resolved.inviteCode).toBe('abc123');
  });

  it('returns unavailable when no invite usage increased', async () => {
    const { storage, events, logger } = createMockDeps([
      { code: 'abc123', uses: 5, inviterId: 'user1', inviterName: 'Alice' },
    ]);
    const tracker = new InviteTracker(events, storage, logger);
    await storage.set('invite-cache', [
      { code: 'abc123', uses: 5, inviterId: 'user1', inviterName: 'Alice' },
    ]);
    const resolved = await tracker.resolveUsedInvite();
    expect(resolved).toEqual(unavailableInvite);
  });

  it('returns unavailable when getGuildInvites fails', async () => {
    const { storage, events, logger } = createMockDeps([]);
    events.getGuildInvites = vi.fn(async () => {
      throw new Error('Network error');
    });
    const tracker = new InviteTracker(events, storage, logger);
    const resolved = await tracker.resolveUsedInvite();
    expect(resolved).toEqual(unavailableInvite);
    expect(logger.warn).toHaveBeenCalled();
  });
});
