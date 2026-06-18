import {
  commandAliases,
  commandPermissions,
  guildMembers,
  guildPluginCommands,
  pluginCommands,
  pluginLogs,
  pluginLogSettings,
  pluginStorage,
  pluginTemplates,
  templateVersions,
  users,
  type Database,
} from '@nexura/database';
import {
  ScopedPluginDatabase,
  ScopedPluginLogger,
  ScopedPluginPermissions,
  ScopedPluginStorage,
  ScopedTemplateRegistry,
  VariableRegistry,
  pluginComponents,
  pluginEmbeds,
  type CommandConfigurationReader,
  type CommandCustomization,
  type CommandRegistration,
  type CommandRegistrationWriter,
  type DashboardLogWriter,
  type DiscordLogWriter,
  type PluginContextDependencies,
  type PluginLogEntry,
  type PluginLogSettingsReader,
  type PluginManagementReader,
  type PluginMessageReceipt,
  type PluginMessages,
  type PluginScope,
  type PluginStorageRepository,
  type PluginTemplateRepository,
  type TemplateInput,
} from '@nexura/shared';
import {
  coreMessageSchema,
  pluginLogSettingsSchema,
  type CoreMessage,
  type PluginLogSettings,
  type PluginTemplate,
  type VisualEditorElement,
  type VisualEditorLayout,
} from '@nexura/types';
import type { Client, Guild } from 'discord.js';
import { and, desc, eq, like } from 'drizzle-orm';

import { toDiscordReply } from './discord-message.js';

export class BotPluginContextFactory {
  private readonly storageRepository: DatabaseStorageRepository;
  private readonly templateRepository: DatabaseTemplateRepository;
  private readonly commandRegistrar: DatabaseCommandRegistrar;
  private readonly permissionsReader: DatabasePermissionsReader;

  constructor(
    private readonly database: Database,
    private readonly client: Client,
  ) {
    this.storageRepository = new DatabaseStorageRepository(database);
    this.templateRepository = new DatabaseTemplateRepository(database);
    this.commandRegistrar = new DatabaseCommandRegistrar(database);
    this.permissionsReader = new DatabasePermissionsReader(database);
  }

  create(scope: PluginScope): PluginContextDependencies {
    const storage = new ScopedPluginStorage(scope, this.storageRepository);
    const messages = new DiscordPluginMessages(this.client);
    const settings = new DatabaseLogSettingsReader(this.database);
    const logger = new ScopedPluginLogger(
      scope,
      settings,
      new DatabaseLogWriter(this.database),
      new DiscordChannelLogWriter(messages),
    );
    return {
      logger,
      storage,
      database: new ScopedPluginDatabase(storage),
      permissions: new ScopedPluginPermissions(
        scope,
        this.permissionsReader,
        this.permissionsReader,
      ),
      variables: new VariableRegistry(),
      templates: new ScopedTemplateRegistry(scope, this.templateRepository),
      messages,
      embeds: pluginEmbeds,
      components: pluginComponents,
      commandWriter: this.commandRegistrar,
      createInvite: (channelId, options) => createInvite(this.client, channelId, options),
      getGuildInvites: () => getGuildInvites(this.client, scope.guildId),
    };
  }
}

class DatabaseCommandRegistrar implements CommandRegistrationWriter {
  constructor(private readonly database: Database) {}

