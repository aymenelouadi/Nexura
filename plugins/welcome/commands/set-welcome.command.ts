import type { PluginContext } from '@nexura/shared';

import type { WelcomeSettingsService } from '../services/settings-service.js';

export async function registerSetWelcomeCommand(
  context: PluginContext,
  settings: WelcomeSettingsService,
): Promise<void> {
  await context.commands.register({
    commandId: 'setwelcome',
    name: 'setwelcome',
    description: 'Enable or disable welcome messages.',
    type: 'BOTH',
    aliases: ['welcome-toggle'],
    options: [
      {
        name: 'enabled',
        description: 'Whether welcome messages should be enabled.',
        type: 'BOOLEAN',
        required: true,
      },
    ],
    defaultPermissions: ['ManageGuild'],
    handler: async (invocation) => {
      const raw = invocation.options.enabled ?? invocation.args[0];
      const enabled = raw === true || raw === 'true' || raw === 'on' || raw === 'enable';
      const current = await settings.getWelcome();
      await settings.saveWelcome({ ...current, enabled });
      await invocation.respond({
        type: 'text',
        content: `Welcome messages are now **${enabled ? 'enabled' : 'disabled'}**.`,
      });
      await context.logger.audit('Welcome settings updated by command.', {
        category: 'settings_updated',
        commandId: 'setwelcome',
        enabled,
        userId: invocation.userId,
      });
    },
  });
}
