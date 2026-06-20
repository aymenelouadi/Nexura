import type { GuildPluginDetail } from '@nexura/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api-client.js';
import { SelectedGuildProvider } from '../state/selected-guild-context.js';
import { PluginDetailPage } from './plugin-detail-page.js';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const guildId = '1111111111111111111';

const welcomePlugin: GuildPluginDetail = {
  id: 'welcome',
  name: 'Welcome',
  description: 'Greet new members',
  version: '1.0.0',
  author: 'Nexura',
  status: 'INSTALLED',
  enabled: true,
  guildStatus: 'ENABLED',
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  dashboard: {
    enabled: true,
    route: '/plugins/welcome',
    label: 'Welcome',
    icon: 'Sparkles',
    tabs: ['overview', 'welcome', 'leave', 'dm', 'templates', 'commands', 'logs'],
  },
  dashboardContent: {
    mode: 'schema',
    bundleUrl: null,
    assetsBaseUrl: `/api/v1/guilds/${guildId}/plugins/welcome/assets`,
    errors: [],
    schema: {
      version: 1,
      contentMode: 'schema',
      defaults: {
        'settings.welcome.enabled': false,
        'settings.welcome.channelId': null,
        'settings.welcome.messageType': 'text',
        'settings.welcome.templateId': 'Default Welcome',
      },
      previewVariables: { user: '@Mira', serverName: 'Nexura Labs' },
      defaultMessages: {
        'Default Welcome': { type: 'text', content: 'Welcome [user] to [serverName]!' },
      },
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          sections: [{ id: 'overview.summary', title: 'Welcome automation', fields: [], actions: [] }],
        },
        {
          id: 'welcome',
          label: 'Welcome',
          sections: [
            {
              id: 'welcome.settings',
              title: 'Welcome messages',
              fields: [
                {
                  id: 'welcome.enabled',
                  type: 'switch',
                  label: 'Enable welcome messages',
                  storageKey: 'settings',
                  path: 'welcome.enabled',
                  defaultValue: false,
                },
                {
                  id: 'welcome.channel',
                  type: 'channel_select',
                  label: 'Welcome channel',
                  storageKey: 'settings',
                  path: 'welcome.channelId',
                  defaultValue: null,
                },
                {
                  id: 'welcome.messageType',
                  type: 'select',
                  label: 'Message type',
                  storageKey: 'settings',
                  path: 'welcome.messageType',
                  defaultValue: 'text',
                  options: [{ label: 'Text', value: 'text' }],
                },
                {
                  id: 'welcome.composer',
                  type: 'message_composer',
                  label: 'Message composer',
                  storageKey: 'templates',
                  path: 'Default Welcome',
                  templateType: 'welcome',
                },
              ],
              actions: [
                { id: 'welcome.save', type: 'save_storage', label: 'Save welcome settings', storageKeys: ['settings'] },
                {
                  id: 'welcome.test',
                  type: 'test_template',
                  label: 'Send test welcome message',
                  templateNamePath: 'welcome.templateId',
                  channelIdPath: 'welcome.channelId',
                },
              ],
            },
          ],
        },
        { id: 'leave', label: 'Leave', sections: [{ id: 'leave.settings', title: 'Leave messages', fields: [], actions: [] }] },
        { id: 'dm', label: 'DM', sections: [{ id: 'dm.settings', title: 'DM Welcome', fields: [], actions: [] }] },
        { id: 'templates', label: 'Templates', sections: [{ id: 'templates.manager', title: 'Templates', fields: [], actions: [] }] },
        { id: 'commands', label: 'Commands', sections: [{ id: 'commands.manager', title: 'Commands', fields: [], actions: [] }] },
        { id: 'logs', label: 'Logs', sections: [{ id: 'logs.manager', title: 'Welcome plugin logs', fields: [], actions: [] }] },
      ],
    },
  },
};

