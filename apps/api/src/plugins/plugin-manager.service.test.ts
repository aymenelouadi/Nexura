import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from './plugin-manager.service.js';

describe('PluginManager', () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    for (const path of tempPaths.splice(0)) {
      await rm(path, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('removes root and installed plugin folders on final uninstall', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexura-delete-'));
    tempPaths.push(root);
    const sourceDir = join(root, 'welcome');
    const installedDir = join(root, 'installed', 'welcome');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(installedDir, { recursive: true });

    const discovery = {
      discoverManifests: vi.fn().mockResolvedValue([]),
      getInstalledPluginDirectory: vi.fn().mockReturnValue(installedDir),
      getPluginDirectory: vi.fn().mockReturnValue(sourceDir),
      validateManifest: vi.fn(),
    };
    const repository = {
      getPlugin: vi.fn().mockResolvedValue({ id: 'welcome' }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      writeLog: vi.fn().mockResolvedValue(undefined),
      deletePluginData: vi.fn().mockResolvedValue(undefined),
      deleteGuildPlugin: vi.fn().mockResolvedValue(undefined),
      isPluginUsedByOtherGuilds: vi.fn().mockResolvedValue(false),
      deletePluginRecord: vi.fn().mockResolvedValue(undefined),
      removeMissingPlugins: vi.fn().mockResolvedValue(undefined),
      registerManifest: vi.fn().mockResolvedValue(undefined),
    };
    const manager = new PluginManager(discovery as never, repository as never, { apply: vi.fn() } as never);

    await manager.deletePlugin('1111111111111111111', 'welcome', true);

    expect(existsSync(sourceDir)).toBe(false);
    expect(existsSync(installedDir)).toBe(false);
    expect(repository.deletePluginRecord).toHaveBeenCalledWith('welcome');
    expect(discovery.discoverManifests).toHaveBeenCalled();
  });
});
