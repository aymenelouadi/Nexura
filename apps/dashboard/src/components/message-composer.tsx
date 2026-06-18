import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@nexura/ui';
import type { ComponentsV2Message, CoreMessage, EmbedMessage } from '@nexura/types';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';

import { DiscordMessagePreview } from './discord-message-preview.js';
import { EmojiInsertMenu } from './emoji-insert-menu.js';
import { VariableInsertMenu } from './variable-insert-menu.js';

export type MessageMode = 'text' | 'embed' | 'components_v2';

export function createDefaultMessage(mode: MessageMode): CoreMessage {
  if (mode === 'embed') {
    return { type: 'embed', title: '', description: '', color: 0x5865f2, fields: [] };
  }
  if (mode === 'components_v2') {
    return { type: 'components_v2', components: [{ type: 'container', spoiler: false, items: [{ type: 'text_display', content: '' }] }] };
  }
  return { type: 'text', content: '' };
}

export interface MessageComposerProps {
  guildId: string;
  mode: MessageMode;
  value: CoreMessage | null;
  variables?: Array<{ key: string; label: string; description: string; group: string }>;
  placeholder?: string;
  showPreview?: boolean;
  onModeChange: (mode: MessageMode) => void;
  onChange: (message: CoreMessage) => void;
}

export function MessageComposer({
  guildId,
  mode,
  value,
  variables,
  placeholder,
  showPreview = true,
  onModeChange,
  onChange,
}: MessageComposerProps) {
  const [activeField, setActiveField] = useState<string>('content');
  const message = value?.type === mode ? value : createDefaultMessage(mode);

  function insertText(text: string) {
    if (message.type === 'text') {
      onChange({ ...message, content: append(message.content, text) });
      return;
    }
    if (message.type === 'embed') {
      updateEmbedField(message, activeField, text, onChange);
      return;
    }
    updateComponentsText(message, text, onChange);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-sm">Message composer</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Choose one message type, then configure only the fields for that type.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Message Type">
            {(['text', 'embed', 'components_v2'] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={mode === item ? 'default' : 'outline'}
                onClick={() => {
                  onModeChange(item);
                  onChange(createDefaultMessage(item));
                }}
              >
                {item === 'text' ? 'Text' : item === 'embed' ? 'Embed' : 'Components V2'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className={showPreview ? 'grid gap-5 p-5 xl:grid-cols-[1fr_420px]' : 'p-5'}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <EmojiInsertMenu guildId={guildId} onInsert={insertText} />
            <VariableInsertMenu variables={variables} onInsert={insertText} />
          </div>
          {message.type === 'text' ? <TextEditor placeholder={placeholder} message={message} onFocus={() => setActiveField('content')} onChange={onChange} /> : null}
          {message.type === 'embed' ? <EmbedEditor message={message} activeField={activeField} onFocus={setActiveField} onChange={onChange} /> : null}
          {message.type === 'components_v2' ? <ComponentsEditor message={message} onChange={onChange} /> : null}
        </div>
        {showPreview ? <DiscordMessagePreview message={message} /> : null}
      </CardContent>
    </Card>
  );
}

function TextEditor({ message, placeholder, onFocus, onChange }: { message: { type: 'text'; content: string }; placeholder?: string | undefined; onFocus: () => void; onChange: (message: CoreMessage) => void }) {
  return (
    <Field label="Content">
      <Textarea placeholder={placeholder} value={message.content} onFocus={onFocus} onChange={(event) => onChange({ ...message, content: event.target.value })} />
    </Field>
  );
}

function EmbedEditor({
  message,
  activeField,
  onFocus,
  onChange,
}: {
  message: EmbedMessage;
  activeField: string;
  onFocus: (field: string) => void;
  onChange: (message: CoreMessage) => void;
}) {
  const fields = message.fields ?? [];
  const update = (patch: Partial<EmbedMessage>) => onChange({ ...message, ...patch });
  return (
    <div className="grid gap-4">
      <Field label="Content (optional)">
        <Textarea onFocus={() => onFocus('description')} value={message.description ?? ''} onChange={(event) => update({ description: event.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Embed title" value={message.title ?? ''} onFocus={() => onFocus('title')} onChange={(value) => update({ title: value })} />
        <TextInput label="Embed color" type="color" value={`#${(message.color ?? 0x5865f2).toString(16).padStart(6, '0')}`} onChange={(value) => update({ color: Number.parseInt(value.replace('#', ''), 16) })} />
        <TextInput label="Author" value={message.author?.name ?? ''} onFocus={() => onFocus('author')} onChange={(value) => update({ author: value ? { name: value } : undefined })} />
        <TextInput label="Footer" value={message.footer?.text ?? ''} onFocus={() => onFocus('footer')} onChange={(value) => update({ footer: value ? { text: value } : undefined })} />
        <TextInput label="Thumbnail URL" value={message.thumbnailUrl ?? ''} onChange={(value) => update({ thumbnailUrl: value || undefined })} />
        <TextInput label="Image URL" value={message.imageUrl ?? ''} onChange={(value) => update({ imageUrl: value || undefined })} />
      </div>
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Fields</p>
          <Button type="button" variant="outline" size="xs" onClick={() => update({ fields: [...fields, { name: 'Field', value: 'Value', inline: false }] })}>
            <PlusIcon data-icon="inline-start" /> Add field
          </Button>
        </div>
        <div className="mt-3 grid gap-3">
          {fields.map((field, index) => (
            <div key={index} className="grid gap-2 rounded-md bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
              <Input value={field.name} onFocus={() => onFocus(`field:${index}:name`)} onChange={(event) => update({ fields: fields.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })} />
              <Input value={field.value} onFocus={() => onFocus(`field:${index}:value`)} onChange={(event) => update({ fields: fields.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)) })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => update({ fields: fields.filter((_, i) => i !== index) })} aria-label="Remove field"><TrashIcon /></Button>
            </div>
          ))}
          {fields.length === 0 ? <p className="text-sm text-muted-foreground">No fields yet.</p> : null}
        </div>
      </div>
      <span className="sr-only">Active embed field: {activeField}</span>
    </div>
  );
}

function ComponentsEditor({ message, onChange }: { message: ComponentsV2Message; onChange: (message: CoreMessage) => void }) {
  const container = message.components[0] ?? { type: 'container' as const, spoiler: false, items: [] };
  const items = container.items;
  const updateItems = (nextItems: typeof items) => onChange({ ...message, components: [{ ...container, items: nextItems }] });
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Components V2 builder</p>
          <p className="mt-1 text-xs text-muted-foreground">Containers, text displays, buttons, separators, sections, and media items.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => updateItems([...items, { type: 'text_display', content: 'New text block' }])}>Text</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => updateItems([...items, { type: 'button', id: `button-${items.length + 1}`, label: 'Button', style: 'primary', disabled: false }])}>Button</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => updateItems([...items, { type: 'separator', spacing: 'small', divider: true }])}>Separator</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => updateItems([...items, { type: 'media', url: 'https://example.com/image.png', description: 'Media item', spoiler: false }])}>Media</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => updateItems([...items, { type: 'section', content: 'Section text', accessory: { type: 'button', id: `section-${items.length + 1}`, label: 'Open', style: 'secondary', disabled: false } }])}>Section</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-md bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <BadgeText>{item.type}</BadgeText>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateItems(items.filter((_, i) => i !== index))} aria-label="Remove component"><TrashIcon /></Button>
            </div>
            {'content' in item ? <Textarea value={item.content} onChange={(event) => updateItems(items.map((entry, i) => (i === index ? { ...item, content: event.target.value } : entry)))} /> : null}
            {'label' in item ? <Input value={item.label} onChange={(event) => updateItems(items.map((entry, i) => (i === index ? { ...item, label: event.target.value } : entry)))} /> : null}
            {item.type === 'media' ? <Input value={item.url} onChange={(event) => updateItems(items.map((entry, i) => (i === index ? { ...item, url: event.target.value } : entry)))} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextInput({ label, value, type = 'text', onFocus, onChange }: { label: string; value: string; type?: string; onFocus?: () => void; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Input type={type} value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function BadgeText({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</span>;
}

function append(value: string | undefined, text: string): string {
  return `${value ?? ''}${text}`;
}

function updateEmbedField(message: EmbedMessage, field: string, text: string, onChange: (message: CoreMessage) => void): void {
  if (field === 'title') onChange({ ...message, title: append(message.title, text) });
  else if (field === 'author') onChange({ ...message, author: { name: append(message.author?.name, text) } });
  else if (field === 'footer') onChange({ ...message, footer: { text: append(message.footer?.text, text) } });
  else if (field.startsWith('field:')) {
    const [, indexText, target] = field.split(':');
    const index = Number(indexText);
    onChange({ ...message, fields: (message.fields ?? []).map((item, i) => (i === index ? { ...item, [target ?? 'value']: append(String(item[target as 'name' | 'value'] ?? ''), text) } : item)) });
  } else onChange({ ...message, description: append(message.description, text) });
}

function updateComponentsText(message: ComponentsV2Message, text: string, onChange: (message: CoreMessage) => void): void {
  const [container] = message.components;
  if (!container) return;
  onChange({
    ...message,
    components: [{
      ...container,
      items: container.items.map((item, index) => {
        if (index !== 0) return item;
        if ('content' in item) return { ...item, content: append(item.content, text) };
        if ('label' in item) return { ...item, label: append(item.label, text) };
        return item;
      }),
    }],
  });
}
