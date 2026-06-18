import { queryOptions } from '@tanstack/react-query';

import { api } from '../lib/api-client.js';

export const currentUserQuery = queryOptions({
  queryKey: ['current-user'],
  queryFn: api.getCurrentUser,
  retry: false,
  staleTime: 60_000,
});

export const botProfileQuery = queryOptions({
  queryKey: ['bot-profile'],
  queryFn: api.getBotProfile,
  staleTime: 300_000,
});

export const guildsQuery = queryOptions({
  queryKey: ['guilds'],
  queryFn: api.getGuilds,
  refetchOnWindowFocus: true,
  staleTime: 30_000,
});

export function guildQuery(guildId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId],
    queryFn: () => api.getGuild(guildId),
    staleTime: 30_000,
  });
}

export function guildPluginsQuery(guildId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'plugins'],
    queryFn: () => api.getGuildPlugins(guildId),
    staleTime: 15_000,
  });
}

export function guildPluginLogsQuery(guildId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'plugins', 'logs'],
    queryFn: () => api.getGuildPluginActivity(guildId),
    staleTime: 10_000,
  });
}

export function guildEmojisQuery(guildId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'emojis'],
    queryFn: () => api.getGuildEmojis(guildId),
    staleTime: 60_000,
  });
}

export function guildChannelsQuery(guildId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'channels'],
    queryFn: () => api.getGuildChannels(guildId),
    staleTime: 60_000,
  });
}

export function guildPluginStorageQuery(guildId: string, pluginId: string, key: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'plugins', pluginId, 'storage', key],
    queryFn: () => api.getGuildPluginStorage(guildId, pluginId, key),
    staleTime: 10_000,
  });
}

export function guildPluginTemplatesQuery(guildId: string, pluginId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'plugins', pluginId, 'templates'],
    queryFn: () => api.getGuildPluginTemplates(guildId, pluginId),
    staleTime: 15_000,
  });
}

export function guildPluginCommandsQuery(guildId: string, pluginId: string) {
  return queryOptions({
    queryKey: ['guilds', guildId, 'plugins', pluginId, 'commands'],
    queryFn: () => api.getGuildPluginCommands(guildId, pluginId),
    staleTime: 15_000,
  });
}
