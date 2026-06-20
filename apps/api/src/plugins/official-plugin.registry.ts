import { Injectable } from '@nestjs/common';
import type { PluginDashboardSchemaDocument } from '@nexura/types';
import { pluginDashboardSchemaDocumentSchema } from '@nexura/types';
import semver from 'semver';

import { CORE_VERSION } from './plugin-discovery.service.js';
import { welcomeDashboardSchema } from './official/welcome-dashboard.schema.js';

export type OfficialDashboardMode = 'schema' | 'bundle' | 'none';

export interface OfficialPluginDefinition {
  id: string;
  expectedManifestId: string;
  minCoreVersion: string;
  dashboardMode: OfficialDashboardMode;
  /** Identifier used when the dashboard is provided by a bundled renderer (future use). */
  dashboardProvider?: string;
}

interface ResolvedDashboardSchema {
  schema: PluginDashboardSchemaDocument;
  /** Parses once on first use and caches the validated result. */
  parsed: PluginDashboardSchemaDocument | null;
}

const OFFICIAL_PLUGINS: Record<string, OfficialPluginDefinition> = {
  welcome: {
    id: 'welcome',
    expectedManifestId: 'welcome',
    minCoreVersion: '0.2.5',
    dashboardMode: 'schema',
    dashboardProvider: 'welcomeDashboardProvider',
  },
};

const OFFICIAL_SCHEMAS: Record<string, ResolvedDashboardSchema> = {
  welcome: { schema: welcomeDashboardSchema, parsed: null },
};

@Injectable()
export class OfficialPluginRegistry {
  isOfficial(pluginId: string): boolean {
    return pluginId in OFFICIAL_PLUGINS;
  }

  getById(pluginId: string): OfficialPluginDefinition | undefined {
    return OFFICIAL_PLUGINS[pluginId];
  }

  hasDashboardFallback(pluginId: string): boolean {
    const definition = OFFICIAL_PLUGINS[pluginId];
    if (!definition) {
      return false;
    }
    return definition.dashboardMode !== 'none';
  }

  getDashboardMode(pluginId: string): OfficialDashboardMode {
    return OFFICIAL_PLUGINS[pluginId]?.dashboardMode ?? 'none';
  }

  isSupported(pluginId: string, coreVersion: string = CORE_VERSION): boolean {
    const definition = OFFICIAL_PLUGINS[pluginId];
    if (!definition) {
      return false;
    }
    return semver.gte(coreVersion, definition.minCoreVersion);
  }

  async getDashboardSchema(pluginId: string): Promise<PluginDashboardSchemaDocument | null> {
    const definition = OFFICIAL_PLUGINS[pluginId];
    if (!definition || definition.dashboardMode !== 'schema') {
      return null;
    }

    const resolved = OFFICIAL_SCHEMAS[pluginId];
    if (!resolved) {
      return null;
    }

    if (!resolved.parsed) {
      resolved.parsed = pluginDashboardSchemaDocumentSchema.parse(resolved.schema);
    }

    return resolved.parsed;
  }

  getExpectedManifestId(pluginId: string): string | undefined {
    return OFFICIAL_PLUGINS[pluginId]?.expectedManifestId;
  }
}
