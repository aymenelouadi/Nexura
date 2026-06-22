import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CoreSaveBar,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@nexura/ui';
import { formatLogMessage, resolveVariable, type LogVariables } from '@nexura/shared';
import type { CoreMessage, GuildPlugin } from '@nexura/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  BanIcon,
  BugIcon,
  CheckCircle2Icon,
  Edit3Icon,
  EyeIcon,
  HashIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  MessageSquareXIcon,
  PaletteIcon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  UserPlusIcon,
  Wand2Icon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import { toast } from 'sonner';

import { botProfileQuery, guildChannelsQuery, guildPluginStorageQuery } from '../hooks/queries.js';
import { api } from '../lib/api-client.js';
import { CoreSwitch } from './core-switch.js';
import { DiscordMessagePreview } from './discord-message-preview.js';
import { ErrorState } from './error-state.js';

type LogFormat = 'embed' | 'components_v2';
type LogCategory = 'Members' | 'Moderation' | 'Messages' | 'Channels' | 'Roles';
type FieldTarget = 'title' | 'description' | 'footer';

interface LogTypeConfig {
  enabled?: boolean | undefined;
  channelId?: string | null | undefined;
  format?: LogFormat | undefined;
  color?: number | undefined;
  title?: string | undefined;
  description?: string | undefined;
  footer?: string | undefined;
  showTimestamp?: boolean | undefined;
  showAvatar?: boolean | undefined;
}

interface LogsSettings {
  enabled: boolean;
  defaultChannelId: string | null;
  defaultFormat: LogFormat;
  defaultColor: number;
  defaultTitle: string;
  defaultFooter: string;
  showTimestamp: boolean;
  showAvatar: boolean;
  logTypes: Record<string, unknown>;
}

interface LogDefinition {
  id: string;
  category: LogCategory;
  name: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  sample: Record<string, string>;
  defaults: { title: string; description: string; color: number };
  availableVariables: string[];
}

interface ResolvedLogConfig {
  enabled: boolean;
  channelId: string | null;
  format: LogFormat;
  color: number;
  title: string;
  description: string;
  footer: string;
  showTimestamp: boolean;
  showAvatar: boolean;
}

const defaultSettings: LogsSettings = {
  enabled: true, defaultChannelId: null, defaultFormat: 'embed', defaultColor: 0x5865f2,
  defaultTitle: 'Server Log', defaultFooter: '', showTimestamp: true, showAvatar: true, logTypes: {},
};

const categories: LogCategory[] = ['Members', 'Moderation', 'Messages', 'Channels', 'Roles'];

