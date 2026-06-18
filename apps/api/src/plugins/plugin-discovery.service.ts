import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Injectable } from '@nestjs/common';
import { pluginManifestSchema, type PluginManifest } from '@nexura/types';

const CORE_VERSION = '0.2.5';
const PLUGIN_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'plugins',
);

@Injectable()
export class PluginDiscoveryService {
  async discoverManifests(): Promise<PluginManifest[]> {
    const pluginDirectories = await this.getPluginDirectories();
    return Promise.all(pluginDirectories.map((directory) => this.readManifest(directory)));
  }

  validateManifest(value: unknown): PluginManifest {
    const manifest = pluginManifestSchema.parse(value);
    if (compareVersions(manifest.minCoreVersion, CORE_VERSION) > 0) {
      throw new Error(
        `Plugin ${manifest.id} requires Nexura ${manifest.minCoreVersion}, current version is ${CORE_VERSION}.`,
      );
    }
    return manifest;
  }

  getPluginDirectory(pluginId: string): string {
    if (!/^[a-z][a-z0-9-]{1,63}$/u.test(pluginId)) {
      throw new Error('Plugin ID is invalid.');
    }
    return join(PLUGIN_DIRECTORY, pluginId);
  }

  private async getPluginDirectories(): Promise<string[]> {
    try {
      const entries = await readdir(PLUGIN_DIRECTORY, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(PLUGIN_DIRECTORY, entry.name))
        .sort();
    } catch (error) {
      if (isMissingDirectory(error)) {
        return [];
      }
      throw error;
    }
  }

  private async readManifest(pluginDirectory: string): Promise<PluginManifest> {
    const manifestPath = join(pluginDirectory, 'plugin.json');
    try {
      const content = await readFile(manifestPath, 'utf8');
      return this.validateManifest(JSON.parse(content));
    } catch (error) {
      throw new Error(`Failed to load plugin manifest at ${manifestPath}.`, {
        cause: error,
      });
    }
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = getVersionParts(left);
  const rightParts = getVersionParts(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function getVersionParts(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(/[+-]/u)[0]!.split('.').map(Number);
  return [major!, minor!, patch!];
}

function isMissingDirectory(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
