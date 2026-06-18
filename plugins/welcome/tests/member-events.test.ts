import { describe, expect, it, vi } from 'vitest';

import { registerMemberEvents } from '../events/member-events.js';
import { InviteTracker } from '../services/invite-tracker.js';
import { WelcomeSettingsService } from '../services/settings-service.js';
import { WelcomeTemplateService } from '../services/template-service.js';
import type { PluginContext, PluginEventPayload } from '@nexura/shared';
import type { PluginTemplate } from '@nexura/types';

function createMockContext(): PluginContext & { _handlers: Record<string, (payload: PluginEventPayload) => Promise<void> | void> } {
  const handlers: Record<string, (payload: PluginEventPayload) => Promise<void> | void> = {};
  const storageData = new Map<string, unknown>();
  return {
    guildId: '1111111111111111111',
    pluginId: 'welcome',
    _handlers: handlers,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
    },
    commands: {
      register: vi.fn(),
      createInvite: vi.fn(),
    },
    events: {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
        return vi.fn();
      }),
      getGuildInvites: vi.fn(),
    },
    variables: {
      register: vi.fn(),
      resolve: vi.fn((content: string, data: Record<string, string>) =>
        content.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/gu, (_match: string, name: string) => data[name] ?? ''),
      ),
    },
    templates: {
      save: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    messages: {
      build: vi.fn(),
      sendChannel: vi.fn(async () => ({ id: 'msg-1', channelId: 'chan-1' })),
      sendDirect: vi.fn(async () => ({ id: 'msg-2', channelId: 'dm-1' })),
      sendVisualCard: vi.fn(async () => ({ id: 'msg-3', channelId: 'chan-1' })),
      delete: vi.fn(),
    },
    embeds: {
      build: vi.fn(),
    },
    components: {
      build: vi.fn(),
    },
    permissions: {
      canManagePlugin: vi.fn(),
      canRunCommand: vi.fn(),
    },
    storage: {
      get: async <T>(key: string) => (storageData.get(key) as T | null) ?? null,
      set: async <T>(key: string, value: T) => {
        storageData.set(key, value);
      },
      delete: async () => {},
      list: async () => [],
    },
    database: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
    scheduler: {
      schedule: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
    },
  };
}

