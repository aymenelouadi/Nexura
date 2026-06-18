import { describe, expect, it, vi } from 'vitest';

import { WelcomeDeliveryService } from '../services/delivery-service.js';
import type { PluginContext, PluginMessageReceipt } from '@nexura/shared';
import type { CoreMessage, PluginTemplate, VisualEditorLayout } from '@nexura/types';

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
      createInvite: vi.fn(),
    },
    events: {
      on: vi.fn(() => vi.fn()),
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
      build: vi.fn((input) => input as CoreMessage),
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

describe('WelcomeDeliveryService', () => {
  it('sends a text message to a channel', async () => {
    const context = createMockContext();
    const service = new WelcomeDeliveryService(context);
    const template: PluginTemplate = {
      id: '1',
      guildId: '1111111111111111111',
      pluginId: 'welcome',
      name: 'Test',
      type: 'welcome',
      contentMode: 'text',
      content: { type: 'text', content: 'Hello [userName]!' },
      variables: ['userName'],
      previewData: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const receipt = await service.sendChannel('chan-1', template, { userName: 'Alice' });
    expect(receipt.id).toBe('msg-1');
    expect(context.messages.sendChannel).toHaveBeenCalledWith(
      'chan-1',
      { type: 'text', content: 'Hello Alice!' },
    );
  });

  it('sends a visual card to a channel', async () => {
    const context = createMockContext();
    const service = new WelcomeDeliveryService(context);
    const layout: VisualEditorLayout = {
      version: 1,
      width: 400,
      height: 200,
      backgroundColor: '#ffffff',
      elements: [
        { id: 'text-1', type: 'text', x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, fontSize: 16, fontFamily: 'Arial', fill: '#000000', text: 'Hello [userName]!' },
      ],
    };
    const template: PluginTemplate = {
      id: '2',
      guildId: '1111111111111111111',
      pluginId: 'welcome',
      name: 'Visual',
      type: 'welcome',
      contentMode: 'visual_card',
      content: layout,
      variables: ['userName'],
      previewData: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const receipt = await service.sendChannel('chan-1', template, { userName: 'Bob' });
    expect(receipt.id).toBe('msg-3');
    expect(context.messages.sendVisualCard).toHaveBeenCalledWith('chan-1', layout, { userName: 'Bob' });
  });

  it('sends a direct message', async () => {
    const context = createMockContext();
    const service = new WelcomeDeliveryService(context);
    const template: PluginTemplate = {
      id: '3',
      guildId: '1111111111111111111',
      pluginId: 'welcome',
      name: 'DM',
      type: 'welcome',
      contentMode: 'text',
      content: { type: 'text', content: 'Welcome [userName]!' },
      variables: ['userName'],
      previewData: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const receipt = await service.sendDirect('user-1', template, { userName: 'Charlie' });
    expect(receipt.id).toBe('msg-2');
    expect(context.messages.sendDirect).toHaveBeenCalledWith(
      'user-1',
      { type: 'text', content: 'Welcome Charlie!' },
    );
  });

  it('schedules a message deletion', async () => {
    const context = createMockContext();
    const service = new WelcomeDeliveryService(context);
    const receipt: PluginMessageReceipt = { id: 'msg-1', channelId: 'chan-1' };
    service.scheduleDelete(receipt, 10);
    expect(context.scheduler.schedule).toHaveBeenCalledWith(
      'delete:chan-1:msg-1',
      10_000,
      expect.any(Function),
    );
  });
});
