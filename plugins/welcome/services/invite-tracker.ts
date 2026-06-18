import type { PluginEvents, PluginInvite, PluginLogger, PluginStorage } from '@nexura/shared';

export interface ResolvedInvite {
  inviter: string;
  inviterName: string;
  invitesCount: string;
  inviteCode: string;
}

export const unavailableInvite: ResolvedInvite = {
  inviter: 'Unknown',
  inviterName: 'Unknown',
  invitesCount: '0',
  inviteCode: 'Unavailable',
};

export class InviteTracker {
  constructor(
    private readonly events: PluginEvents,
    private readonly storage: PluginStorage,
    private readonly logger: PluginLogger,
  ) {}

  async prime(): Promise<void> {
    try {
      await this.saveSnapshot(await this.events.getGuildInvites());
    } catch (error) {
      await this.logger.warn('Invite cache could not be initialized.', {
        category: 'invite_resolve_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async resolveUsedInvite(): Promise<ResolvedInvite> {
    try {
      const previous = (await this.storage.get<PluginInvite[]>('invite-cache')) ?? [];
      const current = await this.events.getGuildInvites();
      await this.saveSnapshot(current);
      const used = current.find((invite) => {
        const old = previous.find((candidate) => candidate.code === invite.code);
        return invite.uses > (old?.uses ?? 0);
      });
      if (!used) {
        return unavailableInvite;
      }
      await this.logger.info('Invite resolved.', {
        category: 'invite_resolved',
        inviteCode: used.code,
        inviterId: used.inviterId,
      });
      return {
        inviter: used.inviterId ? `<@${used.inviterId}>` : 'Unknown',
        inviterName: used.inviterName ?? 'Unknown',
        invitesCount: String(used.uses),
        inviteCode: used.code,
      };
    } catch (error) {
      await this.logger.warn('Invite resolution failed.', {
        category: 'invite_resolve_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return unavailableInvite;
    }
  }

  private saveSnapshot(invites: PluginInvite[]): Promise<void> {
    return this.storage.set('invite-cache', invites);
  }
}
