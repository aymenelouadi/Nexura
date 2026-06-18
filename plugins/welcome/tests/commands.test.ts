import { describe, expect, it, vi } from 'vitest';

import { registerCreateInviteCommand } from '../commands/create-invite.command.js';
import { registerSetWelcomeCommand } from '../commands/set-welcome.command.js';
import { WelcomeSettingsService } from '../services/settings-service.js';
import type { PluginContext } from '@nexura/shared';

function createMockContext(): PluginContext {
  return {
    guildId: '1111111111111111111',
    pluginId: 'welcome',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      audit: vi.fn(),
    },
    commands: {
      register: vi.fn(),
      createInvite: vi.fn(async () => 'https://discord.gg/invite123'),
    },
    events: {
      on: vi.fn(() => vi.fn()),
      getGuildInvites: vi.fn(),
    },
    variables: {
      register: vi.fn(),
      resolve: vi.fn(),
    },
    templates: {
      save: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    messages: {
      build: vi.fn(),
      sendChannel: vi.fn(),
      sendDirect: vi.fn(),
      sendVisualCard: vi.fn(),
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
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
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

describe('create-invite command', () => {
  it('registers and handles the command', async () => {
    const context = createMockContext();
    await registerCreateInviteCommand(context);
    expect(context.commands.register).toHaveBeenCalledOnce();
    const call = vi.mocked(context.commands.register).mock.calls[0];
    if (!call) throw new Error('register not called');
    const registration = call[0];
    expect(registration.name).toBe('create_invite');
    expect(registration.type).toBe('BOTH');
    expect(registration.aliases).toEqual(['invite', 'newinvite']);

    const respond = vi.fn();
    await registration.handler({
      guildId: '1111111111111111111',
      channelId: '2222222222222222222',
      userId: '3333333333333333333',
      memberRoleIds: [],
      commandId: 'create_invite',
      name: 'create_invite',
      args: [],
      options: {},
      respond,
    });
    expect(context.commands.createInvite).toHaveBeenCalledWith('2222222222222222222', { unique: true });
    expect(respond).toHaveBeenCalledWith({ type: 'text', content: 'https://discord.gg/invite123' });
    expect(context.logger.audit).toHaveBeenCalled();
  });
});

describe('set-welcome command', () => {
  it('registers and handles the command', async () => {
    const context = createMockContext();
    const storage = context.storage;
    const settingsService = new WelcomeSettingsService(storage);
    await registerSetWelcomeCommand(context, settingsService);
    expect(context.commands.register).toHaveBeenCalledOnce();
    const call = vi.mocked(context.commands.register).mock.calls[0];
    if (!call) throw new Error('register not called');
    const registration = call[0];
    expect(registration.name).toBe('setwelcome');
    expect(registration.type).toBe('BOTH');

    const respond = vi.fn();
    await registration.handler({
      guildId: '1111111111111111111',
      channelId: '2222222222222222222',
      userId: '3333333333333333333',
      memberRoleIds: [],
      commandId: 'setwelcome',
      name: 'setwelcome',
      args: ['true'],
      options: { enabled: true },
      respond,
    });
    expect(respond).toHaveBeenCalledWith({
      type: 'text',
      content: 'Welcome messages are now **enabled**.',
    });
    expect(storage.set).toHaveBeenCalledWith('settings/welcome', expect.objectContaining({ enabled: true }));
    expect(context.logger.audit).toHaveBeenCalled();
  });
});
