import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ENVIRONMENT, DATABASE, DATABASE_POOL } from './config/tokens.js';
import { SessionAuthGuard } from './common/guards/session-auth.guard.js';
import { SameOriginGuard } from './common/guards/same-origin.guard.js';
import { SettingsRepository } from './settings/settings.repository.js';
import { SettingsUploadService, type UploadedFile, type ProcessedUpload } from './settings/settings-upload.service.js';
import { ActivityService } from './activity/activity.service.js';
import { PluginManager } from './plugins/plugin-manager.service.js';
import { AppModule } from './app.module.js';
import { appSettingsSchema, type AppSettings, type ActivityEventListResponse, type ActivityQuery } from '@nexura/types';
import type { ApiEnvironment } from '@nexura/shared';
import type { Request } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_USER_ID = '123456789012345678';

class TestSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    req.session = { userId: TEST_USER_ID, isAuthenticated: true } as unknown as Request['session'];
    return true;
  }
}

class TestSameOriginGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

class InMemorySettingsRepository {
  private stored: AppSettings | null = null;

  async get(): Promise<AppSettings | null> {
    return this.stored;
  }

  async upsert(value: AppSettings): Promise<AppSettings> {
    this.stored = value;
    return value;
  }
}

class MockSettingsUploadService {
  readonly uploadsDir = '/tmp/test-uploads';

  async processImage(kind: 'logo' | 'favicon' | 'pwa_icon', _file: UploadedFile): Promise<ProcessedUpload> {
    return {
      filename: `test-${kind}.png`,
      publicUrl: `/api/v1/settings/assets/test-${kind}.png`,
      width: 512,
      height: 512,
    };
  }
}

class MockActivityService {
  async listForUser(_userId: string, query: ActivityQuery): Promise<ActivityEventListResponse> {
    return {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 0 },
    };
  }

  record = vi.fn().mockResolvedValue(undefined);
}

const mockPluginManager = {
  onApplicationBootstrap: async () => {},
  discoverInstalledPlugins: async () => [],
  getManifest: () => undefined,
  listPlugins: async () => [],
  listDashboards: async () => [],
};

const mockEnvironment: ApiEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  LOG_LEVEL: 'error',
  API_PORT: 4000,
  SESSION_SECRET: 'a'.repeat(32),
  COOKIE_SECRET: 'b'.repeat(32),
  OAUTH_TOKEN_ENCRYPTION_KEY: Buffer.from('x'.repeat(32)).toString('base64'),
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_BOT_TOKEN: 'token',
  DISCORD_REDIRECT_URI: 'http://localhost:5173/auth/callback',
  DASHBOARD_URL: 'http://localhost:5173',
};

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let settingsRepository: InMemorySettingsRepository;
  let activityService: MockActivityService;

  beforeAll(async () => {
    settingsRepository = new InMemorySettingsRepository();
    activityService = new MockActivityService();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_ENVIRONMENT)
      .useValue(mockEnvironment)
      .overrideProvider(DATABASE_POOL)
      .useValue({ query: vi.fn(), end: vi.fn() })
      .overrideProvider(DATABASE)
      .useValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })) })
      .overrideGuard(SessionAuthGuard)
      .useValue(new TestSessionGuard())
      .overrideGuard(SameOriginGuard)
      .useValue(new TestSameOriginGuard())
      .overrideProvider(SettingsRepository)
      .useValue(settingsRepository)
      .overrideProvider(SettingsUploadService)
      .useValue(new MockSettingsUploadService())
      .overrideProvider(ActivityService)
      .useValue(activityService)
      .overrideProvider(PluginManager)
      .useValue(mockPluginManager)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Settings endpoints', () => {
    it('GET /api/v1/settings returns default settings', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/settings').expect(200);
      expect(response.body.general.appName).toBe('Nexura');
      expect(response.body.appearance.theme).toBe('system');
    });

    it('PATCH /api/v1/settings updates settings and records activity', async () => {
      const patch = {
        general: { appName: 'Code Nexus', supportUrl: null, defaultLanguage: 'en' },
      };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/settings')
        .send(patch)
        .expect(200);

      expect(response.body.general.appName).toBe('Code Nexus');
      expect(activityService.record).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ action: 'settings.updated', resourceId: 'general' }),
      );
    });

    it('PATCH /api/v1/settings/general updates a single section', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/settings/general')
        .send({ appName: 'Nexura Pro' })
        .expect(200);

      expect(response.body.general.appName).toBe('Nexura Pro');
    });

    it('POST /api/v1/settings/branding/logo uploads a branding asset', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/settings/branding/logo')
        .attach('file', Buffer.from('fake-image'), 'logo.png')
        .expect(201);

      expect(response.body.branding.logoUrl).toBe('/api/v1/settings/assets/test-logo.png');
    });

    it('GET /api/v1/settings/manifest.json returns a PWA manifest', async () => {
      const base = appSettingsSchema.parse({});
      base.general.appName = 'Manifest Test';
      await settingsRepository.upsert(base);

      const response = await request(app.getHttpServer()).get('/api/v1/settings/manifest.json').expect(200);
      expect(response.body.name).toBe('Manifest Test');
    });
  });

  describe('Activity endpoints', () => {
    it('GET /api/v1/activity returns an empty list by default', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/activity').expect(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('Auth guards', () => {
    it('unauthenticated requests are rejected by SessionAuthGuard', async () => {
      const rejectingGuard: CanActivate = {
        canActivate: () => false,
      };

      const guardedModule = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(API_ENVIRONMENT)
        .useValue(mockEnvironment)
        .overrideProvider(DATABASE_POOL)
        .useValue({ query: vi.fn(), end: vi.fn() })
        .overrideProvider(DATABASE)
        .useValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })) })
        .overrideGuard(SessionAuthGuard)
        .useValue(rejectingGuard)
        .overrideGuard(SameOriginGuard)
        .useValue(new TestSameOriginGuard())
        .overrideProvider(SettingsRepository)
        .useValue(settingsRepository)
        .overrideProvider(SettingsUploadService)
        .useValue(new MockSettingsUploadService())
        .overrideProvider(ActivityService)
        .useValue(activityService)
        .overrideProvider(PluginManager)
        .useValue(mockPluginManager)
        .compile();

      const guardedApp = guardedModule.createNestApplication();
      guardedApp.setGlobalPrefix('api/v1');
      await guardedApp.init();

      try {
        await request(guardedApp.getHttpServer()).get('/api/v1/settings').expect(403);
      } finally {
        await guardedApp.close();
      }
    });
  });
});
