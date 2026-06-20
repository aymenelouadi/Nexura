import { describe, expect, it } from 'vitest';

import { OfficialPluginRegistry } from './official-plugin.registry.js';

describe('OfficialPluginRegistry', () => {
  const registry = new OfficialPluginRegistry();

  it('recognizes welcome as an official plugin', () => {
    expect(registry.isOfficial('welcome')).toBe(true);
    expect(registry.isOfficial('unknown')).toBe(false);
  });

  it('returns the official plugin definition for welcome', () => {
    const definition = registry.getById('welcome');
    expect(definition).toBeDefined();
    expect(definition!.id).toBe('welcome');
    expect(definition!.expectedManifestId).toBe('welcome');
    expect(definition!.dashboardMode).toBe('schema');
  });

  it('reports that welcome has a dashboard fallback', () => {
    expect(registry.hasDashboardFallback('welcome')).toBe(true);
    expect(registry.hasDashboardFallback('third-party')).toBe(false);
  });

  it('returns the welcome dashboard schema', async () => {
    const schema = await registry.getDashboardSchema('welcome');
    expect(schema).not.toBeNull();
    expect(schema!.version).toBe(1);
    expect(schema!.contentMode).toBe('schema');
    expect(schema!.tabs.map((tab) => tab.id)).toEqual([
      'overview',
      'welcome',
      'leave',
      'dm',
      'templates',
      'commands',
      'logs',
    ]);
  });

  it('returns null for unknown plugins', async () => {
    expect(await registry.getDashboardSchema('unknown')).toBeNull();
    expect(registry.getDashboardMode('unknown')).toBe('none');
  });

  it('checks core version compatibility', () => {
    expect(registry.isSupported('welcome', '0.2.5')).toBe(true);
    expect(registry.isSupported('welcome', '0.2.4')).toBe(false);
  });

  it('returns the expected manifest id for official plugins', () => {
    expect(registry.getExpectedManifestId('welcome')).toBe('welcome');
    expect(registry.getExpectedManifestId('unknown')).toBeUndefined();
  });
});
