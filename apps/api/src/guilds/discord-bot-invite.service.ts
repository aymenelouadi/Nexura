import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@nexura/shared';

import { API_ENVIRONMENT } from '../config/tokens.js';

const REQUIRED_BOT_PERMISSIONS = '0';

@Injectable()
export class DiscordBotInviteService {
  constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  createInviteUrl(guildId: string): string {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: this.environment.DISCORD_CLIENT_ID,
      scope: 'bot applications.commands',
      permissions: REQUIRED_BOT_PERMISSIONS,
      guild_id: guildId,
      disable_guild_select: 'true',
      integration_type: '0',
    }).toString();
    return url.toString();
  }
}