const logDefinitions: LogDefinition[] = [
  { id: 'member.joined', category: 'Members', name: 'Member Joined', description: 'When a new member joins your server', icon: UserPlusIcon, sample: { user: '@Shaad', 'user.id': '756947441592303707', 'user.tag': 'shaad', 'user.name': 'Shaad', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Member Joined', description: '[user] joined the server.', color: 0x22c55e }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'member.left', category: 'Members', name: 'Member Left', description: 'When a member leaves your server', icon: LogOutIcon, sample: { user: '@Aymen', 'user.id': '648201390120330241', 'user.tag': 'aymen', 'user.name': 'Aymen', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Member Left', description: '[user] left the server.', color: 0xf97316 }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'member.banned', category: 'Moderation', name: 'Member Banned', description: 'When someone is banned from your server', icon: BanIcon, sample: { user: '@TroubleMaker', 'user.id': '553192481902332111', 'user.tag': 'troublemaker', 'user.name': 'TroubleMaker', executor: '@Admin', 'executor.id': '756947441592303707', 'executor.tag': 'admin', 'executor.name': 'Admin', reason: 'Spam links', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Member Banned', description: '[user] was banned. Reason: [reason]', color: 0xef4444 }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[executor]', '[executor.name]', '[executor.id]', '[reason]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'member.unbanned', category: 'Moderation', name: 'Member Unbanned', description: 'When someone is unbanned from your server', icon: ShieldIcon, sample: { user: '@ReturningUser', 'user.id': '673219481902332111', 'user.tag': 'returninguser', 'user.name': 'ReturningUser', executor: '@Admin', 'executor.id': '756947441592303707', 'executor.tag': 'admin', 'executor.name': 'Admin', reason: 'Appeal accepted', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Member Unbanned', description: '[user] was unbanned.', color: 0x3b82f6 }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[executor]', '[executor.name]', '[executor.id]', '[reason]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'message.deleted', category: 'Messages', name: 'Message Deleted', description: 'When a message is deleted', icon: MessageSquareXIcon, sample: { user: '@Aymen', 'user.id': '648201390120330241', 'user.tag': 'aymen', 'user.name': 'Aymen', channel: '#general', 'channel.id': '123456789012345678', 'channel.name': 'general', 'message.content': 'hello, this is a deleted message', messageId: '123456789', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Message Deleted', description: '[user] deleted a message in [channel].', color: 0xef4444 }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[channel]', '[channel.name]', '[channel.id]', '[message.content]', '[message.id]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'message.edited', category: 'Messages', name: 'Message Edited', description: 'When a message is edited', icon: Edit3Icon, sample: { user: '@Aymen', 'user.id': '648201390120330241', 'user.tag': 'aymen', 'user.name': 'Aymen', channel: '#general', 'channel.id': '123456789012345678', 'channel.name': 'general', oldContent: 'helo world', newContent: 'hello world', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Message Edited', description: '[user] edited a message in [channel].', color: 0xeab308 }, availableVariables: ['[user]', '[user.name]', '[user.id]', '[user.tag]', '[channel]', '[channel.name]', '[channel.id]', '[message.content]', '[oldContent]', '[newContent]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'channel.created', category: 'Channels', name: 'Channel Created', description: 'When a channel is created', icon: HashIcon, sample: { channel: '#announcements', 'channel.id': '998877665544332211', 'channel.name': 'announcements', executor: '@Shaad', 'executor.id': '756947441592303707', 'executor.tag': 'shaad', 'executor.name': 'Shaad', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Channel Created', description: '[channel] was created by [executor].', color: 0x22c55e }, availableVariables: ['[channel]', '[channel.name]', '[channel.id]', '[executor]', '[executor.name]', '[executor.id]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'channel.deleted', category: 'Channels', name: 'Channel Deleted', description: 'When a channel is deleted', icon: HashIcon, sample: { channel: '#old-chat', 'channel.id': '887766554433221100', 'channel.name': 'old-chat', executor: '@Shaad', 'executor.id': '756947441592303707', 'executor.tag': 'shaad', 'executor.name': 'Shaad', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Channel Deleted', description: '[channel] was deleted by [executor].', color: 0xef4444 }, availableVariables: ['[channel]', '[channel.name]', '[channel.id]', '[executor]', '[executor.name]', '[executor.id]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'role.created', category: 'Roles', name: 'Role Created', description: 'When a role is created', icon: SparklesIcon, sample: { role: '@Moderator', 'role.id': '112233445566778899', 'role.name': 'Moderator', executor: '@Shaad', 'executor.id': '756947441592303707', 'executor.tag': 'shaad', 'executor.name': 'Shaad', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Role Created', description: '[role] was created by [executor].', color: 0x22c55e }, availableVariables: ['[role]', '[role.name]', '[role.id]', '[executor]', '[executor.name]', '[executor.id]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
  { id: 'role.deleted', category: 'Roles', name: 'Role Deleted', description: 'When a role is deleted', icon: SparklesIcon, sample: { role: '@Muted', 'role.id': '998811223344556677', 'role.name': 'Muted', executor: '@Shaad', 'executor.id': '756947441592303707', 'executor.tag': 'shaad', 'executor.name': 'Shaad', 'guild.name': "Shaad's server", 'guild.memberCount': '1,234', timestamp: 'Today at 12:30' }, defaults: { title: 'Role Deleted', description: '[role] was deleted by [executor].', color: 0xef4444 }, availableVariables: ['[role]', '[role.name]', '[role.id]', '[executor]', '[executor.name]', '[executor.id]', '[guild.name]', '[guild.memberCount]', '[timestamp]'] },
];

const variableDescriptions: Record<string, string> = {
  '[user]': 'Mention — @DisplayName in Discord', '[user.name]': 'Display name', '[user.id]': 'Discord user ID', '[user.tag]': 'Username',
  '[executor]': 'Moderator mention — @DisplayName', '[executor.name]': 'Moderator display name', '[executor.id]': 'Moderator Discord ID',
  '[channel]': 'Channel mention — #channel', '[channel.name]': 'Channel name', '[channel.id]': 'Discord channel ID',
  '[role]': 'Role mention — @Role', '[role.name]': 'Role name', '[role.id]': 'Discord role ID',
  '[message.content]': 'The message text', '[message.id]': 'Discord message ID',
  '[oldContent]': 'Previous message text (edits)', '[newContent]': 'New message text (edits)',
  '[reason]': 'Ban/unban reason', '[guild.name]': 'Server name', '[guild.memberCount]': 'Total member count', '[timestamp]': 'Event timestamp',
};

const recommendedColors = [0x5865f2, 0x22c55e, 0xef4444, 0xeab308, 0x3b82f6, 0xa855f7];

export function LogsPluginDashboard({ guildId, plugin }: { guildId: string; plugin: GuildPlugin }) {
  const queryClient = useQueryClient();
  const storage = useQuery(guildPluginStorageQuery(guildId, plugin.id, 'settings'));
  const channels = useQuery(guildChannelsQuery(guildId));
  const botProfile = useQuery(botProfileQuery);

  const [settings, setSettings] = useState<LogsSettings>(defaultSettings);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<LogCategory>('Members');
  const [focusedField, setFocusedField] = useState<FieldTarget>('description');

  useEffect(() => {
    const next = normalizeSettings(storage.data?.value);
    setSettings(next);
    setSavedSnapshot(JSON.stringify(next));
  }, [storage.dataUpdatedAt, storage.data?.value]);

  const save = useMutation({
    mutationFn: async () => api.setGuildPluginStorage(guildId, plugin.id, 'settings', settings),
    onSuccess: async () => {
      setSavedSnapshot(JSON.stringify(settings));
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', plugin.id, 'storage', 'settings'] });
      toast.success('Logs settings saved');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to save logs settings'),
  });

  const testLog = useMutation({
    mutationFn: async ({ logId, channelId }: { logId: string; channelId: string }) => {
      const log = logDefinitions.find((c) => c.id === logId);
      if (!log) throw new Error('Log type not found');
      const config = resolveLogConfig(settings, log);
      const { message, allowedMentions } = buildPreviewMessage(log, config, settings, true);
      return api.testGuildPluginLog(guildId, plugin.id, { channelId, message, allowedMentions });
    },
    onSuccess: () => toast.success('Test log sent to the channel.'),
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Failed to send test log';
      if (msg.includes('50001') || msg.includes('Missing Access')) toast.error('I cannot view that channel. I need View Channel permission.');
      else if (msg.includes('50013') || msg.includes('Missing Permissions')) toast.error('I am missing permissions in that channel. I need Send Messages and Embed Links.');
      else toast.error(msg);
    },
  });

  if (storage.isLoading || channels.isLoading) return <Skeleton className="h-96 w-full" />;
  if (storage.isError) return <ErrorState message={storage.error.message} onRetry={() => void storage.refetch()} />;
  if (channels.isError) return <ErrorState message={channels.error.message} onRetry={() => void channels.refetch()} />;

  const channelList = channels.data?.data ?? [];
  const activeCount = logDefinitions.filter((log) => resolveLogConfig(settings, log).enabled).length;
  const defaultChannel = channelList.find((c) => c.id === settings.defaultChannelId);
  const isDirty = JSON.stringify(settings) !== savedSnapshot;
  const selectedLog = selectedLogId ? logDefinitions.find((l) => l.id === selectedLogId) ?? null : null;

  function update(next: Partial<LogsSettings>) { setSettings((c) => ({ ...c, ...next })); }
  function updateLog(logId: string, patch: Partial<LogTypeConfig>) { setSettings((c) => setLogConfig(c, logId, { ...getStoredLogConfig(c, logId), ...patch })); }
  function insertVariable(v: string) { if (!selectedLog) return; const cur = String(resolveLogConfig(settings, selectedLog)[focusedField] ?? ''); updateLog(selectedLog.id, { [focusedField]: `${cur}${v}` }); }
  function sendTestLog(logId: string) { const log = logDefinitions.find((c) => c.id === logId); if (!log) return; const config = resolveLogConfig(settings, log); const ch = config.channelId ?? settings.defaultChannelId; if (!ch) { toast.warning('Choose a logs channel before sending a test log.'); return; } testLog.mutate({ logId, channelId: ch }); }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={plugin.enabled ? 'default' : 'secondary'}>{plugin.enabled ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">v{plugin.version}</Badge>
            {isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : <Badge variant="outline">Saved</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Logs Plugin</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Track important server activity and send clean logs to your Discord channels.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button onClick={() => save.mutate()} disabled={!isDirty || save.isPending}><SaveIcon className="mr-2 size-4" />{save.isPending ? 'Saving…' : 'Save changes'}</Button>
          <Button variant="outline" onClick={() => setSettings(defaultSettings)} disabled={!isDirty}><RotateCcwIcon className="mr-2 size-4" />Reset defaults</Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthTile label="Active logs" value={`${activeCount}/${logDefinitions.length}`} status={activeCount > 0 ? 'success' : 'warning'} icon={LayoutTemplateIcon} description={activeCount > 0 ? 'Logs are enabled' : 'No logs enabled'} />
        <HealthTile label="Default channel" value={defaultChannel ? `#${defaultChannel.name}` : 'Missing'} status={defaultChannel ? 'success' : 'error'} icon={defaultChannel ? CheckCircle2Icon : AlertTriangleIcon} description={defaultChannel ? 'Logs have a destination' : 'Choose a channel'} />
        <HealthTile label="Message style" value={labelFormat(settings.defaultFormat)} status="success" icon={Settings2Icon} description="Default output format" />
        <HealthTile label="Status" value={settings.enabled && defaultChannel ? 'Ready' : 'Setup needed'} status={settings.enabled && defaultChannel ? 'success' : defaultChannel ? 'warning' : 'error'} icon={settings.enabled && defaultChannel ? CheckCircle2Icon : AlertTriangleIcon} description={settings.enabled && defaultChannel ? 'Logging is active' : defaultChannel ? 'Enable the plugin' : 'Finish quick setup'} />
      </section>

      {!defaultChannel ? <Alert className="border-warning/40 bg-warning/10 text-warning-foreground"><AlertTriangleIcon className="size-4" /><AlertDescription className="flex flex-col gap-2"><span className="font-medium">Logs cannot be sent until you choose a default channel.</span><span className="text-sm">Start logging in 3 steps: choose a default channel, pick a message style, then enable the log types you want.</span></AlertDescription></Alert> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.65fr)]">
        <QuickSetupCard settings={settings} channels={channelList} onChange={update} />
        <div className="hidden xl:block"><LivePreviewCard log={selectedLog ?? logDefinitions[0]!} settings={settings} botName={botProfile.data?.username ?? 'Nexura'} botAvatarUrl={botProfile.data?.avatarUrl} /></div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.65fr)]"><DiagnosticsCard log={selectedLog ?? logDefinitions[0]!} settings={settings} /></section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Log types</h2><p className="text-sm text-muted-foreground">Choose which events to log and customize how each one looks.</p></div><CategoryTabs value={activeCategory} onChange={setActiveCategory} /></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{logDefinitions.filter((l) => l.category === activeCategory).map((l) => <LogTypeCard key={l.id} log={l} settings={settings} channels={channelList} onCustomize={() => setSelectedLogId(l.id)} onTest={() => sendTestLog(l.id)} onToggle={(enabled) => updateLog(l.id, { enabled })} />)}</div>
      </section>

      <Sheet open={Boolean(selectedLog)} onOpenChange={(open) => { if (!open) setSelectedLogId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">{selectedLog ? <LogCustomizeSheet log={selectedLog} settings={settings} channels={channelList} botName={botProfile.data?.username ?? 'Nexura'} botAvatarUrl={botProfile.data?.avatarUrl} focusedField={focusedField} onFocusField={setFocusedField} onInsertVariable={insertVariable} onUpdateLog={updateLog} onTest={() => sendTestLog(selectedLog.id)} isTesting={testLog.isPending} onSave={() => save.mutate()} isSaving={save.isPending} canSave={isDirty} /> : null}</SheetContent>
      </Sheet>

      <CoreSaveBar isDirty={isDirty} isSubmitting={save.isPending} onSave={() => save.mutate()} onReset={() => setSettings(JSON.parse(savedSnapshot) as LogsSettings)} />
    </div>
  );
}

function HealthTile({ label, value, status, icon: Icon, description }: { label: string; value: string; status: 'success' | 'warning' | 'error'; icon: ComponentType<SVGProps<SVGSVGElement>>; description: string }) {
  const cls = status === 'success' ? 'bg-success/10 text-success' : status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive';
  return <Card className="gap-0 py-0"><CardContent className="flex min-h-28 flex-col justify-between p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><span className={`flex size-8 items-center justify-center rounded-md ${cls}`}><Icon className="size-4" /></span></div><div className="flex flex-col gap-0.5"><p className="text-xl font-semibold tracking-tight">{value}</p><p className="text-xs text-muted-foreground">{description}</p></div></CardContent></Card>;
}

function QuickSetupCard({ settings, channels, onChange }: { settings: LogsSettings; channels: Array<{ id: string; name: string }>; onChange: (p: Partial<LogsSettings>) => void }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wand2Icon className="size-4" />Quick setup</CardTitle><p className="text-sm text-muted-foreground">Set the destination and default style used by every log unless a card overrides it.</p></CardHeader><CardContent className="grid gap-6"><CoreSwitch id="logs-enabled" label="Enable Logs Plugin" description="Turn logging on or off for this server." checked={settings.enabled} onCheckedChange={(enabled) => onChange({ enabled })} /><div className="space-y-2"><Label htmlFor="default-channel">Default logs channel</Label><ChannelSelect id="default-channel" value={settings.defaultChannelId} channels={channels} onChange={(c) => onChange({ defaultChannelId: c })} /><p className="text-xs text-muted-foreground">Logs will be sent here unless a log type uses its own channel.</p></div><div className="space-y-2"><Label>Message style</Label><SegmentedFormat value={settings.defaultFormat} onChange={(f) => onChange({ defaultFormat: f })} /></div><ColorControl label="Accent color" value={settings.defaultColor} onChange={(c) => onChange({ defaultColor: c })} /><div className="grid gap-4 sm:grid-cols-2"><LabeledInput label="Default log title" value={settings.defaultTitle} onChange={(t) => onChange({ defaultTitle: t })} /><LabeledInput label="Default footer" value={settings.defaultFooter} onChange={(f) => onChange({ defaultFooter: f })} /></div><div className="grid gap-4 sm:grid-cols-2"><CoreSwitch id="logs-default-timestamp" label="Show timestamp" description="Include the event time in every log." checked={settings.showTimestamp} onCheckedChange={(v) => onChange({ showTimestamp: v })} /><CoreSwitch id="logs-default-avatar" label="Show avatar/icon" description="Include user avatar or role icon." checked={settings.showAvatar} onCheckedChange={(v) => onChange({ showAvatar: v })} /></div></CardContent></Card>;
}

function CategoryTabs({ value, onChange }: { value: LogCategory; onChange: (v: LogCategory) => void }) { return <Tabs value={value} onValueChange={(v) => onChange(v as LogCategory)}><TabsList className="h-9">{categories.map((c) => <TabsTrigger key={c} value={c} className="text-xs">{c}</TabsTrigger>)}</TabsList></Tabs>; }
function LogTypeCard({ log, settings, channels, onCustomize, onTest, onToggle }: { log: LogDefinition; settings: LogsSettings; channels: Array<{ id: string; name: string }>; onCustomize: () => void; onTest: () => void; onToggle: (enabled: boolean) => void }) { const config = resolveLogConfig(settings, log); const ch = channels.find((i) => i.id === config.channelId); const eff = config.channelId ?? settings.defaultChannelId; const effCh = channels.find((i) => i.id === eff); const Icon = log.icon; return <Card className="flex flex-col"><CardContent className="flex flex-1 flex-col gap-4 p-4"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-medium">{log.name}</h3><Switch checked={config.enabled} onCheckedChange={onToggle} aria-label={`Enable ${log.name}`} /></div><p className="mt-1 text-sm text-muted-foreground">{log.description}</p></div></div><div className="flex flex-wrap gap-2"><Badge variant={config.enabled ? 'default' : 'secondary'}>{config.enabled ? 'Enabled' : 'Off'}</Badge><Badge variant="outline" className="gap-1"><HashIcon className="size-3" />{ch ? `#${ch.name}` : effCh ? `#${effCh.name}` : 'Missing channel'}</Badge><Badge variant="outline">{labelFormat(config.format)}</Badge></div><div className="mt-auto grid grid-cols-2 gap-2"><Button variant="outline" onClick={onCustomize}><Settings2Icon className="mr-2 size-4" />Customize</Button><Button variant="outline" onClick={onTest}><SendIcon className="mr-2 size-4" />Test</Button></div></CardContent></Card>; }

function LogCustomizeSheet({ log, settings, channels, botName, botAvatarUrl, focusedField: _ff, onFocusField, onInsertVariable, onUpdateLog, onTest, isTesting, onSave, isSaving, canSave }: { log: LogDefinition; settings: LogsSettings; channels: Array<{ id: string; name: string }>; botName: string; botAvatarUrl: string | null | undefined; focusedField: FieldTarget; onFocusField: (f: FieldTarget) => void; onInsertVariable: (v: string) => void; onUpdateLog: (logId: string, patch: Partial<LogTypeConfig>) => void; onTest: () => void; isTesting: boolean; onSave: () => void; isSaving: boolean; canSave: boolean }) { const config = resolveLogConfig(settings, log); const stored = getStoredLogConfig(settings, log.id); const hcc = (stored.channelId ?? undefined) !== undefined; const hcf = (stored.format ?? undefined) !== undefined; const hcco = (stored.color ?? undefined) !== undefined; return <div className="flex flex-col gap-6"><SheetHeader><SheetTitle className="flex items-center gap-2"><log.icon className="size-5" />Customize {log.name}</SheetTitle><SheetDescription>Override title, message, footer, color, and channel for this log type.</SheetDescription></SheetHeader><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]"><div className="space-y-6"><div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"><CoreSwitch id={`s-ch-${log.id}`} label="Use a different channel" description={hcc ? 'This log uses its own channel.' : 'Use the default logs channel.'} checked={hcc} onCheckedChange={(ck) => onUpdateLog(log.id, { channelId: ck ? settings.defaultChannelId : null })} />{hcc ? <div className="space-y-2"><Label>Channel override</Label><ChannelSelect value={stored.channelId ?? null} channels={channels} onChange={(cid) => onUpdateLog(log.id, { channelId: cid })} /></div> : null}</div><div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"><CoreSwitch id={`s-fmt-${log.id}`} label="Use default message style" description={hcf ? 'Use this log’s own style.' : 'Use the global default style.'} checked={!hcf} onCheckedChange={(ck) => onUpdateLog(log.id, { format: ck ? undefined : settings.defaultFormat })} />{hcf ? <div className="space-y-2"><Label>Message style</Label><SegmentedFormat value={stored.format ?? settings.defaultFormat} onChange={(fmt) => onUpdateLog(log.id, { format: fmt })} /></div> : null}</div><div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"><CoreSwitch id={`s-col-${log.id}`} label="Use default accent color" description={hcco ? 'Use this log’s own color.' : 'Use the global default color.'} checked={!hcco} onCheckedChange={(ck) => onUpdateLog(log.id, { color: ck ? undefined : settings.defaultColor })} />{hcco ? <ColorControl label="Accent color" value={stored.color ?? settings.defaultColor} onChange={(c) => onUpdateLog(log.id, { color: c })} /> : null}</div><LabeledInput label="Log title" value={stored.title ?? log.defaults.title} onChange={(t) => onUpdateLog(log.id, { title: t })} onFocus={() => onFocusField('title')} /><div className="space-y-2"><Label htmlFor={`sd-${log.id}`}>Log message</Label><Textarea id={`sd-${log.id}`} value={stored.description ?? log.defaults.description} onChange={(e) => onUpdateLog(log.id, { description: e.target.value })} onFocus={() => onFocusField('description')} rows={4} /></div><LabeledInput label="Footer" value={stored.footer ?? settings.defaultFooter} onChange={(f) => onUpdateLog(log.id, { footer: f })} onFocus={() => onFocusField('footer')} /><div className="grid gap-4 sm:grid-cols-2"><CoreSwitch id={`st-${log.id}`} label="Show timestamp" checked={config.showTimestamp} onCheckedChange={(v) => onUpdateLog(log.id, { showTimestamp: v })} /><CoreSwitch id={`sa-${log.id}`} label="Show avatar/icon" checked={config.showAvatar} onCheckedChange={(v) => onUpdateLog(log.id, { showAvatar: v })} /></div><div className="space-y-2"><Label>Variable helper</Label><p className="text-xs text-muted-foreground">Click a variable to insert it into the focused field below.</p><div className="flex flex-wrap gap-2">{log.availableVariables.map((v) => <Button key={v} type="button" variant="outline" size="sm" title={variableDescriptions[v] ?? v} onClick={() => onInsertVariable(v)}>{v}</Button>)}</div></div><InvalidVariableWarning template={`${stored.title ?? log.defaults.title} ${stored.description ?? log.defaults.description} ${stored.footer ?? settings.defaultFooter}`} availableVariables={log.availableVariables} /><div className="flex flex-wrap gap-2"><Button onClick={onSave} disabled={!canSave || isSaving}><SaveIcon className="mr-2 size-4" />{isSaving ? 'Saving…' : 'Save changes'}</Button><Button variant="outline" onClick={onTest} disabled={isTesting}><SendIcon className="mr-2 size-4" />{isTesting ? 'Sending…' : 'Send test log'}</Button></div></div><div className="space-y-4"><LivePreviewCard log={log} settings={settings} botName={botName} botAvatarUrl={botAvatarUrl} /><div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground"><p className="flex items-center gap-1.5 font-medium text-foreground"><EyeIcon className="size-3.5" />Preview uses sample data</p><p className="mt-1">This shows how the log will look in Discord. Real logs use live server data.</p></div></div></div></div>; }

function LivePreviewCard({ log, settings, botName, botAvatarUrl }: { log: LogDefinition; settings: LogsSettings; botName: string; botAvatarUrl: string | null | undefined }) { const [sd, setSd] = useState(false); const config = resolveLogConfig(settings, log); const { message } = buildPreviewMessage(log, config, settings, false); const isC = message.type === 'components_v2'; const vars = buildPreviewVariables(log.sample); const dv = useMemo(() => { const t = `${config.title} ${config.description} ${config.footer}`; const m = t.match(/\[([A-Za-z][A-Za-z0-9_.]*)\]/gu) ?? []; return Array.from(new Set(m.map((m2) => m2.slice(1, -1)))); }, [config.title, config.description, config.footer]); return <Card className="overflow-hidden"><CardHeader className="border-b border-border"><CardTitle className="flex items-center gap-2 text-base"><PaletteIcon className="size-4" />Live preview</CardTitle><p className="text-sm text-muted-foreground">This mirrors the Discord message using sample data.</p></CardHeader><CardContent className={isC ? 'border-l-4 p-4' : 'p-4'} style={isC ? { borderLeftColor: numberToHex(config.color) } : undefined}><DiscordMessagePreview message={message} botName={botName} botAvatarUrl={botAvatarUrl} previewVariables={log.sample} /><button type="button" onClick={() => setSd((v) => !v)} className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><BugIcon className="size-3.5" />{sd ? 'Hide debug' : 'Show debug'}</button>{sd ? <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-xs"><p className="mb-2 font-medium text-foreground">Variable resolution</p>{dv.length === 0 ? <p className="text-muted-foreground">No variables detected.</p> : <ul className="space-y-1">{dv.map((n) => { const r = resolveVariable(n, vars); const d = typeof r === 'string' || typeof r === 'number' ? String(r) : 'Unknown'; return <li key={n} className="flex items-center justify-between gap-2"><code className="rounded bg-background px-1 py-0.5 text-[10px]">[{n}]</code><span className="truncate text-muted-foreground">{d}</span></li>; })}</ul>}</div> : null}</CardContent></Card>; }

function DiagnosticsCard({ log, settings }: { log: LogDefinition; settings: LogsSettings }) { const config = resolveLogConfig(settings, log); const tpl = `${config.title} ${config.description} ${config.footer}`; const det = (tpl.match(/\[[A-Za-z][A-Za-z0-9_.]*\]/gu) ?? []) as string[]; const inv = det.filter((m) => !log.availableVariables.includes(m)); const st = inv.length === 0 ? 'success' : 'warning'; const diag = [{ label: 'Template engine', status: 'success' as const }, { label: 'Variable resolver', status: st }, { label: 'Preview renderer', status: 'success' as const }, { label: 'Discord renderer', status: 'success' as const }]; return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BugIcon className="size-4" />Diagnostics</CardTitle><p className="text-sm text-muted-foreground">Health checks for the log rendering pipeline.</p></CardHeader><CardContent><ul className="space-y-2">{diag.map((i) => <li key={i.label} className="flex items-center justify-between gap-3 text-sm"><span>{i.label}</span><span className={`flex items-center gap-1.5 text-xs font-medium ${i.status === 'success' ? 'text-success' : 'text-warning'}`}>{i.status === 'success' ? <CheckCircle2Icon className="size-3.5" /> : <AlertTriangleIcon className="size-3.5" />}{i.status === 'success' ? 'OK' : 'Warning'}</span></li>)}</ul>{inv.length > 0 ? <Alert variant="destructive" className="mt-4 py-2"><AlertDescription className="text-xs">Variable{inv.length > 1 ? 's' : ''} not available for this log type: {inv.join(', ')}</AlertDescription></Alert> : null}</CardContent></Card>; }

function InvalidVariableWarning({ template, availableVariables }: { template: string; availableVariables: string[] }) { const inv = useMemo(() => { const m = template.match(/\[[A-Za-z][A-Za-z0-9_.]*\]/gu) ?? []; return Array.from(new Set(m.filter((x) => !availableVariables.includes(x)))); }, [template, availableVariables]); if (inv.length === 0) return null; return <Alert variant="destructive" className="py-2"><AlertDescription className="text-xs">Variable{inv.length > 1 ? 's' : ''} not available for this log type: {inv.join(', ')}</AlertDescription></Alert>; }

function ChannelSelect({ id, value, channels, onChange }: { id?: string; value: string | null; channels: Array<{ id: string; name: string }>; onChange: (v: string | null) => void }) { return <Select value={value ?? 'none'} onValueChange={(n) => onChange(n === 'none' ? null : n)}><SelectTrigger id={id}><SelectValue placeholder="Choose a channel" /></SelectTrigger><SelectContent><SelectItem value="none">Use default / no channel</SelectItem>{channels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}</SelectContent></Select>; }
function SegmentedFormat({ value, onChange }: { value: LogFormat; onChange: (v: LogFormat) => void }) { return <div className="inline-flex rounded-lg border border-border bg-muted p-1"><button type="button" className={`rounded-md px-3 py-1.5 text-sm ${value === 'embed' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} onClick={() => onChange('embed')}>Embed</button><button type="button" className={`rounded-md px-3 py-1.5 text-sm ${value === 'components_v2' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} onClick={() => onChange('components_v2')}>Components V2</button></div>; }
function LabeledInput({ label, value, onChange, onFocus }: { label: string; value: string; onChange: (v: string) => void; onFocus?: () => void }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} /></div>; }
function ColorControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { const h = numberToHex(value); return <div className="space-y-2"><Label>{label}</Label><div className="flex items-center gap-3"><Input className="h-10 w-14 p-1" type="color" value={h} onChange={(e) => onChange(hexToNumber(e.target.value))} /><Input value={h} onChange={(e) => onChange(hexToNumber(e.target.value))} /></div><div className="flex flex-wrap gap-2">{recommendedColors.map((c) => <button key={c} type="button" className="size-6 rounded-full border border-border" style={{ backgroundColor: numberToHex(c) }} onClick={() => onChange(c)}><span className="sr-only">Use {numberToHex(c)}</span></button>)}</div></div>; }

interface PreviewResult { message: CoreMessage; allowedMentions: { parse: string[]; users: string[]; roles: string[] } }
function buildPreviewVariables(s: Record<string, string>): LogVariables { const an = (v: string | undefined): number | undefined => { if (!v) return; const n = Number.parseInt(v.replace(/,/gu, ''), 10); return Number.isFinite(n) ? n : undefined; }; return { user: s.user, userId: s['user.id'], userName: s['user.tag'], userDisplayName: s['user.name'], executor: s.executor, executorId: s['executor.id'], executorName: s['executor.tag'], executorDisplayName: s['executor.name'], channel: s.channel, channelId: s['channel.id'], channelName: s['channel.name'], role: s.role, roleId: s['role.id'], roleName: s['role.name'], messageId: s.messageId, messageContent: s['message.content'], oldContent: s.oldContent, newContent: s.newContent, reason: s.reason, guildName: s['guild.name'], guildMemberCount: an(s['guild.memberCount']), serverName: s['guild.name'], memberCount: an(s['guild.memberCount']) }; }
function buildPreviewMessage(log: LogDefinition, config: ResolvedLogConfig, _s: LogsSettings, isTest: boolean): PreviewResult { return formatLogMessage({ type: log.id, title: `${isTest ? '[TEST] ' : ''}${config.title}`, description: config.description, footer: config.footer, color: config.color, format: config.format, showTimestamp: config.showTimestamp, showAvatar: config.showAvatar, variables: buildPreviewVariables(log.sample) }); }
function normalizeSettings(value: unknown): LogsSettings { return { ...defaultSettings, ...(isRecord(value) ? value : {}), logTypes: isRecord((value as LogsSettings | undefined)?.logTypes) ? (value as LogsSettings).logTypes : {} }; }
function resolveLogConfig(s: LogsSettings, l: LogDefinition): ResolvedLogConfig { const st = getStoredLogConfig(s, l.id); return { enabled: st.enabled ?? false, channelId: st.channelId ?? s.defaultChannelId, format: st.format ?? s.defaultFormat, color: st.color ?? s.defaultColor, title: st.title ?? l.defaults.title, description: st.description ?? l.defaults.description, footer: st.footer ?? s.defaultFooter, showTimestamp: st.showTimestamp ?? s.showTimestamp, showAvatar: st.showAvatar ?? s.showAvatar }; }
function getStoredLogConfig(s: LogsSettings, lid: string): LogTypeConfig { const [c, n] = lid.split('.'); const cat = isRecord(s.logTypes[c!]) ? s.logTypes[c!] : {}; const raw = isRecord(cat) ? (cat as Record<string, unknown>)[n!] : undefined; return isRecord(raw) ? raw as LogTypeConfig : {}; }
function setLogConfig(s: LogsSettings, lid: string, cfg: LogTypeConfig): LogsSettings { const [c, n] = lid.split('.'); const ex: Record<string, unknown> = isRecord(s.logTypes[c!]) ? s.logTypes[c!] as Record<string, unknown> : {}; return { ...s, logTypes: { ...s.logTypes, [c!]: { ...ex, [n!]: cfg } } }; }
function labelFormat(f: LogFormat) { return f === 'components_v2' ? 'Components V2' : 'Embed'; }
function numberToHex(v: number): string { return `#${Math.max(0, Math.min(0xffffff, Math.round(v))).toString(16).padStart(6, '0')}`; }
function hexToNumber(v: string): number { const n = v.startsWith('#') ? v.slice(1) : v; const p = Number.parseInt(n, 16); return Number.isFinite(p) ? Math.max(0, Math.min(0xffffff, p)) : 0x5865f2; }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
