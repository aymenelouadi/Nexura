import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
} from '@nexura/ui';
import type { GuildPlugin } from '@nexura/types';
import { useQuery } from '@tanstack/react-query';
import {
  ArchiveIcon,
  FileClockIcon,
  MonitorIcon,
  PowerOffIcon,
  SettingsIcon,
  TerminalIcon,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Component, type ReactNode } from 'react';

import { ErrorState } from '../components/error-state.js';
import { PluginDashboardShell } from '../components/plugin-dashboard-shell.js';
import { PluginSchemaDashboard } from '../components/plugin-schema-dashboard.js';
import { guildPluginQuery } from '../hooks/queries.js';
import { useGuildWorkspace } from '../hooks/use-guild-workspace.js';
import { api } from '../lib/api-client.js';
import { getGuildPluginsPath } from '../lib/guild-actions.js';

export function PluginDetailPage() {
  const navigate = useNavigate();
  const { guildId = '', pluginId = '' } = useParams<{ guildId: string; pluginId: string }>();
  const { guild } = useGuildWorkspace();

  const pluginDetail = useQuery({
    ...guildPluginQuery(guildId, pluginId),
    enabled: guild.data?.botConnected === true && /^\d{17,20}$/.test(guildId),
  });

  const plugin = pluginDetail.data;

  if (guild.isLoading || pluginDetail.isLoading) {
    return <PluginDetailSkeleton />;
  }
  if (guild.isError) {
    return <ErrorState message={(guild.error as Error).message} onRetry={() => void guild.refetch()} />;
  }
  if (!guild.data || !guild.data.botConnected) {
    return (
      <ErrorState
        title="Bot connection required"
        message="Connect the Nexura bot to access plugin dashboards."
        onRetry={() => navigate('/dashboard')}
      />
    );
  }
  if (pluginDetail.isError) {
    return <ErrorState message={(pluginDetail.error as Error).message} onRetry={() => void pluginDetail.refetch()} />;
  }
  if (!plugin) {
    return (
      <Empty className="min-h-96 border-solid bg-card">
        <EmptyHeader>
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ArchiveIcon className="size-5" />
          </span>
          <EmptyTitle className="text-base">Plugin not found</EmptyTitle>
          <EmptyDescription>
            No installed plugin matches &quot;{pluginId}&quot; on this server.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!plugin.enabled) {
    return (
      <Empty className="min-h-96 border-solid bg-card">
        <EmptyHeader>
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PowerOffIcon className="size-5" />
          </span>
          <EmptyTitle className="text-base">{plugin.name} is disabled</EmptyTitle>
          <EmptyDescription>
            Enable this plugin to access its dashboard.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!plugin.dashboard) {
    return (
      <Empty className="min-h-96 border-solid bg-card">
        <EmptyHeader>
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MonitorIcon className="size-5" />
          </span>
          <EmptyTitle className="text-base">No dashboard available</EmptyTitle>
          <EmptyDescription>
            {plugin.name} does not expose a dashboard page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const schema = plugin.dashboardContent.schema;
  const defaultTabs = schema?.tabs.map((tab) => tab.id) ?? ['overview', 'settings', 'commands', 'logs'];
  const pluginTabs = plugin.dashboard?.tabs?.length ? plugin.dashboard.tabs : defaultTabs;
  const schemaContentMap = schema
    ? Object.fromEntries(
        schema.tabs.map((tab) => [
          tab.id,
          <PluginSchemaDashboard key={tab.id} guildId={guildId} pluginId={pluginId} schema={schema} tabId={tab.id} />,
        ]),
      )
    : {};
  const contentMap: Record<string, ReactNode> = {
    overview: <OverviewPlaceholder plugin={plugin} />,
    settings: <SettingsPlaceholder plugin={plugin} />,
    ...schemaContentMap,
    commands: schemaContentMap.commands ?? <CommandsPlaceholder plugin={plugin} />,
    logs: <PluginLogsTab guildId={guildId} pluginId={pluginId} />,
  };

  if (plugin.dashboardContent.mode === 'none' && plugin.dashboardContent.errors.length > 0) {
    contentMap[pluginTabs[0] ?? 'overview'] = (
      <PluginDashboardError
        pluginId={pluginId}
        tabId={pluginTabs[0] ?? 'overview'}
        message={plugin.dashboardContent.errors.join('\n')}
      />
    );
  }

  return (
    <PluginContentErrorBoundary pluginId={pluginId} tabId={pluginTabs[0] ?? 'overview'}>
      <PluginDashboardShell
        guildId={guildId}
        pluginId={pluginId}
        pluginName={plugin.name}
        pluginVersion={plugin.version}
        pluginDashboard={plugin.dashboard}
        pluginEnabled={plugin.enabled}
        onBack={() => navigate(getGuildPluginsPath(guildId))}
        tabs={pluginTabs}
        contentMap={contentMap}
      />
    </PluginContentErrorBoundary>
  );
}

class PluginContentErrorBoundary extends Component<
  { pluginId: string; tabId: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return <PluginDashboardError pluginId={this.props.pluginId} tabId={this.props.tabId} message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function PluginDashboardError({ pluginId, tabId, message }: { pluginId: string; tabId: string; message: string }) {
  return (
    <div data-testid="plugin-dashboard-error" className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <h2 className="text-base font-semibold text-destructive">Plugin dashboard failed to load</h2>
      <dl className="mt-3 grid gap-2 text-sm">
        <div><dt className="font-medium">Plugin</dt><dd>{pluginId}</dd></div>
        <div><dt className="font-medium">Tab</dt><dd>{tabId}</dd></div>
        <div><dt className="font-medium">Details</dt><dd>{message}</dd></div>
      </dl>
      <button type="button" className="mt-4 text-sm font-medium text-destructive underline" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}

function OverviewPlaceholder({ plugin }: { plugin: GuildPlugin }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About {plugin.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>{plugin.description}</p>
        <p>Version: {plugin.version}</p>
        <p>Author: {plugin.author}</p>
        <p className="mt-6 italic">
          This plugin dashboard page is ready for real {plugin.name} settings in Phase 3.
        </p>
      </CardContent>
    </Card>
  );
}

function SettingsPlaceholder({ plugin }: { plugin: GuildPlugin }) {
  return (
    <Empty className="min-h-64 border-dashed border-border">
      <EmptyHeader>
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SettingsIcon className="size-5" />
        </span>
        <EmptyTitle className="text-base">Plugin settings</EmptyTitle>
        <EmptyDescription>
          {plugin.name} settings will be available when the plugin defines its configuration schema.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CommandsPlaceholder({ plugin }: { plugin: GuildPlugin }) {
  return (
    <Empty className="min-h-64 border-dashed border-border">
      <EmptyHeader>
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <TerminalIcon className="size-5" />
        </span>
        <EmptyTitle className="text-base">Commands</EmptyTitle>
        <EmptyDescription>
          {plugin.name} commands and their per-guild customizations will appear here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function PluginLogsTab({ guildId, pluginId }: { guildId: string; pluginId: string }) {
  const logs = useQuery({
    queryKey: ['guilds', guildId, 'plugins', pluginId, 'logs'],
    queryFn: () => api.getGuildPluginLogs(guildId, pluginId),
  });

  if (logs.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (logs.isError) {
    return <ErrorState message={logs.error.message} onRetry={() => void logs.refetch()} />;
  }

  const entries = logs.data?.data ?? [];
  if (entries.length === 0) {
    return (
      <Empty className="min-h-64 border-dashed border-border">
        <EmptyHeader>
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileClockIcon className="size-5" />
          </span>
          <EmptyTitle className="text-base">No plugin logs</EmptyTitle>
          <EmptyDescription>
            Runtime records, command executions, and audits for this plugin will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="text-sm">Latest activity</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {entries.map((entry) => (
          <article key={entry.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[100px_1fr_auto]">
            <div>
              <Badge variant={entry.level === 'ERROR' ? 'destructive' : 'outline'}>
                {entry.level}
              </Badge>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground">{entry.message}</p>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString()}
            </time>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function PluginDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
