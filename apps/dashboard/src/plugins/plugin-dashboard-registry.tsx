import { type ReactNode } from 'react';

export interface PluginDashboardEntry {
  pluginId: string;
  createContentMap: (guildId: string) => Record<string, ReactNode>;
}

const loaded = new Map<string, PluginDashboardEntry>();

export async function loadPluginDashboard(pluginId: string): Promise<PluginDashboardEntry | null> {
  if (loaded.has(pluginId)) {
    return loaded.get(pluginId)!;
  }

  try {
    const mod = await import(
      /* @vite-ignore */
      `../../../../plugins/installed/${pluginId}/dist/index.js`
    );
    if (typeof mod.createContentMap === 'function') {
      const entry: PluginDashboardEntry = { pluginId, createContentMap: mod.createContentMap };
      loaded.set(pluginId, entry);
      return entry;
    }
  } catch {
    try {
      const mod = await import(
        /* @vite-ignore */
        `../../../../plugins/${pluginId}/dist/index.js`
      );
      if (typeof mod.createContentMap === 'function') {
        const entry: PluginDashboardEntry = { pluginId, createContentMap: mod.createContentMap };
        loaded.set(pluginId, entry);
        return entry;
      }
    } catch {
      // Plugin doesn't export a dashboard module
    }
  }

  return null;
}

export function getPluginContentMap(pluginId: string, guildId: string): Record<string, ReactNode> | null {
  const entry = loaded.get(pluginId);
  return entry?.createContentMap(guildId) ?? null;
}
