import { BadRequestException, ConflictException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PluginUploadService } from './plugin-upload.service.js';
import { PluginOperationException } from './plugin-operation.exception.js';
import type { PluginDiscoveryService } from './plugin-discovery.service.js';
import type { PluginManager } from './plugin-manager.service.js';
import type { PluginMigrationService } from './plugin-migration.service.js';
import type { PluginRepository } from './plugin.repository.js';
import type { PluginManifest } from '@nexura/types';

const validManifest: PluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  description: 'A test plugin',
  version: '1.0.0',
  author: 'Nexura',
  minCoreVersion: '0.0.0',
  entry: 'index.js',
  permissions: [],
  capabilities: {
    commands: false,
    events: false,
    dashboard: false,
    database: false,
    templates: false,
    visualEditor: false,
    logs: false,
  },
};

function createMockDeps(overrides?: {
  pluginDir?: string;
  existingPlugin?: boolean;
}) {
  const pluginDir = overrides?.pluginDir ?? join(tmpdir(), `nexura-test-${Date.now()}`);
  return {
    pluginDiscoveryService: {
      validateManifest: vi.fn((manifest: unknown) => manifest as PluginManifest),
      getInstalledPluginDirectory: vi.fn(() => pluginDir),
      getInstalledPluginsDirectory: vi.fn(() => tmpdir()),
    } as unknown as PluginDiscoveryService,
    pluginManager: {
      reloadManifests: vi.fn().mockResolvedValue(undefined),
    } as unknown as PluginManager,
    pluginRepository: {
      getPlugin: vi.fn().mockResolvedValue(overrides?.existingPlugin ? {} : null),
      registerManifest: vi.fn().mockResolvedValue(undefined),
      setEnabled: vi.fn().mockResolvedValue(undefined),
    } as unknown as PluginRepository,
    pluginMigrationService: {
      apply: vi.fn().mockResolvedValue(undefined),
    } as unknown as PluginMigrationService,
  };
}

async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf8'));
  }
  return zip.toBuffer();
}

async function createTempFile(content: Buffer): Promise<{ filePath: string; dir: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'nexura-upload-'));
  const filePath = join(tempDir, 'plugin.zip');
  await writeFile(filePath, content);
  return { filePath, dir: tempDir };
}

describe('PluginUploadService', () => {
  let tempPaths: string[] = [];

  beforeEach(() => {
    tempPaths = [];
  });

  afterEach(async () => {
    for (const path of tempPaths) {
      await rm(path, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('uploads a valid plugin and returns the manifest', async () => {
    const zip = await createZipBuffer({
      'plugin.json': JSON.stringify(validManifest),
      'index.js': 'module.exports = {};',
    });
    const { filePath, dir } = await createTempFile(zip);
    tempPaths.push(dir);

    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    const result = await service.upload(
      {
        fieldname: 'file',
        originalname: 'test-plugin.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        size: zip.length,
        destination: '',
        filename: 'plugin.zip',
        path: filePath,
        buffer: zip,
      },
      '1111111111111111111',
    );

    expect(result.id).toBe('test-plugin');
    expect(deps.pluginMigrationService.apply).toHaveBeenCalled();
    expect(deps.pluginManager.reloadManifests).toHaveBeenCalled();
  });

  it('rejects a non-zip archive', async () => {
    const { filePath, dir } = await createTempFile(Buffer.from('not a zip'));
    tempPaths.push(dir);

    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.txt',
          encoding: '7bit',
          mimetype: 'text/plain',
          size: 10,
          destination: '',
          filename: 'plugin.txt',
          path: filePath,
          buffer: Buffer.from('not a zip'),
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an archive missing plugin.json', async () => {
    const zip = await createZipBuffer({ 'index.js': 'module.exports = {};' });
    const { filePath, dir } = await createTempFile(zip);
    tempPaths.push(dir);

    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.zip',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: zip.length,
          destination: '',
          filename: 'plugin.zip',
          path: filePath,
          buffer: zip,
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow('missing plugin.json');
  });

  it('rejects archives containing executables', async () => {
    const zip = await createZipBuffer({
      'plugin.json': JSON.stringify(validManifest),
      'index.js': 'module.exports = {};',
      'install.sh': '#!/bin/bash',
    });
    const { filePath, dir } = await createTempFile(zip);
    tempPaths.push(dir);

    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.zip',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: zip.length,
          destination: '',
          filename: 'plugin.zip',
          path: filePath,
          buffer: zip,
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow('executables');
  });

  it('rejects archives containing .env files', async () => {
    const zip = await createZipBuffer({
      'plugin.json': JSON.stringify(validManifest),
      'index.js': 'module.exports = {};',
      '.env': 'SECRET=value',
    });
    const { filePath, dir } = await createTempFile(zip);
    tempPaths.push(dir);

    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.zip',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: zip.length,
          destination: '',
          filename: 'plugin.zip',
          path: filePath,
          buffer: zip,
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow('.env files');
  });

  it('rejects a plugin that is already installed', async () => {
    const pluginDir = await mkdtemp(join(tmpdir(), 'nexura-existing-'));
    tempPaths.push(pluginDir);

    const zip = await createZipBuffer({
      'plugin.json': JSON.stringify(validManifest),
      'index.js': 'module.exports = {};',
    });
    const { filePath, dir } = await createTempFile(zip);
    tempPaths.push(dir);

    const deps = createMockDeps({ pluginDir });
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.zip',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: zip.length,
          destination: '',
          filename: 'plugin.zip',
          path: filePath,
          buffer: zip,
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws PluginOperationException when file.path is undefined', async () => {
    const deps = createMockDeps();
    const service = new PluginUploadService(
      deps.pluginDiscoveryService,
      deps.pluginManager,
      deps.pluginRepository,
      deps.pluginMigrationService,
    );

    await expect(
      service.upload(
        {
          fieldname: 'file',
          originalname: 'plugin.zip',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: 100,
          destination: '',
          filename: 'plugin.zip',
          path: undefined as unknown as string,
          buffer: Buffer.from(''),
        },
        '1111111111111111111',
      ),
    ).rejects.toThrow(PluginOperationException);
  });
});
