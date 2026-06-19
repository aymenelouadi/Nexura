import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { guildPlugins, type Database } from '@nexura/database';
import {
  PluginRegistry,
  PluginRuntime,
  type PluginContext,
  type PluginModule,
  type PluginScope,
} from '@nexura/shared';
import { pluginManifestSchema, type PluginManifest } from '@nexura/types';
import {
  ApplicationCommandOptionType,
  type Client,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';

import { BotPluginContextFactory } from './plugin-core-adapters.js';
import type { BotPluginRuntime } from './plugin-runtime-bridge.js';

const PLUGINS_DIRECTORY = resolve(
  dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  'plugins',
);

interface LoadedPlugin {
  manifest: PluginManifest;
  module: PluginModule;
}

export class PluginHost {
  private readonly registry = new PluginRegistry();
  private readonly runtime: PluginRuntime;
  private readonly contexts = new Map<string, PluginContext>();
  private readonly loaded = new Map<string, LoadedPlugin>();
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private refreshing = false;
  private refreshFailures = 0;
  private nextRefreshFailureLogAt = 0;

  constructor(
    private readonly database: Database,
    private readonly client: Client,
    private readonly core: BotPluginRuntime,
    private readonly logger: Logger,
  ) {
    this.runtime = new PluginRuntime(this.registry, core.commands, core.events);
  }

  async start(): Promise<void> {
    await this.loadModules();
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const cause =
          error instanceof Error && 'cause' in error
            ? ((error.cause as Error | undefined)?.message ?? '')
            : '';
        this.refreshFailures += 1;
        const now = Date.now();
        const delay = Math.min(1_000 * 2 ** (this.refreshFailures - 1), 60_000);
        if (now >= this.nextRefreshFailureLogAt) {
          this.logger.error({ err: message, cause }, 'Plugin host refresh failed');
          this.nextRefreshFailureLogAt = now + delay;
        }
      });
    }, 10_000);
    this.refreshTimer.unref();
  }

  async stop(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    for (const [key, context] of this.contexts) {
      await this.deactivate(key, context);
    }
  }

  private async loadModules(): Promise<void> {
    for (const directory of await listPluginDirectories()) {
      const manifest = pluginManifestSchema.parse(
        JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8')) as unknown,
      );
      const runtimePath = join(directory, 'dist', manifest.entry.replace(/\.ts$/u, '.js'));
      const imported = (await import(pathToFileURL(runtimePath).href)) as {
        default?: PluginModule;
      };
      if (!imported.default) {
        throw new Error(`Plugin ${manifest.id} does not export a default PluginModule.`);
      }
      this.registry.register(manifest.id, imported.default);
      this.loaded.set(manifest.id, { manifest, module: imported.default });
    }
    this.logger.info({ count: this.loaded.size }, 'Plugin runtime modules loaded');
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const enabled = await this.database
        .select({ guildId: guildPlugins.guildId, pluginId: guildPlugins.pluginId })
        .from(guildPlugins)
        .where(eq(guildPlugins.enabled, true));
      const desired = new Set(
        enabled.map(({ guildId, pluginId }) => scopeKey({ guildId, pluginId })),
      );

      for (const scope of enabled) {
        const key = scopeKey(scope);
        if (!this.contexts.has(key) && this.loaded.has(scope.pluginId)) {
          await this.activate(scope);
        }
      }
      for (const [key, context] of this.contexts) {
        if (!desired.has(key)) {
          await this.deactivate(key, context);
        }
      }
      await this.syncSlashCommands(new Set(enabled.map((row) => row.guildId)));
      this.refreshFailures = 0;
      this.nextRefreshFailureLogAt = 0;
    } finally {
      this.refreshing = false;
    }
  }

  private async activate(scope: PluginScope): Promise<void> {
    const context = this.runtime.createContext(
      scope,
      new BotPluginContextFactory(this.database, this.client).create(scope),
    );
    await this.runtime.runLifecycle(scope, 'onInstall', context);
    await this.runtime.runLifecycle(scope, 'onEnable', context);
    this.contexts.set(scopeKey(scope), context);
    this.logger.info(scope, 'Plugin activated');
  }

  private async deactivate(key: string, context: PluginContext): Promise<void> {
    await this.runtime.runLifecycle(context, 'onDisable', context);
    context.scheduler.cancelAll();
    this.core.commands.unregisterScope(context);
    this.core.events.unregisterScope(context);
    this.contexts.delete(key);
    this.logger.info(
      { guildId: context.guildId, pluginId: context.pluginId },
      'Plugin deactivated',
    );
  }

  private async syncSlashCommands(guildIds: Set<string>): Promise<void> {
    for (const guildId of guildIds) {
      const guild = await this.client.guilds.fetch(guildId);
      const commands = this.core.commands.listSlashCommands(guildId).map((command) => ({
        name: command.name,
        description: command.description,
        type: 1,
        options: command.options.map((option) => ({
          name: option.name,
          description: option.description,
          type: toDiscordOptionType(option.type),
          required: option.required ?? false,
        })),
      })) as unknown as RESTPostAPIChatInputApplicationCommandsJSONBody[];
      await guild.commands.set(commands);
    }
  }
}

function scopeKey(scope: PluginScope): string {
  return `${scope.guildId}:${scope.pluginId}`;
}

function toDiscordOptionType(type: 'STRING' | 'BOOLEAN' | 'INTEGER'): ApplicationCommandOptionType {
  if (type === 'BOOLEAN') return ApplicationCommandOptionType.Boolean;
  if (type === 'INTEGER') return ApplicationCommandOptionType.Integer;
  return ApplicationCommandOptionType.String;
}

async function listPluginDirectories(): Promise<string[]> {
  try {
    const entries = await readdir(PLUGINS_DIRECTORY, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(PLUGINS_DIRECTORY, entry.name))
      .sort();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
