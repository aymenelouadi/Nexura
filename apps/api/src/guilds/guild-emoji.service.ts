import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@nexura/shared';
import {
  guildChannelSchema,
  guildEmojiSchema,
  type GuildChannel,
  type GuildEmoji,
} from '@nexura/types';
import { z } from 'zod';

import { API_ENVIRONMENT } from '../config/tokens.js';

const discordEmojiSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  animated: z.boolean().optional().default(false),
});
const discordChannelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.number().int(),
});

@Injectable()
export class GuildEmojiService {
  constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  async list(guildId: string): Promise<GuildEmoji[]> {
    const response = await this.getGuildResource(guildId, 'emojis');
    return z
      .array(discordEmojiSchema)
      .parse(await response.json())
      .filter((emoji) => emoji.name !== null)
      .map((emoji) =>
        guildEmojiSchema.parse({
          id: emoji.id,
          name: emoji.name,
          animated: emoji.animated,
          imageUrl: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`,
        }),
      );
  }

  async listTextChannels(guildId: string): Promise<GuildChannel[]> {
    const response = await this.getGuildResource(guildId, 'channels');
    return z
      .array(discordChannelSchema)
      .parse(await response.json())
      .filter((channel) => channel.name && (channel.type === 0 || channel.type === 5))
      .map((channel) =>
        guildChannelSchema.parse({ id: channel.id, name: channel.name, type: channel.type }),
      );
  }

  private async getGuildResource(guildId: string, resource: string): Promise<Response> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/${resource}`, {
      headers: { Authorization: `Bot ${this.environment.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new BadGatewayException('Discord guild resources are temporarily unavailable.');
    }
    return response;
  }
}
