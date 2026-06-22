import type { ComponentsV2Item, CoreMessage } from '@nexura/types';

import type { AllowedMentions } from '@nexura/core';

import {
  formatTimestamp,
  sanitizeContent,
  resolveTemplateString,
} from './content-utils.js';

export interface LogVariables {
  user?: string | undefined;
  userId?: string | undefined;
  userName?: string | undefined;
  userDisplayName?: string | undefined;
  userAvatar?: string | null | undefined;
  executor?: string | undefined;
  executorId?: string | undefined;
  executorName?: string | undefined;
  executorDisplayName?: string | undefined;
  executorAvatar?: string | null | undefined;
  channel?: string | undefined;
  channelId?: string | undefined;
  channelName?: string | undefined;
  role?: string | undefined;
  roleId?: string | undefined;
  roleName?: string | undefined;
  roleColor?: number | undefined;
  messageId?: string | undefined;
  messageContent?: string | undefined;
  oldContent?: string | undefined;
  newContent?: string | undefined;
  reason?: string | null | undefined;
  guildName?: string | undefined;
  guildId?: string | undefined;
  guildMemberCount?: number | undefined;
  serverName?: string | undefined;
  serverId?: string | undefined;
  memberCount?: number | undefined;
  timestamp?: string | undefined;
}

export interface FormatterOptions {
  type: string;
  title: string;
  description: string;
  footer?: string | undefined;
  color: number;
  format: 'embed' | 'components_v2';
  showTimestamp: boolean;
  showAvatar: boolean;
  variables: LogVariables;
}

export interface FormattedLog {
  message: CoreMessage;
  allowedMentions: AllowedMentions;
}

export function computeAllowedMentions(variables: LogVariables): AllowedMentions {
  const users: string[] = [];
  const roles: string[] = [];

  if (variables.userId) users.push(variables.userId);
  if (variables.executorId) users.push(variables.executorId);
  if (variables.roleId) roles.push(variables.roleId);

  return {
    parse: [],
    users: Array.from(new Set(users)),
    roles: Array.from(new Set(roles)),
  };
}

export function resolveVariable(name: string, variables: LogVariables): unknown {
  const direct = variables[name as keyof LogVariables];
  if (direct !== undefined && direct !== '') return direct;

  if (name === 'user') return variables.user;
  if (name === 'user.name') return variables.userDisplayName ?? variables.userName ?? variables.user;
  if (name === 'user.tag') return variables.userName;
  if (name === 'user.id') return variables.userId;

  if (name === 'executor') return variables.executor;
  if (name === 'executor.name') return variables.executorDisplayName ?? variables.executorName ?? variables.executor;
  if (name === 'executor.tag') return variables.executorName;
  if (name === 'executor.id') return variables.executorId;

  if (name === 'channel') return variables.channel;
  if (name === 'channel.name') return variables.channelName ?? variables.channel;
  if (name === 'channel.id') return variables.channelId;

  if (name === 'role') return variables.role;
  if (name === 'role.name') return variables.roleName ?? variables.role;
  if (name === 'role.id') return variables.roleId;

  if (name === 'message.content') return variables.messageContent ?? variables.newContent;
  if (name === 'message.id') return variables.messageId;

  if (name === 'guild.name') return variables.guildName ?? variables.serverName;
  if (name === 'guild.id') return variables.guildId ?? variables.serverId;
  if (name === 'guild.memberCount') return variables.guildMemberCount ?? variables.memberCount;

  if (name === 'server.name') return variables.serverName ?? variables.guildName;
  if (name === 'server.id') return variables.serverId ?? variables.guildId;
  if (name === 'server.memberCount') return variables.memberCount ?? variables.guildMemberCount;

  return undefined;
}

export function resolveFallback(name: string): string {
  if (name.startsWith('message.') || name.startsWith('guild.') || name.startsWith('server.')) {
    return 'Unavailable';
  }
  return 'Unknown';
}

export function resolveTemplate(template: string, variables: LogVariables): string {
  return resolveTemplateString(template, (name) => {
    const value = resolveVariable(name, variables);
    if (value === undefined || value === null || value === '') {
      return resolveFallback(name);
    }
    return String(value);
  });
}

export function formatLogMessage(options: FormatterOptions): FormattedLog {
  const { format, title, description, footer, color, showTimestamp, showAvatar, variables } = {
    ...options,
    description: sanitizeContent(options.description),
  };

  const resolvedTitle = resolveTemplate(title, variables);
  const resolvedDescription = resolveTemplate(description, variables);
  const resolvedFooter = footer ? resolveTemplate(footer, variables) : undefined;
  const timestamp = showTimestamp ? formatTimestamp() : undefined;
  const avatarUrl = showAvatar ? variables.userAvatar ?? variables.executorAvatar : undefined;
  const allowedMentions = computeAllowedMentions(variables);

  if (format === 'components_v2') {
    const items: ComponentsV2Item[] = [
      { type: 'text_display', content: `**${resolvedTitle}**` },
      { type: 'text_display', content: resolvedDescription },
    ];
    if (timestamp) {
      items.push({ type: 'text_display', content: `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:F>` });
    }
    if (resolvedFooter) {
      items.push({ type: 'text_display', content: `_${resolvedFooter}_` });
    }

    return {
      message: {
        type: 'components_v2',
        components: [{ type: 'container', spoiler: false, items }],
      },
      allowedMentions,
    };
  }

  return {
    message: {
      type: 'embed',
      title: resolvedTitle,
      description: resolvedDescription,
      color,
      fields: [],
      ...(timestamp ? { timestamp } : {}),
      ...(resolvedFooter || avatarUrl
        ? {
            footer: {
              text: resolvedFooter || ' ',
              iconSource: avatarUrl ? 'custom' : 'none',
              iconUrl: avatarUrl ?? undefined,
            },
          }
        : {}),
    },
    allowedMentions,
  };
}
