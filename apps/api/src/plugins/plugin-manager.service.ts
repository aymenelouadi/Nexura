import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { GuildPlugin, PluginDashboard, PluginLog, PluginLogLevel, PluginManifest } from '@nexura/types';

import { PluginDiscoveryService } from './plugin-discovery.service.js';
import { PluginMigrationService } from './plugin-migration.service.js';
import { PluginRepository } from './plugin.repository.js';

@Injectable()
export class PluginManager implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginManager.name);
  private readonly manifestMap = new Map<string, PluginManifest>();

  constructor(
    private readonly pluginDiscoveryService: PluginDiscoveryService,
    private readonly pluginRepository: PluginRepository,
    private readonly pluginMigrationService: PluginMigrationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const manifests = await this.discoverInstalledPlugins();
    await this.pluginMigrationService.apply(manifests);
    this.logger.log(`Registered ${manifests.length} plugin manifest(s).`);
  }

  discoverInstalledPlugins(): Promise<PluginManifest[]> {
    return this.registerDiscoveredPlugins();
  }

  validatePluginManifest(value: unknown): PluginManifest {
    return this.pluginDiscoveryService.validateManifest(value);
  }

  getManifest(pluginId: string): PluginManifest | undefined {
    return this.manifestMap.get(pluginId);
  }

  async listPlugins(guildId: string): Promise<GuildPlugin[]> {
    const rows = await this.pluginRepository.listForGuild(guildId);
    return rows.map((row) => this.enrichWithDashboard(row));
  }

  async getPluginStatus(guildId: string, pluginId: string): Promise<GuildPlugin> {
    await this.pluginRepository.getPlugin(pluginId);
    const plugins = await this.listPlugins(guildId);
    const plugin = plugins.find((candidate) => candidate.id === pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} was not returned by the registry.`);
    }
    return plugin;
  }

  async enablePlugin(guildId: string, pluginId: string): Promise<GuildPlugin> {
    await this.pluginRepository.getPlugin(pluginId);
    await this.pluginRepository.setEnabled(guildId, pluginId, true);
    await this.writePluginLog(guildId, pluginId, 'INFO', 'Plugin enabled.', {});
    return this.getPluginStatus(guildId, pluginId);
  }

  async disablePlugin(guildId: string, pluginId: string): Promise<GuildPlugin> {
    await this.pluginRepository.getPlugin(pluginId);
    await this.pluginRepository.setEnabled(guildId, pluginId, false);
    await this.writePluginLog(guildId, pluginId, 'INFO', 'Plugin disabled.', {});
    return this.getPluginStatus(guildId, pluginId);
  }

  async listPluginLogs(guildId: string, pluginId: string): Promise<PluginLog[]> {
    await this.pluginRepository.getPlugin(pluginId);
    return this.pluginRepository.listLogs(guildId, pluginId);
  }

  listGuildLogs(guildId: string): Promise<PluginLog[]> {
    return this.pluginRepository.listGuildLogs(guildId);
  }

  writePluginLog(
    guildId: string,
    pluginId: string,
    level: PluginLogLevel,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.pluginRepository.writeLog(guildId, pluginId, level, message, metadata);
  }

  private enrichWithDashboard(plugin: GuildPlugin): GuildPlugin {
    const manifest = this.manifestMap.get(plugin.id);
    if (!manifest?.dashboard) {
      return { ...plugin, dashboard: null };
    }
    const dashboard: PluginDashboard = {
      enabled: manifest.dashboard.enabled,
      route: manifest.dashboard.route,
      label: manifest.dashboard.label,
      icon: manifest.dashboard.icon,
      tabs: manifest.dashboard.tabs,
    };
    return { ...plugin, dashboard };
  }

  private async registerDiscoveredPlugins(): Promise<PluginManifest[]> {
    const manifests = await this.pluginDiscoveryService.discoverManifests();
    await this.pluginRepository.removeMissingPlugins(manifests.map((manifest) => manifest.id));
    this.manifestMap.clear();
    for (const manifest of manifests) {
      this.manifestMap.set(manifest.id, manifest);
      await this.pluginRepository.registerManifest(manifest);
    }
    return manifests;
  }
}