  async register(
    scope: PluginScope,
    command: CommandRegistration,
  ): Promise<CommandCustomization | undefined> {
    const commandId = command.commandId ?? command.name;
    await this.database
      .insert(pluginCommands)
      .values({
        ...scope,
        commandId,
        defaultName: command.name,
        defaultDescription: command.description,
        type: command.type,
        defaultPermissions: command.defaultPermissions ?? [],
        options: command.options ?? [],
        autoDeleteReplyOnAuthorDelete: command.autoDeleteReplyOnAuthorDelete ?? false,
        autoDeleteAuthorMessage: command.autoDeleteAuthorMessage ?? false,
      })
      .onConflictDoUpdate({
        target: [pluginCommands.guildId, pluginCommands.pluginId, pluginCommands.commandId],
        set: {
          defaultName: command.name,
          defaultDescription: command.description,
          type: command.type,
          defaultPermissions: command.defaultPermissions ?? [],
          options: command.options ?? [],
          updatedAt: new Date(),
        },
      });

    const aliases = await this.database
      .select()
      .from(commandAliases)
      .where(
        and(
          eq(commandAliases.guildId, scope.guildId),
          eq(commandAliases.pluginId, scope.pluginId),
          eq(commandAliases.commandId, commandId),
        ),
      );
    if (aliases.length === 0 && (command.aliases?.length ?? 0) > 0) {
      await this.database.insert(commandAliases).values(
        command.aliases!.map((alias) => ({ ...scope, commandId, alias })),
      );
    }

    const [customization] = await this.database
      .select()
      .from(guildPluginCommands)
      .where(
        and(
          eq(guildPluginCommands.guildId, scope.guildId),
          eq(guildPluginCommands.pluginId, scope.pluginId),
          eq(guildPluginCommands.commandId, commandId),
        ),
      )
      .limit(1);
    const [permissions] = await this.database
      .select()
      .from(commandPermissions)
      .where(
        and(
          eq(commandPermissions.guildId, scope.guildId),
          eq(commandPermissions.pluginId, scope.pluginId),
          eq(commandPermissions.commandId, commandId),
        ),
      )
      .limit(1);
    const finalAliases = await this.database
      .select({ alias: commandAliases.alias })
      .from(commandAliases)
      .where(
        and(
          eq(commandAliases.guildId, scope.guildId),
          eq(commandAliases.pluginId, scope.pluginId),
          eq(commandAliases.commandId, commandId),
        ),
      );
    return {
      ...(customization
        ? {
            name: customization.name,
            description: customization.description,
            enabled: customization.enabled,
            autoDeleteReplyOnAuthorDelete: customization.autoDeleteReplyOnAuthorDelete,
            autoDeleteAuthorMessage: customization.autoDeleteAuthorMessage,
          }
        : {}),
      aliases: finalAliases.map((row) => row.alias),
      ...(permissions
        ? {
            permissions: {
              allowedRoleIds: permissions.allowedRoleIds,
              ignoredRoleIds: permissions.ignoredRoleIds,
              ignoredChannelIds: permissions.ignoredChannelIds,
              enabledChannelIds: permissions.enabledChannelIds,
            },
          }
        : {}),
    };
  }
}

class DatabasePermissionsReader implements PluginManagementReader, CommandConfigurationReader {
  constructor(private readonly database: Database) {}

  async canManage(scope: PluginScope, userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({ role: guildMembers.role })
      .from(users)
      .innerJoin(guildMembers, eq(guildMembers.userId, users.id))
      .where(and(eq(users.discordId, userId), eq(guildMembers.guildId, scope.guildId)))
      .limit(1);
    return Boolean(row);
  }

  async getPermissions(scope: PluginScope, commandId: string) {
    const [row] = await this.database
      .select()
      .from(commandPermissions)
      .where(
        and(
          eq(commandPermissions.guildId, scope.guildId),
          eq(commandPermissions.pluginId, scope.pluginId),
          eq(commandPermissions.commandId, commandId),
        ),
      )
      .limit(1);
    return {
      allowedRoleIds: row?.allowedRoleIds ?? [],
      ignoredRoleIds: row?.ignoredRoleIds ?? [],
      ignoredChannelIds: row?.ignoredChannelIds ?? [],
      enabledChannelIds: row?.enabledChannelIds ?? [],
    };
  }
}

class DatabaseStorageRepository implements PluginStorageRepository {
  constructor(private readonly database: Database) {}

  async get<T>(scope: PluginScope, key: string): Promise<T | null> {
    const [row] = await this.database
      .select({ value: pluginStorage.value })
      .from(pluginStorage)
      .where(
        and(
          eq(pluginStorage.guildId, scope.guildId),
          eq(pluginStorage.pluginId, scope.pluginId),
          eq(pluginStorage.key, key),
        ),
      )
      .limit(1);
    return (row?.value as T | undefined) ?? null;
  }

  async set<T>(scope: PluginScope, key: string, value: T): Promise<void> {
    await this.database
      .insert(pluginStorage)
      .values({ ...scope, key, value })
      .onConflictDoUpdate({
        target: [pluginStorage.guildId, pluginStorage.pluginId, pluginStorage.key],
        set: { value, updatedAt: new Date() },
      });
  }

  async delete(scope: PluginScope, key: string): Promise<void> {
    await this.database
      .delete(pluginStorage)
      .where(
        and(
          eq(pluginStorage.guildId, scope.guildId),
          eq(pluginStorage.pluginId, scope.pluginId),
          eq(pluginStorage.key, key),
        ),
      );
  }

