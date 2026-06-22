import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LogsPluginDashboard } from '@nexura/plugin-logs/dashboard';
import type { CoreMessage, GuildPlugin } from '@nexura/types';

import { botProfileQuery, guildChannelsQuery, guildPluginStorageQuery } from '../hooks/queries.js';
import { api } from '../lib/api-client.js';
import { CoreSwitch } from './core-switch.js';
import { DiscordMessagePreview } from './discord-message-preview.js';
import { ErrorState } from './error-state.js';

export function LogsPluginDashboardWrapper({ guildId, plugin }: { guildId: string; plugin: GuildPlugin }) {
  const queryClient = useQueryClient();
  const storage = useQuery(guildPluginStorageQuery(guildId, plugin.id, 'settings'));
  const channels = useQuery(guildChannelsQuery(guildId));
  const botProfile = useQuery(botProfileQuery);

  const save = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      await api.setGuildPluginStorage(guildId, plugin.id, 'settings', settings);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['guilds', guildId, 'plugins', plugin.id, 'storage', 'settings'],
      });
    },
  });

  const testLog = useMutation({
    mutationFn: async (opts: {
      logId: string;
      channelId: string;
      message: CoreMessage;
      allowedMentions?: { parse: string[]; users: string[]; roles: string[] };
    }) => {
      await api.testGuildPluginLog(guildId, plugin.id, {
        channelId: opts.channelId,
        message: opts.message,
        allowedMentions: opts.allowedMentions,
      });
    },
  });

  return (
    <LogsPluginDashboard
      guildId={guildId}
      plugin={plugin}
      settings={(storage.data?.value ?? {}) as Parameters<typeof LogsPluginDashboard>[0]['settings']}
      channels={channels.data?.data ?? []}
      botName={botProfile.data?.username ?? 'Nexura'}
      botAvatarUrl={botProfile.data?.avatarUrl}
      isLoading={storage.isLoading || channels.isLoading}
      isError={storage.isError || channels.isError}
      errorMessage={
        storage.isError ? (storage.error as Error).message
        : channels.isError ? (channels.error as Error).message
        : undefined
      }
      onRetry={() => { void storage.refetch(); void channels.refetch(); }}
      onSave={async (settings) => { await save.mutateAsync(settings as unknown as Record<string, unknown>); }}
      isSaving={save.isPending}
      onTestLog={async (opts) => { await testLog.mutateAsync(opts); }}
      isTesting={testLog.isPending}
      CoreSwitchComponent={CoreSwitch}
      DiscordMessagePreviewComponent={DiscordMessagePreview}
      ErrorStateComponent={ErrorState}
    />
  );
}
