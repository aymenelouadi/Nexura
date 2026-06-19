import type { CoreMessage } from '@nexura/types';
import { toDiscordApiPayload } from '@nexura/shared';
import type {
  InteractionReplyOptions,
  MessageCreateOptions,
} from 'discord.js';

export type DiscordReply = InteractionReplyOptions & MessageCreateOptions;

export function toDiscordReply(message: CoreMessage): DiscordReply {
  return toDiscordApiPayload(message) as DiscordReply;
}
