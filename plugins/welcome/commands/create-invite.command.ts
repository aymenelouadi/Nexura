import type { PluginContext } from '@nexura/shared';

export async function registerCreateInviteCommand(context: PluginContext): Promise<void> {
  await context.commands.register({
    commandId: 'create_invite',
    name: 'create_invite',
    description: 'Create an invite link for the server.',
    type: 'BOTH',
    aliases: ['invite', 'newinvite'],
    defaultPermissions: ['CreateInstantInvite'],
    handler: async (invocation) => {
      const invite = await context.commands.createInvite(invocation.channelId, { unique: true });
      await invocation.respond({ type: 'text', content: invite });
      await context.logger.audit('Create invite command used.', {
        category: 'command_used',
        commandId: 'create_invite',
        userId: invocation.userId,
      });
    },
  });
}
