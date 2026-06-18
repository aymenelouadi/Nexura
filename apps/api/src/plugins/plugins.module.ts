import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GuildsModule } from '../guilds/guilds.module.js';
import { PluginDiscoveryService } from './plugin-discovery.service.js';
import { PluginCoreRepository } from './plugin-core.repository.js';
import { PluginManager } from './plugin-manager.service.js';
import { PluginMigrationService } from './plugin-migration.service.js';
import { PluginRepository } from './plugin.repository.js';
import { PluginsController } from './plugins.controller.js';
import { PluginTestService } from './plugin-test.service.js';

@Module({
  imports: [AuthModule, GuildsModule, ActivityModule],
  controllers: [PluginsController],
  providers: [
    PluginDiscoveryService,
    PluginCoreRepository,
    PluginManager,
    PluginMigrationService,
    PluginRepository,
    PluginTestService,
  ],
  exports: [PluginCoreRepository, PluginManager, PluginTestService],
})
export class PluginsModule {}
