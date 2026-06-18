import { guildPlugins, pluginLogSettings, type Database } from '@nexura/database';
import {
  CommandRegistry,
  EventRegistry,
  PluginRegistry,
  PluginRuntime,
  type PluginLogSettingsReader,
  type PluginEventName,
  type PluginEventPayload,
  type PluginScope,
  type PluginStateReader,
} from '@nexura/shared';
import type { PluginLogSettings } from '@nexura/types';
import type { Client, ClientEvents } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import type { Logger } from 'pino';

export class DatabasePluginStateReader implements PluginStateReader {
  constructor(private readonly database: Database) {}

  async isEnabled(scope: PluginScope): Promise<boolean> {
    const [row] = await this.database
      .select({ enabled: guildPlugins.enabled })
      .from(guildPlugins)
      .where(
        and(eq(guildPlugins.guildId, scope.guildId), eq(guildPlugins.pluginId, scope.pluginId)),
      )
      .limit(1);
    return row?.enabled ?? false;
  }
}

export class DatabaseLogSettingsReader implements PluginLogSettingsReader {
  constructor(private readonly database: Database) {}

  async get(scope: PluginScope): Promise<PluginLogSettings> {
    const [row] = await this.database
      .select()
      .from(pluginLogSettings)
      .where(
        and(
          eq(pluginLogSettings.guildId, scope.guildId),
          eq(pluginLogSettings.pluginId, scope.pluginId),
        ),
      )
      .limit(1);
    if (!row) {
      return {
        ...scope,
        destination: 'DASHBOARD',
        channelId: null,
        outputType: 'text',
        embedColor: null,
        updatedAt: new Date(0).toISOString(),
      };
    }
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }
}

export interface BotPluginRuntime {
  commands: CommandRegistry;
  events: EventRegistry;
  registry: PluginRegistry;
  runtime: PluginRuntime;
  pluginState: PluginStateReader;
  logSettingsReader: PluginLogSettingsReader;
}

export function createBotPluginRuntime(database: Database): BotPluginRuntime {
  const pluginState = new DatabasePluginStateReader(database);
  const commands = new CommandRegistry(pluginState);
  const events = new EventRegistry(pluginState);
  const registry = new PluginRegistry();
  const runtime = new PluginRuntime(registry, commands, events);
  const logSettingsReader = new DatabaseLogSettingsReader(database);
  return { commands, events, registry, runtime, pluginState, logSettingsReader };
}

export function registerPluginEventBridge(
  client: Client,
  runtime: BotPluginRuntime,
  logger: Logger,
): void {
  bridge(
    client,
    'guildCreate',
    'guildCreate',
    (guild) => ({
      guildId: guild.id,
      guildName: guild.name,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'guildDelete',
    'guildDelete',
    (guild) => ({
      guildId: guild.id,
      guildName: guild.name,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'guildMemberAdd',
    'guildMemberAdd',
    (member) => ({
      guildId: member.guild.id,
      userId: member.id,
      userName: member.user.username,
      roleIds: [...member.roles.cache.keys()],
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'guildMemberRemove',
    'guildMemberRemove',
    (member) => ({
      guildId: member.guild.id,
      userId: member.id,
      userName: member.user.username,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'interactionCreate',
    'interactionCreate',
    (interaction) => ({
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId ?? undefined,
      userId: interaction.user.id,
      interactionType: interaction.type,
      commandName: interaction.isCommand() ? interaction.commandName : undefined,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'messageCreate',
    'messageCreate',
    (message) => ({
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      messageId: message.id,
      authorId: message.author.id,
      content: message.content,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'channelDelete',
    'channelDelete',
    (channel) => ({
      guildId: 'guildId' in channel ? channel.guildId : undefined,
      channelId: channel.id,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'inviteCreate',
    'inviteCreate',
    (invite) => ({
      guildId: invite.guild?.id,
      channelId: invite.channel?.id,
      inviteCode: invite.code,
      inviterId: invite.inviter?.id,
    }),
    runtime,
    logger,
  );
  bridge(
    client,
    'inviteDelete',
    'inviteDelete',
    (invite) => ({
      guildId: invite.guild?.id,
      channelId: invite.channel?.id,
      inviteCode: invite.code,
    }),
    runtime,
    logger,
  );
}

function bridge<K extends keyof ClientEvents>(
  client: Client,
  discordEvent: K,
  pluginEvent: PluginEventName,
  map: (...args: ClientEvents[K]) => PluginEventPayload,
  runtime: BotPluginRuntime,
  logger: Logger,
): void {
  client.on(discordEvent, (...args) => {
    void runtime.events.dispatch(pluginEvent, compact(map(...args))).catch((error: unknown) => {
      logger.error({ error, pluginEvent }, 'Core plugin event dispatch failed');
    });
  });
}

function compact(payload: PluginEventPayload): PluginEventPayload {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
