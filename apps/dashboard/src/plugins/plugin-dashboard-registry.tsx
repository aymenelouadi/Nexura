import { type ReactNode } from 'react';

import { createWelcomeContentMap } from './welcome/welcome-dashboard.js';

export interface PluginDashboardEntry {
  pluginId: string;
  createContentMap: (guildId: string) => Record<string, ReactNode>;
}

const registry: PluginDashboardEntry[] = [
  { pluginId: 'welcome', createContentMap: createWelcomeContentMap },
];

export function getPluginContentMap(pluginId: string, guildId: string): Record<string, ReactNode> | null {
  const entry = registry.find((item) => item.pluginId === pluginId);
  return entry?.createContentMap(guildId) ?? null;
}
