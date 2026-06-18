import type { PluginContext, PluginModule } from '@nexura/shared';

import { registerCreateInviteCommand } from './commands/create-invite.command.js';
import { registerSetWelcomeCommand } from './commands/set-welcome.command.js';
import { registerMemberEvents } from './events/member-events.js';
import { InviteTracker } from './services/invite-tracker.js';
import { WelcomeSettingsService } from './services/settings-service.js';
import { WelcomeTemplateService } from './services/template-service.js';

class WelcomePlugin implements PluginModule {
  async onInstall(context: PluginContext): Promise<void> {
    await new WelcomeTemplateService(context.templates).ensureDefaults();
    await context.logger.info('Welcome plugin installed.', { category: 'plugin_installed' });
  }

  async onEnable(context: PluginContext): Promise<void> {
    const settings = new WelcomeSettingsService(context.storage);
    const templates = new WelcomeTemplateService(context.templates);
    const invites = new InviteTracker(context.events, context.storage, context.logger);
    await templates.ensureDefaults();
    await invites.prime();
    await registerCreateInviteCommand(context);
    await registerSetWelcomeCommand(context, settings);
    registerMemberEvents(context, settings, templates, invites);
    await context.logger.info('Welcome plugin enabled.', { category: 'plugin_enabled' });
  }

  async onDisable(context: PluginContext): Promise<void> {
    context.scheduler.cancelAll();
    await context.logger.info('Welcome plugin disabled.', { category: 'plugin_disabled' });
  }

  async onUpdate(context: PluginContext): Promise<void> {
    await new WelcomeTemplateService(context.templates).ensureDefaults();
    await context.logger.info('Welcome plugin updated.', { category: 'plugin_updated' });
  }

  async onUninstall(context: PluginContext): Promise<void> {
    context.scheduler.cancelAll();
    await context.logger.info('Welcome plugin uninstalled.', { category: 'plugin_uninstalled' });
  }
}

export default new WelcomePlugin();
