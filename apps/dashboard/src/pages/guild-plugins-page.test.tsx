import type { GuildPlugin } from '@nexura/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api-client.js';
import { SelectedGuildProvider } from '../state/selected-guild-context.js';
import { GuildPluginsPage } from './guild-plugins-page.js';

const mockGuildId = '1111111111111111111';

const welcomePlugin: GuildPlugin = {
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
  dashboard: { enabled: true, route: 'welcome', label: 'Welcome', icon: 'smile', tabs: [] },
};

const ticketsPlugin: GuildPlugin = {
  id: 'tickets',
  name: 'Tickets',
  description: 'Support tickets',
  version: '1.0.0',
  author: 'Nexura',
  status: 'INSTALLED',
  enabled: false,
  guildStatus: 'DISABLED',
  installedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  dashboard: null,
};

const mockPlugins: GuildPlugin[] = [welcomePlugin, ticketsPlugin];

function renderPage(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SelectedGuildProvider>
        <MemoryRouter initialEntries={[`/dashboard/${mockGuildId}/plugins`]}>
          <Routes>
            <Route path="/dashboard/:guildId/plugins" element={element} />
            <Route path="/dashboard/:guildId/plugins/:pluginId" element={<div data-testid="plugin-detail" />} />
          </Routes>
        </MemoryRouter>
      </SelectedGuildProvider>
    </QueryClientProvider>,
  );
}

describe('GuildPluginsPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getGuildPlugins').mockResolvedValue({ data: mockPlugins });
    vi.spyOn(api, 'getGuild').mockResolvedValue({
      id: mockGuildId,
      name: 'Test Guild',
      icon: null,
      canManage: true,
      isOwner: true,
      hasAdmin: false,
      hasManager: false,
      botConnected: true,
      action: 'manage',
      permissionRole: 'OWNER',
    });
    vi.spyOn(api, 'getGuilds').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the plugin manager with a search input and upload button', async () => {
    renderPage(<GuildPluginsPage />);
    await waitFor(() => expect(screen.getByTestId('plugin-row-welcome')).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/search plugins/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload plugin/i })).toBeInTheDocument();
  });

  it('filters plugins by search term', async () => {
    const user = userEvent.setup();
    renderPage(<GuildPluginsPage />);
    await waitFor(() => expect(screen.getByTestId('plugin-row-welcome')).toBeInTheDocument());
    const search = screen.getByPlaceholderText(/search plugins/i);
    await user.type(search, 'ticket');
    await waitFor(() => expect(screen.queryByTestId('plugin-row-welcome')).not.toBeInTheDocument());
    expect(screen.getByTestId('plugin-row-tickets')).toBeInTheDocument();
  });

  it('opens the upload dialog when the upload button is clicked', async () => {
    const user = userEvent.setup();
    renderPage(<GuildPluginsPage />);
    const uploadButton = await screen.findByRole('button', { name: /upload plugin/i });
    await user.click(uploadButton);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('toggles a plugin and refreshes the list', async () => {
    const user = userEvent.setup();
    const disableMock = vi.spyOn(api, 'disableGuildPlugin').mockResolvedValue(welcomePlugin);
    renderPage(<GuildPluginsPage />);
    const welcomeRow = await screen.findByTestId('plugin-row-welcome');
    const toggle = within(welcomeRow).getByRole('button', { name: /disable/i });
    await user.click(toggle);
    await waitFor(() => expect(disableMock).toHaveBeenCalledWith(mockGuildId, 'welcome'));
  });

  it('navigates to plugin manage page from the actions menu', async () => {
    const user = userEvent.setup();
    renderPage(<GuildPluginsPage />);
    const welcomeRow = await screen.findByTestId('plugin-row-welcome');
    const menuButton = within(welcomeRow).getByRole('button', { name: '' });
    await user.click(menuButton);
    const manageButton = await screen.findByRole('menuitem', { name: /manage welcome/i });
    await user.click(manageButton);
    await waitFor(() => expect(screen.getByTestId('plugin-detail')).toBeInTheDocument());
  });
});