describe('member events', () => {
  it('registers guildMemberAdd and guildMemberRemove handlers', async () => {
    const context = createMockContext();
    const storage = context.storage;
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    registerMemberEvents(context, settings, templates, invites);

    expect(context.events.on).toHaveBeenCalledWith('guildMemberAdd', expect.any(Function));
    expect(context.events.on).toHaveBeenCalledWith('guildMemberRemove', expect.any(Function));
  });

  it('sends welcome message when member joins and welcome is enabled', async () => {
    const context = createMockContext();
    const storage = context.storage;
    await storage.set('settings/welcome', {
      enabled: true,
      channelId: '2222222222222222222',
      messageType: 'text',
      templateId: 'Default Welcome',
      mentionUser: true,
      deleteIfUserLeavesBeforeSend: true,
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    });
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    vi.mocked(context.templates.get).mockResolvedValue({
      id: '1',
      name: 'Default Welcome',
      type: 'welcome',
      contentMode: 'text',
      content: { type: 'text', content: 'Welcome [userName]!' },
      variables: ['userName'],
      previewData: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    } as PluginTemplate);

    vi.mocked(context.events.getGuildInvites).mockResolvedValue([
      { code: 'abc123', uses: 1, inviterId: 'user1', inviterName: 'Alice' },
    ]);

    registerMemberEvents(context, settings, templates, invites);

    const addHandler = (context as unknown as { _handlers: Record<string, (payload: PluginEventPayload) => Promise<void> | void> })._handlers['guildMemberAdd'];
    if (!addHandler) throw new Error('guildMemberAdd handler not registered');

    await addHandler({
      guildId: '1111111111111111111',
      userId: 'newuser1',
      userName: 'NewUser',
      userCreatedAt: new Date().toISOString(),
      serverName: 'Test Server',
      memberCount: '42',
    });

    expect(context.messages.sendChannel).toHaveBeenCalled();
    expect(context.logger.info).toHaveBeenCalledWith('Welcome message sent.', expect.any(Object));
  });

  it('does nothing when member joins and welcome is disabled', async () => {
    const context = createMockContext();
    const storage = context.storage;
    await storage.set('settings/welcome', {
      enabled: false,
      channelId: '2222222222222222222',
      messageType: 'text',
      templateId: 'Default Welcome',
      mentionUser: true,
      deleteIfUserLeavesBeforeSend: true,
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    });
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    registerMemberEvents(context, settings, templates, invites);

    const addHandler = context._handlers['guildMemberAdd'];
    if (!addHandler) throw new Error('guildMemberAdd handler not registered');

    await addHandler({
      guildId: '1111111111111111111',
      userId: 'newuser1',
      userName: 'NewUser',
      userCreatedAt: new Date().toISOString(),
      serverName: 'Test Server',
      memberCount: '42',
    });

    expect(context.messages.sendChannel).not.toHaveBeenCalled();
    expect(context.messages.sendDirect).not.toHaveBeenCalled();
  });

  it('sends leave message when member leaves and leave is enabled', async () => {
    const context = createMockContext();
    const storage = context.storage;
    await storage.set('settings/leave', {
      enabled: true,
      channelId: '3333333333333333333',
      messageType: 'text',
      templateId: 'Leave Message',
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    });
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    vi.mocked(context.templates.get).mockImplementation(async (name: string) =>
      name === 'Leave Message'
        ? ({
            id: '2',
            name: 'Leave Message',
            type: 'leave',
            contentMode: 'text',
            content: { type: 'text', content: '[userName] left.' },
            variables: ['userName'],
            previewData: {},
            version: 1,
            updatedAt: new Date().toISOString(),
          } as PluginTemplate)
        : null,
    );

    registerMemberEvents(context, settings, templates, invites);

    const removeHandler = context._handlers['guildMemberRemove'];
    if (!removeHandler) throw new Error('guildMemberRemove handler not registered');

    await removeHandler({
      guildId: '1111111111111111111',
      userId: 'leavinguser1',
      userName: 'LeavingUser',
      userCreatedAt: new Date().toISOString(),
      serverName: 'Test Server',
      memberCount: '41',
    });

    expect(context.messages.sendChannel).toHaveBeenCalledWith('3333333333333333333', { type: 'text', content: 'LeavingUser left.' });
    expect(context.logger.info).toHaveBeenCalledWith('Leave message sent.', expect.any(Object));
  });

  it('sends DM welcome when enabled and DM succeeds', async () => {
    const context = createMockContext();
    const storage = context.storage;
    await storage.set('settings/dm', {
      enabled: true,
      messageType: 'text',
      templateId: 'DM Welcome',
      fallbackIfDmClosed: false,
      fallbackChannelId: null,
    });
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    vi.mocked(context.templates.get).mockImplementation(async (name: string) =>
      name === 'DM Welcome'
        ? ({
            id: '3',
            name: 'DM Welcome',
            type: 'dm',
            contentMode: 'text',
            content: { type: 'text', content: 'Hello [userName]!' },
            variables: ['userName'],
            previewData: {},
            version: 1,
            updatedAt: new Date().toISOString(),
          } as PluginTemplate)
        : null,
    );

    registerMemberEvents(context, settings, templates, invites);

    const addHandler = context._handlers['guildMemberAdd'];
    if (!addHandler) throw new Error('guildMemberAdd handler not registered');

    await addHandler({
      guildId: '1111111111111111111',
      userId: 'newuser2',
      userName: 'NewUser2',
      userCreatedAt: new Date().toISOString(),
      serverName: 'Test Server',
      memberCount: '42',
    });

    expect(context.messages.sendDirect).toHaveBeenCalledWith('newuser2', { type: 'text', content: 'Hello NewUser2!' });
    expect(context.logger.info).toHaveBeenCalledWith('DM welcome sent.', expect.any(Object));
  });

  it('falls back to channel when DM welcome fails and fallback is enabled', async () => {
    const context = createMockContext();
    const storage = context.storage;
    await storage.set('settings/dm', {
      enabled: true,
      messageType: 'text',
      templateId: 'DM Welcome',
      fallbackIfDmClosed: true,
      fallbackChannelId: '4444444444444444444',
    });
    const settings = new WelcomeSettingsService(storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, storage, context.logger);

    vi.mocked(context.templates.get).mockImplementation(async (name: string) =>
      name === 'DM Welcome'
        ? ({
            id: '3',
            name: 'DM Welcome',
            type: 'dm',
            contentMode: 'text',
            content: { type: 'text', content: 'Hello [userName]!' },
            variables: ['userName'],
            previewData: {},
            version: 1,
            updatedAt: new Date().toISOString(),
          } as PluginTemplate)
        : null,
    );
    vi.mocked(context.messages.sendDirect).mockRejectedValue(new Error('DM closed'));

    registerMemberEvents(context, settings, templates, invites);

    const addHandler = context._handlers['guildMemberAdd'];
    if (!addHandler) throw new Error('guildMemberAdd handler not registered');

    await addHandler({
      guildId: '1111111111111111111',
      userId: 'newuser3',
      userName: 'NewUser3',
      userCreatedAt: new Date().toISOString(),
      serverName: 'Test Server',
      memberCount: '42',
    });

    expect(context.messages.sendChannel).toHaveBeenCalledWith('4444444444444444444', { type: 'text', content: 'Hello NewUser3!' });
    expect(context.logger.warn).toHaveBeenCalledWith('DM welcome failed.', expect.any(Object));
  });
});
