import type { CoreMessage } from '@nexura/types';
import {
  MessageFlags,
  type APIButtonComponent,
  type APIContainerComponent,
  type InteractionReplyOptions,
  type MessageCreateOptions,
} from 'discord.js';

export type DiscordReply = InteractionReplyOptions & MessageCreateOptions;
type ComponentsV2Message = Extract<CoreMessage, { type: 'components_v2' }>;
type ComponentsV2Container = ComponentsV2Message['components'][number];
type ComponentsV2Button = Extract<
  ComponentsV2Container['items'][number],
  { type: 'button' }
>;

export function toDiscordReply(message: CoreMessage): DiscordReply {
  if (message.type === 'text') {
    return { content: message.content };
  }
  if (message.type === 'embed') {
    const embed: Record<string, unknown> = { fields: message.fields };
    if (message.title !== undefined) embed.title = message.title;
    if (message.description !== undefined) embed.description = message.description;
    if (message.color !== undefined) embed.color = message.color;
    if (message.author !== undefined) embed.author = message.author;
    if (message.footer !== undefined) embed.footer = message.footer;
    if (message.thumbnailUrl !== undefined) embed.thumbnail = { url: message.thumbnailUrl };
    if (message.imageUrl !== undefined) embed.image = { url: message.imageUrl };
    return { embeds: [embed] };
  }
  return {
    flags: MessageFlags.IsComponentsV2,
    components: message.components.map(toDiscordContainer),
  };
}

function toDiscordContainer(container: ComponentsV2Container): APIContainerComponent {
  return {
    type: 17,
    spoiler: container.spoiler,
    components: container.items.flatMap((item): APIContainerComponent['components'] => {
      if (item.type === 'text_display') {
        return [{ type: 10, content: item.content }];
      }
      if (item.type === 'separator') {
        return [{ type: 14, divider: item.divider, spacing: item.spacing === 'large' ? 2 : 1 }];
      }
      if (item.type === 'media') {
        return [
          {
            type: 12,
            items: [
              {
                media: { url: item.url },
                ...(item.description === undefined ? {} : { description: item.description }),
                spoiler: item.spoiler,
              },
            ],
          },
        ];
      }
      if (item.type === 'section') {
        return [
          {
            type: 9,
            components: [{ type: 10, content: item.content }],
            accessory: toDiscordButton(item.accessory),
          },
        ];
      }
      return [{ type: 1, components: [toDiscordButton(item)] }];
    }),
  };
}

function toDiscordButton(button: ComponentsV2Button): APIButtonComponent {
  if (button.style === 'link') {
    return {
      type: 2,
      style: 5,
      label: button.label,
      disabled: button.disabled,
      url: button.url ?? 'https://discord.com',
    };
  }
  const style = (
    { primary: 1, secondary: 2, success: 3, danger: 4 } as Record<
      Exclude<ComponentsV2Button['style'], 'link'>,
      1 | 2 | 3 | 4
    >
  )[button.style];
  return {
    type: 2,
    style,
    label: button.label,
    disabled: button.disabled,
    custom_id: button.id,
  };
}
