import { Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@nexura/ui';
import type { ComponentsV2Message, CoreMessage, EmbedMessage } from '@nexura/types';

export const samplePreviewData: Record<string, string> = {
  user: '@Mira',
  userName: 'Mira',
  userCreatedDate: 'Jan 14, 2023',
  userCreatedDays: '521',
  serverName: 'Nexura Labs',
  memberCount: '12,482',
  inviter: '@Nora',
  inviterName: 'Nora',
  invitesCount: '42',
  inviteCode: 'nexura',
};

export interface DiscordMessagePreviewProps {
  message: CoreMessage;
  botName?: string | undefined;
  botAvatarUrl?: string | null | undefined;
}

export function DiscordMessagePreview({
  message,
  botName = 'Nexura',
  botAvatarUrl,
}: DiscordMessagePreviewProps) {
  const text = resolveVariables(getMessageText(message), samplePreviewData);
  const direction = isRtl(text) ? 'rtl' : 'ltr';

  return (
    <div className="rounded-xl border border-border bg-[#313338] p-4 text-[#dbdee1] shadow-inner">
      <div className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0 rounded-full">
          <AvatarImage src={botAvatarUrl ?? undefined} alt={botName} className="rounded-full" />
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{botName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{botName}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">APP</Badge>
            <span className="text-xs text-[#949ba4]">Today at 9:41 PM</span>
          </div>
          {text ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6" dir={direction}>{text}</p>
          ) : (
            <p className="mt-1 text-sm italic text-[#949ba4]">Message preview will appear here.</p>
          )}
          {message.type === 'embed' ? <EmbedPreview message={message} /> : null}
          {message.type === 'components_v2' ? <ComponentsPreview message={message} /> : null}
        </div>
      </div>
    </div>
  );
}

function EmbedPreview({ message }: { message: EmbedMessage }) {
  const color = typeof message.color === 'number' ? `#${message.color.toString(16).padStart(6, '0')}` : '#5865f2';
  const fields = message.fields ?? [];
  return (
    <div className="mt-3 max-w-xl overflow-hidden rounded border-l-4 bg-[#2b2d31] p-3" style={{ borderLeftColor: color }}>
      {message.author?.name ? <p className="text-xs font-semibold text-white">{resolveVariables(message.author.name, samplePreviewData)}</p> : null}
      {message.title ? <p className="mt-1 font-semibold text-white">{resolveVariables(message.title, samplePreviewData)}</p> : null}
      {message.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{resolveVariables(message.description, samplePreviewData)}</p> : null}
      {fields.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.map((field, index) => (
            <div key={`${field.name}-${index}`} className={cn(!field.inline && 'sm:col-span-2')}>
              <p className="text-xs font-semibold text-white">{resolveVariables(field.name, samplePreviewData)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{resolveVariables(field.value, samplePreviewData)}</p>
            </div>
          ))}
        </div>
      ) : null}
      {message.thumbnailUrl ? <img src={message.thumbnailUrl} alt="Embed thumbnail" className="mt-3 size-16 rounded object-cover" /> : null}
      {message.imageUrl ? <img src={message.imageUrl} alt="Embed image" className="mt-3 max-h-56 rounded object-cover" /> : null}
      {message.footer?.text ? <p className="mt-3 text-xs text-[#949ba4]">{resolveVariables(message.footer.text, samplePreviewData)}</p> : null}
    </div>
  );
}

function ComponentsPreview({ message }: { message: ComponentsV2Message }) {
  return (
    <div className="mt-3 flex max-w-xl flex-col gap-2">
      {message.components.map((container, containerIndex) => (
        <div key={containerIndex} className="rounded-lg border border-[#3f4147] bg-[#2b2d31] p-3">
          {container.items.map((item, itemIndex) => {
            if (item.type === 'text_display') {
              return <p key={itemIndex} className="whitespace-pre-wrap text-sm leading-6">{resolveVariables(item.content, samplePreviewData)}</p>;
            }
            if (item.type === 'separator') {
              return <div key={itemIndex} className="my-2 h-px bg-[#3f4147]" />;
            }
            if (item.type === 'media') {
              return <div key={itemIndex} className="my-2 rounded-md border border-[#3f4147] p-2 text-xs text-[#949ba4]">{item.description || item.url}</div>;
            }
            if (item.type === 'section') {
              return (
                <div key={itemIndex} className="flex items-center justify-between gap-3">
                  <p className="text-sm">{resolveVariables(item.content, samplePreviewData)}</p>
                  <button type="button" className="rounded bg-[#4e5058] px-3 py-1 text-xs text-white">{item.accessory.label}</button>
                </div>
              );
            }
            return <button key={itemIndex} type="button" className="mt-2 rounded bg-[#5865f2] px-3 py-1.5 text-sm text-white">{item.label}</button>;
          })}
        </div>
      ))}
    </div>
  );
}

function getMessageText(message: CoreMessage): string {
  if (message.type === 'text') return message.content;
  if (message.type === 'embed') return '';
  return '';
}

export function resolveVariables(value: string, data: Record<string, string> = samplePreviewData): string {
  return value.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/gu, (match, name: string) => data[name] ?? match);
}

function isRtl(value: string): boolean {
  return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/u.test(value);
}