function renderPage(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SelectedGuildProvider>
        <MemoryRouter initialEntries={[`/dashboard/${guildId}/plugins/welcome`]}>
          <Routes>
            <Route path="/dashboard/:guildId/plugins/:pluginId" element={element} />
            <Route path="/dashboard/:guildId/plugins" element={<div />} />
          </Routes>
        </MemoryRouter>
      </SelectedGuildProvider>
    </QueryClientProvider>,
  );
}

describe('PluginDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getGuild').mockResolvedValue({
      id: guildId,
      name: 'Test Guild',
      icon: null,
      memberCount: 100,
      canManage: true,
      isOwner: true,
      hasAdmin: false,
      hasManager: false,
      botConnected: true,
      action: 'manage',
      permissionRole: 'OWNER',
    });
    vi.spyOn(api, 'getGuilds').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'getGuildPlugin').mockResolvedValue(welcomePlugin);
    vi.spyOn(api, 'getGuildPluginStorage').mockResolvedValue({ value: {} });
    vi.spyOn(api, 'getGuildPluginTemplates').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'getGuildChannels').mockResolvedValue({ data: [{ id: '2222222222222222222', name: 'welcome', type: 0 }] });
    vi.spyOn(api, 'getBotProfile').mockResolvedValue({
      username: 'Nexura',
      avatarUrl: null,
      id: '3333333333333333333',
      discriminator: null,
    });
    vi.spyOn(api, 'getGuildPluginLogs').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Welcome tab content from dashboard schema', async () => {
    const user = userEvent.setup();
    renderPage(<PluginDetailPage />);

    await user.click(await screen.findByRole('tab', { name: /welcome/i }));

    expect(await screen.findByText('Welcome messages')).toBeInTheDocument();
    expect(screen.getByText('Enable welcome messages')).toBeInTheDocument();
    expect(screen.getByText('Message composer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send test welcome message/i })).toBeInTheDocument();
  });

  it('switches tabs and renders schema content', async () => {
    const user = userEvent.setup();
    renderPage(<PluginDetailPage />);

    await user.click(await screen.findByRole('tab', { name: /leave/i }));

    expect(await screen.findByText('Leave messages')).toBeInTheDocument();
  });

  it('shows an error state when dashboard content is missing', async () => {
    vi.mocked(api.getGuildPlugin).mockResolvedValue({
      ...welcomePlugin,
      dashboardContent: {
        mode: 'none',
        schema: null,
        bundleUrl: null,
        assetsBaseUrl: null,
        errors: ['Plugin dashboard is enabled but no dashboard.schema.json was found.'],
      },
    });

    renderPage(<PluginDetailPage />);

    const error = await screen.findByTestId('plugin-dashboard-error');
    expect(error).toHaveTextContent('Plugin dashboard failed to load');
    expect(error).toHaveTextContent('welcome');
    expect(error).toHaveTextContent('no dashboard.schema.json was found');
  });

  it('renders generated schema tabs for plugins without dashboard.schema.json', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getGuildPlugin).mockResolvedValue({
      ...welcomePlugin,
      dashboardContent: {
        mode: 'schema',
        schema: {
          version: 1,
          contentMode: 'schema',
          defaults: {},
          previewVariables: {},
          defaultMessages: {},
          tabs: [
            {
              id: 'overview',
              label: 'Overview',
              description: 'Generated by Nexura Core because this plugin package did not include dashboard.schema.json.',
              sections: [
                {
                  id: 'overview.generated',
                  title: 'Overview management',
                  description: 'Greet new members',
                  fields: [],
                  actions: [],
                },
              ],
            },
          ],
        },
        bundleUrl: null,
        assetsBaseUrl: `/api/v1/guilds/${guildId}/plugins/welcome/assets`,
        errors: ['dashboard.schema.json was not found; Nexura generated a basic management dashboard from plugin metadata.'],
      },
    });

    renderPage(<PluginDetailPage />);

    await user.click(await screen.findByRole('tab', { name: /overview/i }));

    expect(await screen.findByText('Overview management')).toBeInTheDocument();
    expect(screen.getByText('Managed by Core')).toBeInTheDocument();
  });
});
