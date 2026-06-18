import type { PluginContext, PluginEventPayload } from '@nexura/shared';

import { WelcomeDeliveryService } from '../services/delivery-service.js';
import type { InviteTracker } from '../services/invite-tracker.js';
import type { WelcomeSettingsService } from '../services/settings-service.js';
import type { WelcomeTemplateService } from '../services/template-service.js';

export function registerMemberEvents(
  context: PluginContext,
  settings: WelcomeSettingsService,
  templates: WelcomeTemplateService,
  invites: InviteTracker,
): void {
  const delivery = new WelcomeDeliveryService(context);
  context.events.on('guildMemberAdd', async (event) => {
    const welcome = await settings.getWelcome();
    const dm = await settings.getDm();
    if (!welcome.enabled && !dm.enabled) return;

    const variables = await createVariables(event, invites);
    if (welcome.enabled && welcome.channelId) {
      const template = await templates.get(welcome.templateId);
      if (template) {
        const receipt = await delivery.sendChannel(welcome.channelId, template, variables);
        if (welcome.autoDeleteEnabled) {
          delivery.scheduleDelete(receipt, welcome.autoDeleteAfterSeconds);
        }
        await context.logger.info('Welcome message sent.', {
          category: 'welcome_message_sent',
          userId: event.userId,
          channelId: welcome.channelId,
        });
      }
    }

    if (dm.enabled) {
      const template = await templates.get(dm.templateId);
      if (!template) return;
      try {
        await delivery.sendDirect(String(event.userId), template, variables);
        await context.logger.info('DM welcome sent.', {
          category: 'dm_welcome_sent',
          userId: event.userId,
        });
      } catch (error) {
        await context.logger.warn('DM welcome failed.', {
          category: 'dm_failed',
          userId: event.userId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (dm.fallbackIfDmClosed && dm.fallbackChannelId) {
          await delivery.sendChannel(dm.fallbackChannelId, template, variables);
        }
      }
    }
  });

  context.events.on('guildMemberRemove', async (event) => {
    const leave = await settings.getLeave();
    if (!leave.enabled || !leave.channelId) return;
    const template = await templates.get(leave.templateId);
    if (!template) return;
    const receipt = await delivery.sendChannel(
      leave.channelId,
      template,
      await createVariables(event, invites, false),
    );
    if (leave.autoDeleteEnabled) {
      delivery.scheduleDelete(receipt, leave.autoDeleteAfterSeconds);
    }
    await context.logger.info('Leave message sent.', {
      category: 'leave_message_sent',
      userId: event.userId,
      channelId: leave.channelId,
    });
  });
}

function formatVariable(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

async function createVariables(
  event: PluginEventPayload,
  invites: InviteTracker,
  resolveInvite = true,
): Promise<Record<string, string>> {
  const invite = resolveInvite ? await invites.resolveUsedInvite() : null;
  const createdAt = new Date(formatVariable(event.userCreatedAt, String(Date.now())));
  const ageDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
  return {
    user: `<@${formatVariable(event.userId, '')}>`,
    userName: formatVariable(event.userName, 'Unknown'),
    userCreatedDate: createdAt.toLocaleDateString('en-US'),
    userCreatedDays: String(ageDays),
    serverName: formatVariable(event.serverName, 'Server'),
    memberCount: formatVariable(event.memberCount, '0'),
    inviter: invite?.inviter ?? unavailable(),
    inviterName: invite?.inviterName ?? unavailable(),
    invitesCount: invite?.invitesCount ?? '0',
    inviteCode: invite?.inviteCode ?? unavailable(),
  };
}

function unavailable(): string {
  return 'Unavailable';
}
