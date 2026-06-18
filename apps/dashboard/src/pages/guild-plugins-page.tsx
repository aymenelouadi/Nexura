import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
  Spinner,
} from '@nexura/ui';
import type { GuildPlugin } from '@nexura/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, ArrowLeftIcon, CogIcon, EyeOffIcon, PackageIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ErrorState } from '../components/error-state.js';
import { PageHeader } from '../components/page-header.js';
import { guildPluginsQuery } from '../hooks/queries.js';
import { useGuildWorkspace } from '../hooks/use-guild-workspace.js';
import { api } from '../lib/api-client.js';
import { getGuildDashboardPath, getGuildPluginPath } from '../lib/guild-actions.js';

interface PluginMutation {
  pluginId: string;
  enabled: boolean;
}

export function GuildPluginsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { guildId, guild } = useGuildWorkspace();
  const plugins = useQuery({
    ...guildPluginsQuery(guildId),
    enabled: guild.data?.botConnected === true,
  });
  const updatePlugin = useMutation({
    mutationFn: ({ pluginId, enabled }: PluginMutation) =>
      enabled
        ? api.enableGuildPlugin(guildId, pluginId)
        : api.disableGuildPlugin(guildId, pluginId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins'] });
    },
  });

  if (guild.isLoading) {
    return <PluginPageSkeleton />;
  }
  if (guild.isError) {
    return <ErrorState message={guild.error.message} onRetry={() => void guild.refetch()} />;
  }
  if (!guild.data) {
    return <PluginPageSkeleton />;
  }

  const guildData = guild.data;
  if (!guildData.botConnected) {
    return (
      <ErrorState
        title="Bot connection required"
        message="Connect the Nexura bot before managing plugins for this server."
        onRetry={() => navigate(getGuildDashboardPath(guildId))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={guildData.name}
        title="Plugins"
        description="Control metadata-only plugin registrations for this server. Plugin code execution is not enabled."
        actions={
          <Button variant="outline" onClick={() => navigate(getGuildDashboardPath(guildId))}>
            <ArrowLeftIcon data-icon="inline-start" />
            Server
          </Button>
        }
      />

      {updatePlugin.isError ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Unable to update plugin</AlertTitle>
          <AlertDescription>{updatePlugin.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {plugins.isLoading ? <PluginGridSkeleton /> : null}
      {plugins.isError ? (
        <ErrorState message={plugins.error.message} onRetry={() => void plugins.refetch()} />
      ) : null}
      {plugins.isSuccess && plugins.data.data.length === 0 ? <NoPlugins /> : null}
      {plugins.isSuccess && plugins.data.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plugins.data.data.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              guildId={guildId}
              pending={updatePlugin.isPending && updatePlugin.variables.pluginId === plugin.id}
              onChange={(enabled) => updatePlugin.mutate({ pluginId: plugin.id, enabled })}
              onManage={() => navigate(getGuildPluginPath(guildId, plugin.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PluginCard({
  plugin,
  pending,
  guildId: _guildId,
  onChange,
  onManage,
}: {
  plugin: GuildPlugin;
  pending: boolean;
  guildId: string;
  onChange: (enabled: boolean) => void;
  onManage: () => void;
}) {
  const hasRegistryError = plugin.status === 'ERROR';
  const hasDashboard = plugin.dashboard !== null && plugin.dashboard !== undefined;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-5 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PackageIcon className="size-4" aria-hidden="true" />
          </span>
          <Badge variant={plugin.enabled ? 'success' : 'outline'}>
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <CardTitle className="truncate">{plugin.name}</CardTitle>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            v{plugin.version}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-5 pb-5">
        <p className="min-h-12 text-sm leading-6 text-muted-foreground">{plugin.description}</p>
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
          <span className="text-muted-foreground">By {plugin.author}</span>
          {hasDashboard ? (
            <Badge variant="secondary">Dashboard ready</Badge>
          ) : (
            <Badge variant="outline">No dashboard</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 border-t border-border bg-muted/20 px-5 py-3">
        <Button
          size="sm"
          variant={plugin.enabled ? 'outline' : 'default'}
          className="flex-1"
          disabled={pending || hasRegistryError}
          onClick={() => onChange(!plugin.enabled)}
        >
          {pending ? (
            <Spinner />
          ) : plugin.enabled ? (
            <PowerOffIcon data-icon="inline-start" />
          ) : (
            <PowerIcon data-icon="inline-start" />
          )}
          {pending ? 'Updating' : plugin.enabled ? 'Disable' : 'Enable'}
        </Button>
        {hasDashboard ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!plugin.enabled}
            title={!plugin.enabled ? 'Enable the plugin first' : 'Open plugin dashboard'}
            onClick={onManage}
          >
            <CogIcon data-icon="inline-start" />
            Manage
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled className="shrink-0">
            <EyeOffIcon className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function NoPlugins() {
  return (
    <Empty className="min-h-72 border-solid bg-card">
      <EmptyHeader>
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <PackageIcon className="size-5" aria-hidden="true" />
        </span>
        <EmptyTitle className="text-base">No plugins registered</EmptyTitle>
        <EmptyDescription>
          Add validated manifests to the local plugin registry to make metadata available here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function PluginPageSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading plugin workspace">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <PluginGridSkeleton />
    </div>
  );
}

function PluginGridSkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading plugins"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-72 w-full" />
      ))}
    </div>
  );
}
