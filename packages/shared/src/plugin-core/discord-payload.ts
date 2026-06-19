import type {
  ComponentsV2Button,
  ComponentsV2Container,
  ComponentsV2Message,
  CoreMessage,
  EmbedMessage,
} from '@nexura/types';

export interface DiscordApiMessage {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  flags?: number;
}

const COMPONENTS_V2_FLAG = 1 << 15;

export function toDiscordApiPayload(message: CoreMessage): DiscordApiMessage {
  if (message.type === 'text') {
    return { content: message.content };
  }
  if (message.type === 'embed') {
    return { embeds: [buildDiscordEmbed(message)] };
  }
  return buildComponentsV2Payload(message);
}

function buildDiscordEmbed(message: EmbedMessage): Record<string, unknown> {
  const embed: Record<string, unknown> = { fields: message.fields };
  if (message.title !== undefined && message.title !== '') embed.title = message.title;
  if (message.description !== undefined && message.description !== '') embed.description = message.description;
  if (message.color !== undefined) embed.color = message.color;
  if (message.author !== undefined && message.author.name) {
    embed.author = {
      name: message.author.name,
      ...(message.author.iconUrl ? { icon_url: message.author.iconUrl } : {}),
      ...(message.author.url ? { url: message.author.url } : {}),
    };
  }
  if (message.footer !== undefined && message.footer.text) {
    const footer: Record<string, string> = { text: message.footer.text };
    if (message.footer.iconUrl) {
      footer.icon_url = message.footer.iconUrl;
    }
    embed.footer = footer;
  }
  if (message.thumbnailUrl) embed.thumbnail = { url: message.thumbnailUrl };
  if (message.imageUrl) embed.image = { url: message.imageUrl };
  return embed;
}

function buildComponentsV2Payload(message: ComponentsV2Message): DiscordApiMessage {
  return {
    flags: COMPONENTS_V2_FLAG,
    components: message.components.map(toDiscordContainer),
  };
}

function toDiscordContainer(container: ComponentsV2Container): Record<string, unknown> {
  return {
    type: 17,
    spoiler: container.spoiler,
    components: container.items.flatMap((item): unknown[] => {
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

function toDiscordButton(button: ComponentsV2Button): Record<string, unknown> {
  if (button.style === 'link') {
    if (!button.url) {
      throw new Error('Link buttons must have a URL.');
    }
    return { type: 2, style: 5, label: button.label, disabled: button.disabled, url: button.url };
  }
  const style = ({ primary: 1, secondary: 2, success: 3, danger: 4 } as Record<string, number>)[
    String(button.style)
  ];
  if (style === undefined) {
    throw new Error(`Unsupported button style: ${String(button.style)}`);
  }
  return { type: 2, style, label: button.label, disabled: button.disabled, custom_id: button.id };
}