  async list<T>(
    scope: PluginScope,
    prefix: string,
  ): Promise<Array<{ key: string; value: T }>> {
    const rows = await this.database
      .select({ key: pluginStorage.key, value: pluginStorage.value })
      .from(pluginStorage)
      .where(
        and(
          eq(pluginStorage.guildId, scope.guildId),
          eq(pluginStorage.pluginId, scope.pluginId),
          like(pluginStorage.key, `${prefix}%`),
        ),
      );
    return rows.map((row) => ({ key: row.key, value: row.value as T }));
  }
}

class DatabaseTemplateRepository implements PluginTemplateRepository {
  constructor(private readonly database: Database) {}

  async save(scope: PluginScope, template: TemplateInput): Promise<PluginTemplate> {
    const [row] = await this.database
      .insert(pluginTemplates)
      .values({
        ...scope,
        name: template.name,
        type: template.type,
        contentMode: template.contentMode,
        content: template.content,
        variables: template.variables ?? [],
        previewData: template.previewData ?? {},
      })
      .onConflictDoUpdate({
        target: [pluginTemplates.guildId, pluginTemplates.pluginId, pluginTemplates.name],
        set: {
          type: template.type,
          contentMode: template.contentMode,
          content: template.content,
          variables: template.variables ?? [],
          previewData: template.previewData ?? {},
          updatedAt: new Date(),
        },
      })
      .returning();
    const [latest] = await this.database
      .select({ version: templateVersions.version })
      .from(templateVersions)
      .where(
        and(
          eq(templateVersions.guildId, scope.guildId),
          eq(templateVersions.pluginId, scope.pluginId),
          eq(templateVersions.templateId, row!.id),
        ),
      )
      .orderBy(desc(templateVersions.version))
      .limit(1);
    const version = (latest?.version ?? 0) + 1;
    await this.database.insert(templateVersions).values({
      ...scope,
      templateId: row!.id,
      version,
      content: template.content,
    });
    return mapTemplate(row!, version);
  }

  async getTemplate(scope: PluginScope, name: string): Promise<PluginTemplate | null> {
    return (await this.listTemplates(scope)).find((template) => template.name === name) ?? null;
  }

  async listTemplates(scope: PluginScope): Promise<PluginTemplate[]> {
    const rows = await this.database
      .select()
      .from(pluginTemplates)
      .where(
        and(
          eq(pluginTemplates.guildId, scope.guildId),
          eq(pluginTemplates.pluginId, scope.pluginId),
        ),
      );
    return Promise.all(
      rows.map(async (row) => {
        const [latest] = await this.database
          .select({ version: templateVersions.version })
          .from(templateVersions)
          .where(
            and(
              eq(templateVersions.guildId, scope.guildId),
              eq(templateVersions.pluginId, scope.pluginId),
              eq(templateVersions.templateId, row.id),
            ),
          )
          .orderBy(desc(templateVersions.version))
          .limit(1);
        return mapTemplate(row, latest?.version ?? 1);
      }),
    );
  }

  async duplicateTemplate(scope: PluginScope, name: string, nextName: string): Promise<PluginTemplate> {
    const existing = await this.getTemplate(scope, name);
    if (!existing) {
      throw new Error(`Template "${name}" not found.`);
    }
    return this.save(scope, {
      name: nextName,
      type: existing.type,
      contentMode: existing.contentMode,
      content: existing.content,
      variables: existing.variables,
      previewData: existing.previewData ?? {},
    });
  }

  async deleteTemplate(scope: PluginScope, name: string): Promise<void> {
    const existing = await this.getTemplate(scope, name);
    if (!existing) return;
    await this.database
      .delete(templateVersions)
      .where(
        and(
          eq(templateVersions.guildId, scope.guildId),
          eq(templateVersions.pluginId, scope.pluginId),
          eq(templateVersions.templateId, existing.id),
        ),
      );
    await this.database
      .delete(pluginTemplates)
      .where(
        and(
          eq(pluginTemplates.guildId, scope.guildId),
          eq(pluginTemplates.pluginId, scope.pluginId),
          eq(pluginTemplates.name, name),
        ),
      );
  }
}

class DatabaseLogSettingsReader implements PluginLogSettingsReader {
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
    return pluginLogSettingsSchema.parse(
      row
        ? { ...row, updatedAt: row.updatedAt.toISOString() }
        : {
            ...scope,
            destination: 'DASHBOARD',
            channelId: null,
            outputType: 'text',
            embedColor: null,
            updatedAt: new Date(0).toISOString(),
          },
    );
  }
}

class DatabaseLogWriter implements DashboardLogWriter {
  constructor(private readonly database: Database) {}

