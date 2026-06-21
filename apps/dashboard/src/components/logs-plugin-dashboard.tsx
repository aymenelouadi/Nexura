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
import type { ComponentsV2Container, ComponentsV2Item, CoreMessage, EmbedMessage, GuildPlugin } from '@nexura/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  BanIcon,
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

interface LogField {
  label: string;
  value: string;
}

interface LogDefinition {
  id: string;
  category: LogCategory;
  name: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  sample: Record<string, string>;
  defaults: { title: string; description: string; color: number };
  fields: Array<{ label: string; key: string }>;
}

const defaultSettings: LogsSettings = {
  enabled: true,
  defaultChannelId: null,
  defaultFormat: 'embed',
  defaultColor: 0x5865f2,
  defaultTitle: 'Server Log',
  defaultFooter: '',
  showTimestamp: true,
  showAvatar: true,
  logTypes: {},
};

const categories: LogCategory[] = ['Members', 'Moderation', 'Messages', 'Channels', 'Roles'];

const logDefinitions: LogDefinition[] = [
  {
    id: 'member.joined',
    category: 'Members',
    name: 'Member Joined',
    description: 'When a new member joins your server',
    icon: UserPlusIcon,
    sample: {
      user: '@Shaad',
      'user.id': '756947441592303707',
      'user.tag': 'shaad',
      'server.name': "Shaad's server",
      'account.created': '2 years ago',
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Member Joined', description: '[user] joined the server.', color: 0x22c55e },
    fields: [
      { label: 'User ID', key: 'user.id' },
      { label: 'Account Created', key: 'account.created' },
    ],
  },
  {
    id: 'member.left',
    category: 'Members',
    name: 'Member Left',
    description: 'When a member leaves your server',
    icon: LogOutIcon,
    sample: {
      user: '@Aymen',
      'user.id': '648201390120330241',
      'user.tag': 'aymen',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Member Left', description: '[user] left the server.', color: 0xf97316 },
    fields: [{ label: 'User ID', key: 'user.id' }],
  },
  {
    id: 'member.banned',
    category: 'Moderation',
    name: 'Member Banned',
    description: 'When someone is banned from your server',
    icon: BanIcon,
    sample: {
      user: '@TroubleMaker',
      'user.id': '553192481902332111',
      'user.tag': 'troublemaker',
      executor: '@Admin',
      'executor.id': '756947441592303707',
      reason: 'Spam links',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Member Banned', description: '[user] was banned. Reason: [reason]', color: 0xef4444 },
    fields: [
      { label: 'User', key: 'user' },
      { label: 'Executor', key: 'executor' },
      { label: 'Reason', key: 'reason' },
    ],
  },
  {
    id: 'member.unbanned',
    category: 'Moderation',
    name: 'Member Unbanned',
    description: 'When someone is unbanned from your server',
    icon: ShieldIcon,
    sample: {
      user: '@ReturningUser',
      'user.id': '673219481902332111',
      'user.tag': 'returninguser',
      executor: '@Admin',
      reason: 'Appeal accepted',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Member Unbanned', description: '[user] was unbanned.', color: 0x3b82f6 },
    fields: [
      { label: 'User', key: 'user' },
      { label: 'Executor', key: 'executor' },
    ],
  },
  {
    id: 'message.deleted',
    category: 'Messages',
    name: 'Message Deleted',
    description: 'When a message is deleted',
    icon: MessageSquareXIcon,
    sample: {
      user: '@Aymen',
      'user.id': '648201390120330241',
      channel: '#general',
      'channel.id': '123456789012345678',
      'message.content': 'hello, this is a deleted message',
      messageId: '123456789',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Message Deleted', description: '[user] deleted a message in [channel].', color: 0xef4444 },
    fields: [
      { label: 'Author', key: 'user' },
      { label: 'Channel', key: 'channel' },
      { label: 'Content', key: 'message.content' },
    ],
  },
  {
    id: 'message.edited',
    category: 'Messages',
    name: 'Message Edited',
    description: 'When a message is edited',
    icon: Edit3Icon,
    sample: {
      user: '@Aymen',
      'user.id': '648201390120330241',
      channel: '#general',
      oldContent: 'helo world',
      newContent: 'hello world',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Message Edited', description: '[user] edited a message in [channel].', color: 0xeab308 },
    fields: [
      { label: 'Author', key: 'user' },
      { label: 'Channel', key: 'channel' },
      { label: 'Change', key: 'oldContent' },
    ],
  },
  {
    id: 'channel.created',
    category: 'Channels',
    name: 'Channel Created',
    description: 'When a channel is created',
    icon: HashIcon,
    sample: {
      channel: '#announcements',
      'channel.id': '998877665544332211',
      executor: '@Admin',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Channel Created', description: '[channel] was created by [executor].', color: 0x22c55e },
    fields: [
      { label: 'Channel', key: 'channel' },
      { label: 'Executor', key: 'executor' },
    ],
  },
  {
    id: 'channel.deleted',
    category: 'Channels',
    name: 'Channel Deleted',
    description: 'When a channel is deleted',
    icon: HashIcon,
    sample: {
      channel: '#old-chat',
      'channel.id': '887766554433221100',
      executor: '@Admin',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Channel Deleted', description: '[channel] was deleted by [executor].', color: 0xef4444 },
    fields: [
      { label: 'Channel', key: 'channel' },
      { label: 'Executor', key: 'executor' },
    ],
  },
  {
    id: 'role.created',
    category: 'Roles',
    name: 'Role Created',
    description: 'When a role is created',
    icon: SparklesIcon,
    sample: {
      role: '@Moderator',
      'role.id': '112233445566778899',
      executor: '@Shaad',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Role Created', description: '[role] was created by [executor].', color: 0x22c55e },
    fields: [
      { label: 'Role', key: 'role' },
      { label: 'Executor', key: 'executor' },
    ],
  },
  {
    id: 'role.deleted',
    category: 'Roles',
    name: 'Role Deleted',
    description: 'When a role is deleted',
    icon: SparklesIcon,
    sample: {
      role: '@Muted',
      'role.id': '998811223344556677',
      executor: '@Shaad',
      'server.name': "Shaad's server",
      timestamp: 'Today at 12:30',
    },
    defaults: { title: 'Role Deleted', description: '[role] was deleted by [executor].', color: 0xef4444 },
    fields: [
      { label: 'Role', key: 'role' },
      { label: 'Executor', key: 'executor' },
    ],
  },
];

const variables = [
  '[user]',
  '[user.id]',
  '[user.tag]',
  '[executor]',
  '[executor.id]',
  '[channel]',
  '[channel.id]',
  '[role]',
  '[role.id]',
  '[message.content]',
  '[reason]',
  '[server.name]',
  '[timestamp]',
];
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
      const log = logDefinitions.find((candidate) => candidate.id === logId);
      if (!log) throw new Error('Log type not found');
      const config = resolveLogConfig(settings, log);
      const { message, allowedMentions } = buildPreviewMessage(log, config, settings, true);
      return api.testGuildPluginLog(guildId, plugin.id, { channelId, message, allowedMentions });
    },
    onSuccess: () => toast.success('Test log sent to the channel.'),
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to send test log';
      if (message.includes('50001') || message.includes('Missing Access')) {
        toast.error('I cannot view that channel. I need View Channel permission.');
      } else if (message.includes('50013') || message.includes('Missing Permissions')) {
        toast.error('I am missing permissions in that channel. I need Send Messages and Embed Links.');
      } else {
        toast.error(message);
      }
    },
  });

  if (storage.isLoading || channels.isLoading) return <Skeleton className="h-96 w-full" />;
  if (storage.isError) return <ErrorState message={storage.error.message} onRetry={() => void storage.refetch()} />;
  if (channels.isError) return <ErrorState message={channels.error.message} onRetry={() => void channels.refetch()} />;

  const channelList = channels.data?.data ?? [];
  const activeCount = logDefinitions.filter((log) => resolveLogConfig(settings, log).enabled).length;
  const defaultChannel = channelList.find((channel) => channel.id === settings.defaultChannelId);
  const isDirty = JSON.stringify(settings) !== savedSnapshot;
  const selectedLog = selectedLogId ? logDefinitions.find((log) => log.id === selectedLogId) ?? null : null;

  function update(next: Partial<LogsSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function updateLog(logId: string, patch: Partial<LogTypeConfig>) {
    setSettings((current) => setLogConfig(current, logId, { ...getStoredLogConfig(current, logId), ...patch }));
  }

  function insertVariable(variable: string) {
    if (!selectedLog) return;
    const current = String(resolveLogConfig(settings, selectedLog)[focusedField] ?? '');
    updateLog(selectedLog.id, { [focusedField]: `${current}${variable}` });
  }

  function sendTestLog(logId: string) {
    const log = logDefinitions.find((candidate) => candidate.id === logId);
    if (!log) return;
    const config = resolveLogConfig(settings, log);
    const channelId = config.channelId ?? settings.defaultChannelId;
    if (!channelId) {
      toast.warning('Choose a logs channel before sending a test log.');
      return;
    }
    testLog.mutate({ logId, channelId });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={plugin.enabled ? 'default' : 'secondary'}>{plugin.enabled ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">v{plugin.version}</Badge>
            {isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : <Badge variant="outline">Saved</Badge>}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Logs Plugin</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Track important server activity and send clean logs to your Discord channels.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button onClick={() => save.mutate()} disabled={!isDirty || save.isPending}>
            <SaveIcon className="mr-2 size-4" />
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button variant="outline" onClick={() => setSettings(defaultSettings)} disabled={!isDirty}>
            <RotateCcwIcon className="mr-2 size-4" />
            Reset defaults
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthTile
          label="Active logs"
          value={`${activeCount}/${logDefinitions.length}`}
          status={activeCount > 0 ? 'success' : 'warning'}
          icon={LayoutTemplateIcon}
          description={activeCount > 0 ? 'Logs are enabled' : 'No logs enabled'}
        />
        <HealthTile
          label="Default channel"
          value={defaultChannel ? `#${defaultChannel.name}` : 'Missing'}
          status={defaultChannel ? 'success' : 'error'}
          icon={defaultChannel ? CheckCircle2Icon : AlertTriangleIcon}
          description={defaultChannel ? 'Logs have a destination' : 'Choose a channel'}
        />
        <HealthTile
          label="Message style"
          value={labelFormat(settings.defaultFormat)}
          status="success"
          icon={Settings2Icon}
          description="Default output format"
        />
        <HealthTile
          label="Status"
          value={settings.enabled && defaultChannel ? 'Ready' : 'Setup needed'}
          status={settings.enabled && defaultChannel ? 'success' : defaultChannel ? 'warning' : 'error'}
          icon={settings.enabled && defaultChannel ? CheckCircle2Icon : AlertTriangleIcon}
          description={settings.enabled && defaultChannel ? 'Logging is active' : defaultChannel ? 'Enable the plugin' : 'Finish quick setup'}
        />
      </section>

      {!defaultChannel ? (
        <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
          <AlertTriangleIcon className="size-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span className="font-medium">Logs cannot be sent until you choose a default channel.</span>
            <span className="text-sm">Start logging in 3 steps: choose a default channel, pick a message style, then enable the log types you want.</span>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.65fr)]">
        <QuickSetupCard settings={settings} channels={channelList} onChange={update} />
        <div className="hidden xl:block">
          <LivePreviewCard
            log={selectedLog ?? logDefinitions[0]!}
            settings={settings}
            botName={botProfile.data?.username ?? 'Nexura'}
            botAvatarUrl={botProfile.data?.avatarUrl}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Log types</h2>
            <p className="text-sm text-muted-foreground">Choose which events to log and customize how each one looks.</p>
          </div>
          <CategoryTabs value={activeCategory} onChange={setActiveCategory} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {logDefinitions
            .filter((log) => log.category === activeCategory)
            .map((log) => (
              <LogTypeCard
                key={log.id}
                log={log}
                settings={settings}
                channels={channelList}
                onCustomize={() => setSelectedLogId(log.id)}
                onTest={() => sendTestLog(log.id)}
                onToggle={(enabled) => updateLog(log.id, { enabled })}
              />
            ))}
        </div>
      </section>

      <Sheet open={Boolean(selectedLog)} onOpenChange={(open) => { if (!open) setSelectedLogId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
          {selectedLog ? (
            <LogCustomizeSheet
              log={selectedLog}
              settings={settings}
              channels={channelList}
              botName={botProfile.data?.username ?? 'Nexura'}
              botAvatarUrl={botProfile.data?.avatarUrl}
              focusedField={focusedField}
              onFocusField={setFocusedField}
              onInsertVariable={insertVariable}
              onUpdateLog={updateLog}
              onTest={() => sendTestLog(selectedLog.id)}
              isTesting={testLog.isPending}
              onSave={() => save.mutate()}
              isSaving={save.isPending}
              canSave={isDirty}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <CoreSaveBar
        isDirty={isDirty}
        isSubmitting={save.isPending}
        onSave={() => save.mutate()}
        onReset={() => setSettings(JSON.parse(savedSnapshot) as LogsSettings)}
      />
    </div>
  );
}

function HealthTile({
  label,
  value,
  status,
  icon: Icon,
  description,
}: {
  label: string;
  value: string;
  status: 'success' | 'warning' | 'error';
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  description: string;
}) {
  const statusClass =
    status === 'success'
      ? 'bg-success/10 text-success'
      : status === 'warning'
        ? 'bg-warning/10 text-warning'
        : 'bg-destructive/10 text-destructive';
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex min-h-28 flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className={`flex size-8 items-center justify-center rounded-md ${statusClass}`}>
            <Icon className="size-4" />
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickSetupCard({
  settings,
  channels,
  onChange,
}: {
  settings: LogsSettings;
  channels: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<LogsSettings>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2Icon className="size-4" />
          Quick setup
        </CardTitle>
        <p className="text-sm text-muted-foreground">Set the destination and default style used by every log unless a card overrides it.</p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <CoreSwitch
          id="logs-enabled"
          label="Enable Logs Plugin"
          description="Turn logging on or off for this server."
          checked={settings.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />

        <div className="space-y-2">
          <Label htmlFor="default-channel">Default logs channel</Label>
          <ChannelSelect id="default-channel" value={settings.defaultChannelId} channels={channels} onChange={(defaultChannelId) => onChange({ defaultChannelId })} />
          <p className="text-xs text-muted-foreground">Logs will be sent here unless a log type uses its own channel.</p>
        </div>

        <div className="space-y-2">
          <Label>Message style</Label>
          <SegmentedFormat value={settings.defaultFormat} onChange={(defaultFormat) => onChange({ defaultFormat })} />
        </div>

        <ColorControl label="Accent color" value={settings.defaultColor} onChange={(defaultColor) => onChange({ defaultColor })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Default log title" value={settings.defaultTitle} onChange={(defaultTitle) => onChange({ defaultTitle })} />
          <LabeledInput label="Default footer" value={settings.defaultFooter} onChange={(defaultFooter) => onChange({ defaultFooter })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CoreSwitch
            id="logs-default-timestamp"
            label="Show timestamp"
            description="Add a timestamp to every log."
            checked={settings.showTimestamp}
            onCheckedChange={(showTimestamp) => onChange({ showTimestamp })}
          />
          <CoreSwitch
            id="logs-default-avatar"
            label="Show avatar/icon"
            description="Show an icon next to log titles."
            checked={settings.showAvatar}
            onCheckedChange={(showAvatar) => onChange({ showAvatar })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryTabs({ value, onChange }: { value: LogCategory; onChange: (value: LogCategory) => void }) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as LogCategory)}>
      <TabsList className="h-auto flex-wrap justify-start bg-muted p-1">
        {categories.map((category) => (
          <TabsTrigger key={category} value={category} className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function LogTypeCard({
  log,
  settings,
  channels,
  onCustomize,
  onTest,
  onToggle,
}: {
  log: LogDefinition;
  settings: LogsSettings;
  channels: Array<{ id: string; name: string }>;
  onCustomize: () => void;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const config = resolveLogConfig(settings, log);
  const channel = channels.find((item) => item.id === config.channelId);
  const effectiveChannelId = config.channelId ?? settings.defaultChannelId;
  const effectiveChannel = channels.find((item) => item.id === effectiveChannelId);
  const Icon = log.icon;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{log.name}</h3>
              <Switch
                checked={config.enabled}
                onCheckedChange={onToggle}
                aria-label={`Enable ${log.name}`}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{log.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={config.enabled ? 'default' : 'secondary'}>{config.enabled ? 'Enabled' : 'Off'}</Badge>
          <Badge variant="outline" className="gap-1">
            <HashIcon className="size-3" />
            {channel ? `#${channel.name}` : effectiveChannel ? `#${effectiveChannel.name}` : 'Missing channel'}
          </Badge>
          <Badge variant="outline">{labelFormat(config.format)}</Badge>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCustomize}>
            <Settings2Icon className="mr-2 size-4" />
            Customize
          </Button>
          <Button variant="outline" onClick={onTest}>
            <SendIcon className="mr-2 size-4" />
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LogCustomizeSheet({
  log,
  settings,
  channels,
  botName,
  botAvatarUrl,
  focusedField: _focusedField,
  onFocusField,
  onInsertVariable,
  onUpdateLog,
  onTest,
  isTesting,
  onSave,
  isSaving,
  canSave,
}: {
  log: LogDefinition;
  settings: LogsSettings;
  channels: Array<{ id: string; name: string }>;
  botName: string;
  botAvatarUrl: string | null | undefined;
  focusedField: FieldTarget;
  onFocusField: (field: FieldTarget) => void;
  onInsertVariable: (variable: string) => void;
  onUpdateLog: (logId: string, patch: Partial<LogTypeConfig>) => void;
  onTest: () => void;
  isTesting: boolean;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
}) {
  const config = resolveLogConfig(settings, log);
  const stored = getStoredLogConfig(settings, log.id);
  const hasCustomChannel = stored.channelId !== undefined && stored.channelId !== null;
  const hasCustomFormat = stored.format !== undefined;
  const hasCustomColor = stored.color !== undefined;

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <log.icon className="size-5 text-primary" />
          <SheetTitle>{log.name}</SheetTitle>
        </div>
        <SheetDescription>{log.description}. Preview updates as you edit.</SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <CoreSwitch
                id={`sheet-enable-${log.id}`}
                label="Enable this log"
                checked={config.enabled}
                onCheckedChange={(enabled) => onUpdateLog(log.id, { enabled })}
              />

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <CoreSwitch
                  id={`sheet-default-channel-${log.id}`}
                  label="Send this log to a different channel"
                  description="Override the default logs channel."
                  checked={hasCustomChannel}
                  onCheckedChange={(checked) => onUpdateLog(log.id, { channelId: checked ? settings.defaultChannelId : null })}
                />
                {hasCustomChannel ? (
                  <div className="space-y-2">
                    <Label>Channel override</Label>
                    <ChannelSelect value={stored.channelId ?? null} channels={channels} onChange={(channelId) => onUpdateLog(log.id, { channelId })} />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <CoreSwitch
                  id={`sheet-default-format-${log.id}`}
                  label="Use default message style"
                  description={hasCustomFormat ? 'Use this log’s own style.' : 'Use the global default style.'}
                  checked={!hasCustomFormat}
                  onCheckedChange={(checked) => onUpdateLog(log.id, { format: checked ? undefined : settings.defaultFormat })}
                />
                {hasCustomFormat ? (
                  <div className="space-y-2">
                    <Label>Message style</Label>
                    <SegmentedFormat value={stored.format ?? settings.defaultFormat} onChange={(format) => onUpdateLog(log.id, { format })} />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <CoreSwitch
                  id={`sheet-default-color-${log.id}`}
                  label="Use default accent color"
                  description={hasCustomColor ? 'Use this log’s own color.' : 'Use the global default color.'}
                  checked={!hasCustomColor}
                  onCheckedChange={(checked) => onUpdateLog(log.id, { color: checked ? undefined : settings.defaultColor })}
                />
                {hasCustomColor ? (
                  <ColorControl label="Accent color" value={stored.color ?? settings.defaultColor} onChange={(color) => onUpdateLog(log.id, { color })} />
                ) : null}
              </div>

              <LabeledInput
                label="Log title"
                value={stored.title ?? log.defaults.title}
                onChange={(title) => onUpdateLog(log.id, { title })}
                onFocus={() => onFocusField('title')}
              />
              <div className="space-y-2">
                <Label htmlFor={`sheet-desc-${log.id}`}>Log message</Label>
                <Textarea
                  id={`sheet-desc-${log.id}`}
                  value={stored.description ?? log.defaults.description}
                  onChange={(event) => onUpdateLog(log.id, { description: event.target.value })}
                  onFocus={() => onFocusField('description')}
                  rows={4}
                />
              </div>
              <LabeledInput
                label="Footer"
                value={stored.footer ?? settings.defaultFooter}
                onChange={(footer) => onUpdateLog(log.id, { footer })}
                onFocus={() => onFocusField('footer')}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <CoreSwitch
                  id={`sheet-timestamp-${log.id}`}
                  label="Show timestamp"
                  checked={config.showTimestamp}
                  onCheckedChange={(showTimestamp) => onUpdateLog(log.id, { showTimestamp })}
                />
                <CoreSwitch
                  id={`sheet-avatar-${log.id}`}
                  label="Show avatar/icon"
                  checked={config.showAvatar}
                  onCheckedChange={(showAvatar) => onUpdateLog(log.id, { showAvatar })}
                />
              </div>

              <div className="space-y-2">
                <Label>Variable helper</Label>
                <p className="text-xs text-muted-foreground">Click a variable to insert it into the focused field.</p>
                <div className="flex flex-wrap gap-2">
                  {variables.map((variable) => (
                    <Button key={variable} type="button" variant="outline" size="sm" onClick={() => onInsertVariable(variable)}>
                      {variable}
                    </Button>
                  ))}
                </div>
              </div>

              <InvalidVariableWarning template={`${stored.title ?? log.defaults.title} ${stored.description ?? log.defaults.description} ${stored.footer ?? settings.defaultFooter}`} />

              <div className="flex flex-wrap gap-2">
                <Button onClick={onSave} disabled={!canSave || isSaving}>
                  <SaveIcon className="mr-2 size-4" />
                  {isSaving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="outline" onClick={onTest} disabled={isTesting}>
                  <SendIcon className="mr-2 size-4" />
                  {isTesting ? 'Sending…' : 'Send test log'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <LivePreviewCard log={log} settings={settings} botName={botName} botAvatarUrl={botAvatarUrl} />
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <EyeIcon className="size-3.5" />
              Preview uses sample data
            </p>
            <p className="mt-1">This shows how the log will look in Discord. Real logs use live server data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LivePreviewCard({
  log,
  settings,
  botName,
  botAvatarUrl,
}: {
  log: LogDefinition;
  settings: LogsSettings;
  botName: string;
  botAvatarUrl: string | null | undefined;
}) {
  const config = resolveLogConfig(settings, log);
  const { message } = buildPreviewMessage(log, config, settings, false);
  const isComponents = message.type === 'components_v2';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <PaletteIcon className="size-4" />
          Live preview
        </CardTitle>
        <p className="text-sm text-muted-foreground">This mirrors the Discord message using sample data.</p>
      </CardHeader>
      <CardContent className={isComponents ? 'border-l-4 p-4' : 'p-4'} style={isComponents ? { borderLeftColor: numberToHex(config.color) } : undefined}>
        <DiscordMessagePreview message={message} botName={botName} botAvatarUrl={botAvatarUrl} previewVariables={log.sample} />
      </CardContent>
    </Card>
  );
}

function InvalidVariableWarning({ template }: { template: string }) {
  const invalid = useMemo(() => {
    const matches = template.match(/\[[A-Za-z][A-Za-z0-9_.]*\]/gu) ?? [];
    return Array.from(new Set(matches.filter((match) => !variables.includes(match))));
  }, [template]);

  if (invalid.length === 0) return null;
  return (
    <Alert variant="destructive" className="py-2">
      <AlertDescription className="text-xs">
        Unknown variables: {invalid.join(', ')}
      </AlertDescription>
    </Alert>
  );
}

function ChannelSelect({
  id,
  value,
  channels,
  onChange,
}: {
  id?: string;
  value: string | null;
  channels: Array<{ id: string; name: string }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? 'none'} onValueChange={(next) => onChange(next === 'none' ? null : next)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Choose a channel" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Use default / no channel</SelectItem>
        {channels.map((channel) => (
          <SelectItem key={channel.id} value={channel.id}>
            #{channel.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SegmentedFormat({ value, onChange }: { value: LogFormat; onChange: (value: LogFormat) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-1">
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 text-sm ${value === 'embed' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        onClick={() => onChange('embed')}
      >
        Embed
      </button>
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 text-sm ${value === 'components_v2' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        onClick={() => onChange('components_v2')}
      >
        Components V2
      </button>
    </div>
  );
}

function LabeledInput({ label, value, onChange, onFocus }: { label: string; value: string; onChange: (value: string) => void; onFocus?: () => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const hex = numberToHex(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Input className="h-10 w-14 p-1" type="color" value={hex} onChange={(event) => onChange(hexToNumber(event.target.value))} />
        <Input value={hex} onChange={(event) => onChange(hexToNumber(event.target.value))} />
      </div>
      <div className="flex flex-wrap gap-2">
        {recommendedColors.map((color) => (
          <button
            key={color}
            type="button"
            className="size-6 rounded-full border border-border"
            style={{ backgroundColor: numberToHex(color) }}
            onClick={() => onChange(color)}
          >
            <span className="sr-only">Use {numberToHex(color)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PreviewResult {
  message: CoreMessage;
  allowedMentions: { parse: string[]; users: string[]; roles: string[] };
}

function buildPreviewMessage(log: LogDefinition, config: ResolvedLogConfig, settings: LogsSettings, isTest: boolean): PreviewResult {
  const title = renderTemplate(config.title, log.sample);
  const description = renderTemplate(config.description, log.sample);
  const footerText = renderTemplate(config.footer, log.sample);
  const testPrefix = isTest ? '[TEST] ' : '';
  const fields = getLogFields(log, log.sample);
  const allowedMentions = computePreviewAllowedMentions(log.sample);

  if (config.format === 'components_v2') {
    const items: ComponentsV2Item[] = [];
    items.push({ type: 'text_display', content: `**${testPrefix}${title}**` });
    if (description) items.push({ type: 'text_display', content: description });
    if (fields.length > 0) {
      items.push({ type: 'separator', divider: true, spacing: 'small' });
      for (const field of fields) {
        items.push({ type: 'text_display', content: `**${field.label}:** ${field.value}` });
      }
    }
    if (footerText || config.showTimestamp) {
      items.push({ type: 'separator', divider: true, spacing: 'small' });
      items.push({ type: 'text_display', content: `${footerText}${footerText && config.showTimestamp ? ' • ' : ''}${config.showTimestamp ? 'Today at 12:30' : ''}` });
    }
    const container: ComponentsV2Container = { type: 'container', spoiler: false, items };
    return { message: { type: 'components_v2', components: [container] }, allowedMentions };
  }

  const message: EmbedMessage = {
    type: 'embed',
    title: `${testPrefix}${title}`,
    description,
    color: config.color,
    fields: fields.map((field) => ({ name: field.label, value: field.value, inline: false })),
  };
  if (config.showAvatar) {
    message.thumbnailUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
  if (footerText || config.showTimestamp) {
    message.footer = { text: `${footerText}${footerText && config.showTimestamp ? ' • ' : ''}${config.showTimestamp ? 'Today at 12:30' : ''}`, iconSource: 'none' };
  }
  return { message, allowedMentions };
}

function computePreviewAllowedMentions(sample: Record<string, string>): { parse: string[]; users: string[]; roles: string[] } {
  const users: string[] = [];
  const roles: string[] = [];
  const userId = sample['user.id'];
  const executorId = sample['executor.id'];
  const roleId = sample['role.id'];
  if (userId && /^\d{17,20}$/.test(userId)) users.push(userId);
  if (executorId && /^\d{17,20}$/.test(executorId)) users.push(executorId);
  if (roleId && /^\d{17,20}$/.test(roleId)) roles.push(roleId);
  return { parse: [], users: Array.from(new Set(users)), roles: Array.from(new Set(roles)) };
}

function getLogFields(log: LogDefinition, sample: Record<string, string>): LogField[] {
  const fields: LogField[] = [];
  for (const { label, key } of log.fields) {
    if (key === 'oldContent') {
      const oldValue = sample.oldContent ?? '';
      const newValue = sample.newContent ?? '';
      if (oldValue || newValue) {
        fields.push({ label: 'Change', value: `${oldValue} → ${newValue}` });
      }
      continue;
    }
    const value = sample[key];
    if (value) fields.push({ label, value });
  }
  return fields;
}

function normalizeSettings(value: unknown): LogsSettings {
  return {
    ...defaultSettings,
    ...(isRecord(value) ? value : {}),
    logTypes: isRecord((value as LogsSettings | undefined)?.logTypes) ? (value as LogsSettings).logTypes : {},
  };
}

type ResolvedLogConfig = {
  enabled: boolean;
  channelId: string | null;
  format: LogFormat;
  color: number;
  title: string;
  description: string;
  footer: string;
  showTimestamp: boolean;
  showAvatar: boolean;
};

function resolveLogConfig(settings: LogsSettings, log: LogDefinition): ResolvedLogConfig {
  const stored = getStoredLogConfig(settings, log.id);
  return {
    enabled: stored.enabled ?? false,
    channelId: stored.channelId ?? settings.defaultChannelId,
    format: stored.format ?? settings.defaultFormat,
    color: stored.color ?? settings.defaultColor,
    title: stored.title ?? log.defaults.title,
    description: stored.description ?? log.defaults.description,
    footer: stored.footer ?? settings.defaultFooter,
    showTimestamp: stored.showTimestamp ?? settings.showTimestamp,
    showAvatar: stored.showAvatar ?? settings.showAvatar,
  };
}

function getStoredLogConfig(settings: LogsSettings, logId: string): LogTypeConfig {
  const [category, name] = logId.split('.');
  const rawCategory = settings.logTypes[category!];
  const categoryValue: Record<string, unknown> = isRecord(rawCategory) ? rawCategory : {};
  const rawValue = categoryValue[name!];
  const value = isRecord(rawValue) ? rawValue : {};
  return value;
}

function setLogConfig(settings: LogsSettings, logId: string, config: LogTypeConfig): LogsSettings {
  const [category, name] = logId.split('.');
  const rawCategory = settings.logTypes[category!];
  const existingCategory: Record<string, unknown> = isRecord(rawCategory) ? rawCategory : {};
  return { ...settings, logTypes: { ...settings.logTypes, [category!]: { ...existingCategory, [name!]: config } } };
}

function renderTemplate(template: string, sample: Record<string, string>): string {
  return template.replace(/\[([A-Za-z][A-Za-z0-9_.]*)\]/gu, (match, key: string) => sample[key] ?? match);
}

function labelFormat(format: LogFormat) {
  return format === 'components_v2' ? 'Components V2' : 'Embed';
}

function numberToHex(value: number): string {
  return `#${Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, '0')}`;
}

function hexToNumber(value: string): number {
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(0xffffff, parsed)) : 0x5865f2;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
