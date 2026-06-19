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
import type { ReactNode } from 'react';

import { ErrorState } from '../components/error-state.js';
import { PluginDashboardShell } from '../components/plugin-dashboard-shell.js';
import { guildPluginsQuery } from '../hooks/queries.js';
import { useGuildWorkspace } from '../hooks/use-guild-workspace.js';
import { api } from '../lib/api-client.js';
import { getGuildPluginsPath } from '../lib/guild-actions.js';
import { getPluginContentMap } from '../plugins/plugin-dashboard-registry.js';

export function PluginDetailPage() {
  const navigate = useNavigate();
  const { guildId = '', pluginId = '' } = useParams<{ guildId: string; pluginId: string }>();
  const { guild } = useGuildWorkspace();

  const plugins = useQuery({
    ...guildPluginsQuery(guildId),
    enabled: guild.data?.botConnected === true && /^\d{17,20}$/.test(guildId),
  });

  const plugin = plugins.data?.data.find((p) => p.id === pluginId);

  if (guild.isLoading || plugins.isLoading) {
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
  if (plugins.isError) {
    return <ErrorState message={(plugins.error as Error).message} onRetry={() => void plugins.refetch()} />;
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

  const defaultTabs = ['overview', 'settings', 'commands', 'logs'];
  const pluginTabs = plugin.dashboard?.tabs?.length ? plugin.dashboard.tabs : defaultTabs;

  const pluginContentMap = getPluginContentMap(pluginId, guildId);
  const contentMap: Record<string, ReactNode> = {
    overview: pluginContentMap?.overview ?? <OverviewPlaceholder plugin={plugin} />,
    settings: pluginContentMap?.settings ?? <SettingsPlaceholder plugin={plugin} />,
    commands: pluginContentMap?.commands ?? <CommandsPlaceholder plugin={plugin} />,
    logs: <PluginLogsTab guildId={guildId} pluginId={pluginId} />,
    ...pluginContentMap,
  };

  return (
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
