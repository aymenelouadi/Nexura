import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  guildPlugins,
  pluginLogs,
  plugins,
  type Database,
  type PluginRecord,
} from '@nexura/database';
import type {
  GuildPlugin,
  PluginLog,
  PluginLogDestination,
  PluginLogLevel,
  PluginManifest,
} from '@nexura/types';
import { and, desc, eq, notInArray } from 'drizzle-orm';

import { DATABASE } from '../config/tokens.js';

@Injectable()
export class PluginRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async registerManifest(manifest: PluginManifest): Promise<void> {
    await this.database
      .insert(plugins)
      .values(toPluginInsert(manifest))
      .onConflictDoUpdate({
        target: plugins.id,
        set: {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          status: 'INSTALLED',
          updatedAt: new Date(),
        },
      });
  }

  async removeMissingPlugins(pluginIds: string[]): Promise<void> {
    if (pluginIds.length === 0) {
      await this.database.delete(plugins);
      return;
    }
    await this.database.delete(plugins).where(notInArray(plugins.id, pluginIds));
  }

  async listForGuild(guildId: string): Promise<GuildPlugin[]> {
    const rows = await this.database
      .select({
        plugin: plugins,
        guildPluginId: guildPlugins.id,
        enabled: guildPlugins.enabled,
        guildInstalledAt: guildPlugins.installedAt,
        guildUpdatedAt: guildPlugins.updatedAt,
      })
      .from(plugins)
      .leftJoin(
        guildPlugins,
        and(eq(guildPlugins.pluginId, plugins.id), eq(guildPlugins.guildId, guildId)),
      )
      .orderBy(plugins.name);

    return rows.map(toGuildPlugin);
  }

  async getPlugin(pluginId: string): Promise<PluginRecord> {
    const [plugin] = await this.database
      .select()
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} is not installed.`);
    }
    return plugin;
  }

  async setEnabled(guildId: string, pluginId: string, enabled: boolean): Promise<void> {
    await this.database
      .insert(guildPlugins)
      .values({ guildId, pluginId, enabled })
      .onConflictDoUpdate({
        target: [guildPlugins.guildId, guildPlugins.pluginId],
        set: { enabled, updatedAt: new Date() },
      });
  }

  async writeLog(
    guildId: string,
    pluginId: string,
    level: PluginLogLevel,
    message: string,
    metadata: Record<string, unknown>,
    destination: PluginLogDestination = 'DASHBOARD',
  ): Promise<void> {
    await this.database
      .insert(pluginLogs)
      .values({ guildId, pluginId, level, message, metadata, destination });
  }

  async listLogs(guildId: string, pluginId: string): Promise<PluginLog[]> {
    const rows = await this.database
      .select()
      .from(pluginLogs)
      .where(and(eq(pluginLogs.guildId, guildId), eq(pluginLogs.pluginId, pluginId)))
      .orderBy(desc(pluginLogs.createdAt))
      .limit(100);

    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ?? {},
      destination: row.destination,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listGuildLogs(guildId: string): Promise<PluginLog[]> {
    const rows = await this.database
      .select()
      .from(pluginLogs)
      .where(eq(pluginLogs.guildId, guildId))
      .orderBy(desc(pluginLogs.createdAt))
      .limit(200);
    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ?? {},
      destination: row.destination,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

function toPluginInsert(manifest: PluginManifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    status: 'INSTALLED' as const,
  };
}

function toGuildPlugin(row: {
  plugin: PluginRecord;
  guildPluginId: string | null;
  enabled: boolean | null;
  guildInstalledAt: Date | null;
  guildUpdatedAt: Date | null;
}): GuildPlugin {
  const enabled = row.enabled ?? false;
  return {
    id: row.plugin.id,
    name: row.plugin.name,
    version: row.plugin.version,
    description: row.plugin.description,
    author: row.plugin.author,
    status: row.plugin.status,
    enabled,
    guildStatus: enabled ? 'ENABLED' : 'DISABLED',
    installedAt: row.guildInstalledAt?.toISOString() ?? null,
    updatedAt: (row.guildUpdatedAt ?? row.plugin.updatedAt).toISOString(),
    dashboard: null,
  };
}