  async write(entry: PluginLogEntry): Promise<void> {
    await this.database.insert(pluginLogs).values({
      guildId: entry.guildId,
      pluginId: entry.pluginId,
      level: entry.level,
      message: entry.message,
      metadata: entry.metadata,
      destination: entry.destination,
      createdAt: entry.createdAt,
    });
  }
}

class DiscordChannelLogWriter implements DiscordLogWriter {
  constructor(private readonly messages: PluginMessages) {}

  async write(
    _entry: PluginLogEntry,
    settings: PluginLogSettings,
    message: CoreMessage,
  ): Promise<void> {
    if (settings.channelId) {
      await this.messages.sendChannel(settings.channelId, message);
    }
  }
}

class DiscordPluginMessages implements PluginMessages {
  constructor(private readonly client: Client) {}

  build(input: unknown): CoreMessage {
    return coreMessageSchema.parse(input);
  }

  async sendChannel(channelId: string, message: CoreMessage): Promise<PluginMessageReceipt> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isSendable()) {
      throw new Error(`Discord channel ${channelId} is not sendable.`);
    }
    const sent = await channel.send(toDiscordReply(message));
    return { id: sent.id, channelId: sent.channelId };
  }

  async sendDirect(userId: string, message: CoreMessage): Promise<PluginMessageReceipt> {
    const sent = await (await this.client.users.fetch(userId)).send(toDiscordReply(message));
    return { id: sent.id, channelId: sent.channelId };
  }

  async sendVisualCard(
    channelId: string,
    layout: VisualEditorLayout,
    previewData: Record<string, string>,
  ): Promise<PluginMessageReceipt> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isSendable()) {
      throw new Error(`Discord channel ${channelId} is not sendable.`);
    }
    const sent = await channel.send({
      files: [
        {
          attachment: Buffer.from(renderVisualCardSvg(layout, previewData)),
          name: 'nexura-visual-card.svg',
        },
      ],
    });
    return { id: sent.id, channelId: sent.channelId };
  }

  async delete(channelId: string, messageId: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased() && 'messages' in channel) {
      await channel.messages.delete(messageId);
    }
  }
}

async function createInvite(
  client: Client,
  channelId: string,
  options: { maxAgeSeconds?: number; maxUses?: number; unique?: boolean } = {},
): Promise<string> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !('createInvite' in channel)) {
    throw new Error(`Discord channel ${channelId} cannot create invites.`);
  }
  const invite = await (channel as unknown as { createInvite: (options: Record<string, unknown>) => Promise<{ url: string }> }).createInvite({
    maxAge: options.maxAgeSeconds ?? 86_400,
    maxUses: options.maxUses ?? 0,
    unique: options.unique ?? true,
    reason: 'Nexura plugin command',
  });
  return invite.url;
}

async function getGuildInvites(client: Client, guildId: string) {
  const guild: Guild = await client.guilds.fetch(guildId);
  const invites = await guild.invites.fetch();
  return invites.map((invite) => ({
    code: invite.code,
    uses: invite.uses ?? 0,
    inviterId: invite.inviter?.id ?? null,
    inviterName: invite.inviter?.username ?? null,
  }));
}

function mapTemplate(
  row: typeof pluginTemplates.$inferSelect,
  version: number,
): PluginTemplate {
  return { ...row, version, updatedAt: row.updatedAt.toISOString() };
}

function renderVisualCardSvg(
  layout: VisualEditorLayout,
  previewData: Record<string, string>,
): string {
  const elements = [...layout.elements]
    .sort((left, right) => (left.type === 'background' ? -1 : right.type === 'background' ? 1 : 0))
    .map((element) => renderVisualElement(element, previewData))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="${escapeXml(layout.backgroundColor)}"/>${elements}</svg>`;
}

function renderVisualElement(
  element: VisualEditorElement,
  previewData: Record<string, string>,
): string {
  if (element.type === 'text') {
    const text = element.text.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/gu, (match, name: string) =>
      previewData[name] ?? match,
    );
    return `<text x="${element.x}" y="${element.y + element.fontSize}" font-family="${escapeXml(element.fontFamily)}" font-size="${element.fontSize}" fill="${escapeXml(element.fill)}" opacity="${element.opacity}">${escapeXml(text)}</text>`;
  }
  if (element.source) {
    return `<image href="${escapeXml(element.source)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" opacity="${element.opacity}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  const fill = element.type === 'avatar' ? '#5865f2' : '#334155';
  return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.type === 'avatar' || element.type === 'server_icon' ? element.width / 2 : 8}" fill="${fill}" opacity="${element.opacity}"/>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
