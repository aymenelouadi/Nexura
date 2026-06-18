import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@nexura/ui';
import {
  discordSnowflakeSchema,
  pluginLogDestinationSchema,
  pluginLogOutputTypeSchema,
  type CoreMessage,
  type PluginCommand,
  type PluginLogLevel,
  type PluginTemplate,
} from '@nexura/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import {
  BellIcon,
  MessageCircleIcon,
  MonitorIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
  TrashIcon,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { welcomeMessageTypeSchema, type DmWelcomeSettings, type LeaveSettings, type WelcomeSettings } from '@nexura/plugin-welcome/schemas/settings';
import { DiscordMessagePreview, samplePreviewData } from '../../components/discord-message-preview.js';
import { ErrorState } from '../../components/error-state.js';
import { createDefaultMessage, MessageComposer, type MessageMode } from '../../components/message-composer.js';
import {
  PluginEditorLayout,
  PluginEmptyState,
  PluginListItem,
  PluginPreviewPanel,
  PluginSaveBar,
  PluginSection,
} from '../../components/plugin-ui-kit.js';
import {
  botProfileQuery,
  currentUserQuery,
  guildChannelsQuery,
  guildPluginCommandsQuery,
  guildPluginTemplatesQuery,
} from '../../hooks/queries.js';
import { formatShortDate, formatDateTime } from '../../lib/date.js';
import { api } from '../../lib/api-client.js';

const pluginId = 'welcome';
const levels: PluginLogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'AUDIT'];

export const welcomeVariables = [
  { key: '[user]', label: 'User mention', description: 'Mentions the joining or leaving member.', group: 'User' },
  { key: '[userName]', label: 'Username', description: 'The member display name.', group: 'User' },
  { key: '[userCreatedDate]', label: 'Account created', description: 'Date the Discord account was created.', group: 'User' },
  { key: '[userCreatedDays]', label: 'Account age', description: 'Account age in days.', group: 'User' },
  { key: '[serverName]', label: 'Server name', description: 'Current Discord server name.', group: 'Server' },
  { key: '[memberCount]', label: 'Member count', description: 'Current server member count.', group: 'Server' },
  { key: '[inviter]', label: 'Inviter mention', description: 'Mentions the invite creator when known.', group: 'Invites' },
  { key: '[inviterName]', label: 'Inviter name', description: 'Name of the invite creator.', group: 'Invites' },
  { key: '[invitesCount]', label: 'Invite count', description: 'Total uses of the matched invite.', group: 'Invites' },
  { key: '[inviteCode]', label: 'Invite code', description: 'The matched invite code.', group: 'Invites' },
];

export function createWelcomeContentMap(guildId: string): Record<string, ReactNode> {
  return {
    overview: <WelcomeOverview guildId={guildId} />,
    welcome: <WelcomeMessageTab guildId={guildId} />,
    leave: <LeaveMessageTab guildId={guildId} />,
    dm: <DmWelcomeTab guildId={guildId} />,
    templates: <TemplatesTab guildId={guildId} />,
    commands: <CommandsTab guildId={guildId} />,
    logs: <WelcomeLogsTab guildId={guildId} />,
  };
}

function WelcomeOverview({ guildId }: { guildId: string }) {
  const templates = useQuery({ ...guildPluginTemplatesQuery(guildId, pluginId), enabled: Boolean(guildId) });
  const welcome = usePluginSettingsQuery<WelcomeSettings>(guildId, 'settings/welcome');
  const leave = usePluginSettingsQuery<LeaveSettings>(guildId, 'settings/leave');
  const dm = usePluginSettingsQuery<DmWelcomeSettings>(guildId, 'settings/dm');
  const logs = useQuery({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'logs'], queryFn: () => api.getGuildPluginLogs(guildId, pluginId), enabled: Boolean(guildId) });

  const lastDelivery = logs.data?.data[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SparklesIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Welcome automation</CardTitle>
              <CardDescription>Configure join, leave, and private welcome messages.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Metric label="Templates" value={String(templates.data?.data.length ?? 0)} />
          <Metric label="Welcome" value={welcome.data?.enabled ? 'On' : 'Off'} />
          <Metric label="Leave" value={leave.data?.enabled ? 'On' : 'Off'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick setup checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ChecklistItem done={welcome.data?.enabled ?? false} label="Enable welcome messages" />
          <ChecklistItem done={Boolean(welcome.data?.channelId)} label="Choose a welcome channel" />
          <ChecklistItem done={leave.data?.enabled ?? false} label="Enable leave messages" />
          <ChecklistItem done={dm.data?.enabled ?? false} label="Enable DM welcome" />
          <ChecklistItem done={(templates.data?.data.length ?? 0) > 0} label="Create at least one template" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Last delivery</CardTitle>
        </CardHeader>
        <CardContent>
          {lastDelivery ? (
            <div className="space-y-1 text-sm">
              <p>{lastDelivery.message}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(lastDelivery.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.hash = `#/dashboard/${guildId}/plugins/welcome/welcome`}>
            <MessageCircleIcon data-icon="inline-start" /> Configure welcome
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.hash = `#/dashboard/${guildId}/plugins/welcome/templates`}>
            <PlusIcon data-icon="inline-start" /> Templates
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeMessageTab({ guildId }: { guildId: string }) {
  return (
    <MessageSettingsPanel
      guildId={guildId}
      storageKey="settings/welcome"
      title="Welcome messages"
      description="Send a message when a new member joins your server."
      usage="welcome"
      defaultTemplateName="Default Welcome"
      showMentionUser
      showDeleteIfUserLeaves
    />
  );
}

function LeaveMessageTab({ guildId }: { guildId: string }) {
  return (
    <MessageSettingsPanel
      guildId={guildId}
      storageKey="settings/leave"
      title="Leave messages"
      description="Send a message when someone leaves."
      usage="leave"
      defaultTemplateName="Leave Message"
    />
  );
}

function DmWelcomeTab({ guildId }: { guildId: string }) {
  return (
    <MessageSettingsPanel
      guildId={guildId}
      storageKey="settings/dm"
      title="DM Welcome"
      description="Send a private welcome message, with optional channel fallback."
      usage="dm"
      defaultTemplateName="DM Welcome"
    />
  );
}

type MessageSettings = WelcomeSettings | LeaveSettings | DmWelcomeSettings;

interface MessageSettingsPanelProps {
  guildId: string;
  storageKey: string;
  title: string;
  description: string;
  usage: 'welcome' | 'leave' | 'dm';
  defaultTemplateName: string;
  showMentionUser?: boolean;
  showDeleteIfUserLeaves?: boolean;
}

const messageSettingsFormSchema = z.object({
  enabled: z.boolean(),
  channelId: z.string().nullable(),
  messageType: welcomeMessageTypeSchema,
  templateId: z.string().min(1).max(100),
  mentionUser: z.boolean(),
  deleteIfUserLeavesBeforeSend: z.boolean(),
  autoDeleteEnabled: z.boolean(),
  autoDeleteAfterSeconds: z.number().int().min(1).max(86_400),
  fallbackIfDmClosed: z.boolean(),
  fallbackChannelId: z.string().nullable(),
});

type MessageSettingsFormValues = z.infer<typeof messageSettingsFormSchema>;

function MessageSettingsPanel({
  guildId,
  storageKey,
  title,
  description,
  usage,
  defaultTemplateName,
  showMentionUser,
  showDeleteIfUserLeaves,
}: MessageSettingsPanelProps) {
  const queryClient = useQueryClient();
  const settingsQuery = usePluginSettingsQuery<MessageSettings>(guildId, storageKey);
  const templates = useQuery({ ...guildPluginTemplatesQuery(guildId, pluginId), enabled: Boolean(guildId) });
  const channels = useQuery({ ...guildChannelsQuery(guildId), enabled: Boolean(guildId) });
  const user = useQuery({ ...currentUserQuery, enabled: Boolean(guildId) });
  const botProfile = useQuery({ ...botProfileQuery, enabled: Boolean(guildId) });

  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState<CoreMessage | null>(null);

  const form = useForm<MessageSettingsFormValues>({
    resolver: zodResolver(messageSettingsFormSchema),
    defaultValues: settingsToFormValues(createDefaultSettings(usage, defaultTemplateName)),
  });

  useEffect(() => {
    if (settingsQuery.isSuccess) {
      form.reset(settingsToFormValues(settingsQuery.data ?? createDefaultSettings(usage, defaultTemplateName)));
    }
  }, [settingsQuery.data, settingsQuery.isSuccess, form, usage, defaultTemplateName]);

  const watchedTemplateId = form.watch('templateId');
  const watchedMessageType = form.watch('messageType');
  const mode = (watchedMessageType ?? 'text') as MessageMode;
  const selectedTemplate = templates.data?.data.find((template) => template.name === watchedTemplateId);

  useEffect(() => {
    if (selectedTemplate && selectedTemplate.contentMode === mode) {
      setMessage(selectedTemplate.content as CoreMessage);
    } else if (!message || message.type !== mode) {
      setMessage(createDefaultMessage(mode));
    }
  }, [selectedTemplate?.name, mode]);

  const save = useMutation({
    mutationFn: async (values: MessageSettingsFormValues) => {
      const templateName = values.templateId;
      if (!templateName) throw new Error('No template selected.');
      if (!message) throw new Error('No message content.');
      const settings = formValuesToSettings(values, usage);
      await api.setGuildPluginStorage(guildId, pluginId, storageKey, settings);
      await api.saveGuildPluginTemplate(guildId, pluginId, {
        name: templateName,
        type: usage,
        contentMode: mode,
        content: message,
        variables: welcomeVariables.map((v) => v.key),
        previewData: samplePreviewData,
      });
      return settings;
    },
    onSuccess: async (settings) => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'storage', storageKey] });
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'templates'] });
      form.reset(settingsToFormValues(settings));
      toast.success(`${title} saved.`);
    },
    onError: (error) => toast.error(error.message || `Failed to save ${title.toLowerCase()}.`),
  });

  const test = useMutation({
    mutationFn: async (values: MessageSettingsFormValues) => {
      if (!values.enabled) throw new Error('Enable this message before testing.');
      if (!message) throw new Error('No message content.');
      const templateName = values.templateId;
      if (!templateName) throw new Error('No template selected.');
      await api.saveGuildPluginTemplate(guildId, pluginId, {
        name: templateName,
        type: usage,
        contentMode: mode,
        content: message,
        variables: welcomeVariables.map((v) => v.key),
        previewData: samplePreviewData,
      });
      const channelId = usage === 'dm' ? values.fallbackChannelId : values.channelId;
      const userId = usage === 'dm' ? user.data?.discordId : undefined;
      if (!channelId && !userId) throw new Error('No destination selected.');
      return api.testGuildPluginTemplate(guildId, pluginId, templateName, {
        channelId: channelId ?? undefined,
        userId,
        variables: samplePreviewData,
      });
    },
    onSuccess: () => toast.success('Test message sent.'),
    onError: (error) => toast.error(error.message || 'Failed to send test message.'),
  });

  const onSubmit = useCallback((values: MessageSettingsFormValues) => {
    save.mutate(values);
  }, [save]);

  if (settingsQuery.isLoading) return <Skeleton className="h-96 w-full" />;
  if (settingsQuery.isError) return <ErrorState message={settingsQuery.error.message} onRetry={() => void settingsQuery.refetch()} />;

  const showChannel = usage !== 'dm';
  const showFallback = usage === 'dm';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch id={`${usage}-enabled`} checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel htmlFor={`${usage}-enabled`} className="cursor-pointer">
                      {field.value ? 'Enabled' : 'Disabled'}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              {showChannel ? (
                <FormField
                  control={form.control}
                  name="channelId"
                  render={({ field }) => (
                    <FormItem>
                      <ChannelSelect
                        label={<FormLabel>Channel</FormLabel>}
                        description="Where to send the message."
                        value={field.value}
                        channels={channels.data?.data ?? []}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              {showFallback ? (
                <>
                  <FormField
                    control={form.control}
                    name="fallbackIfDmClosed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            id={`${usage}-fallback`}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel htmlFor={`${usage}-fallback`} className="cursor-pointer">
                          Fallback to channel if DM is closed
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {form.watch('fallbackIfDmClosed') ? (
                    <FormField
                      control={form.control}
                      name="fallbackChannelId"
                      render={({ field }) => (
                        <FormItem>
                          <ChannelSelect
                            label={<FormLabel>Fallback channel</FormLabel>}
                            value={field.value}
                            channels={channels.data?.data ?? []}
                            onChange={field.onChange}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </>
              ) : null}
              <FormField
                control={form.control}
                name="messageType"
                render={({ field }) => (
                  <FormItem>
                    <MessageTypeSelect label={<FormLabel>Message type</FormLabel>} value={field.value} onChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!advanced ? (
              <MessageComposer
                guildId={guildId}
                mode={mode}
                value={message}
                variables={welcomeVariables}
                placeholder={`Write your ${usage} message...`}
                showPreview={false}
                onModeChange={(nextMode) => form.setValue('messageType', nextMode, { shouldDirty: true })}
                onChange={setMessage}
              />
            ) : null}

            <Button variant="ghost" size="sm" onClick={() => setAdvanced((value) => !value)} className="w-fit">
              {advanced ? 'Hide advanced' : 'Advanced settings'}
            </Button>

            {advanced ? (
              <div className="grid gap-5 rounded-lg border border-border p-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <TemplateSelect
                        label={<FormLabel>Template</FormLabel>}
                        value={field.value}
                        templates={templates.data?.data ?? []}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {usage !== 'dm' ? (
                  <>
                    <FormField
                      control={form.control}
                      name="autoDeleteEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Switch
                              id={`${usage}-autodelete`}
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel htmlFor={`${usage}-autodelete`} className="cursor-pointer">
                            Auto-delete after send
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch('autoDeleteEnabled') ? (
                      <FormField
                        control={form.control}
                        name="autoDeleteAfterSeconds"
                        render={({ field }) => (
                          <FormItem>
                            <NumberField
                              label={<FormLabel>Delete after (seconds)</FormLabel>}
                              value={field.value}
                              onChange={field.onChange}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </>
                ) : null}
                {showMentionUser ? (
                  <FormField
                    control={form.control}
                    name="mentionUser"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            id={`${usage}-mention`}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel htmlFor={`${usage}-mention`} className="cursor-pointer">
                          Mention user
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ) : null}
                {showDeleteIfUserLeaves ? (
                  <FormField
                    control={form.control}
                    name="deleteIfUserLeavesBeforeSend"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            id={`${usage}-delete-leave`}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel htmlFor={`${usage}-delete-leave`} className="cursor-pointer">
                          Delete if user leaves before send
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ) : null}
                <MessageComposer
                  guildId={guildId}
                  mode={mode}
                  value={message}
                  variables={welcomeVariables}
                  placeholder={`Write your ${usage} message...`}
                  showPreview={false}
                  onModeChange={(nextMode) => form.setValue('messageType', nextMode, { shouldDirty: true })}
                  onChange={setMessage}
                />
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-[#313338] p-4">
              <DiscordMessagePreview
                message={message ?? createDefaultMessage(mode)}
                botName={botProfile.data?.username ?? 'Nexura'}
                botAvatarUrl={botProfile.data?.avatarUrl}
              />
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 mt-auto flex flex-col-reverse items-stretch justify-end gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={() => test.mutate(form.getValues())} disabled={test.isPending || save.isPending}>
            <SendIcon data-icon="inline-start" /> Send test {usage} message
          </Button>
          <Button size="sm" type="submit" disabled={!form.formState.isDirty || save.isPending || test.isPending}>
            <SaveIcon data-icon="inline-start" /> Save {title.toLowerCase()}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TemplatesTab({ guildId }: { guildId: string }) {
  const queryClient = useQueryClient();
  const templates = useQuery({ ...guildPluginTemplatesQuery(guildId, pluginId), enabled: Boolean(guildId) });
  const botProfile = useQuery({ ...botProfileQuery, enabled: Boolean(guildId) });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PluginTemplate | 'new' | null>(null);
  const [name, setName] = useState('New Template');
  const [type, setType] = useState<'welcome' | 'leave' | 'dm'>('welcome');
  const [mode, setMode] = useState<MessageMode>('text');
  const [content, setContent] = useState<CoreMessage>(createDefaultMessage('text'));
  const [deleteTarget, setDeleteTarget] = useState<PluginTemplate | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.saveGuildPluginTemplate(guildId, pluginId, {
        name,
        type,
        contentMode: mode,
        content,
        variables: welcomeVariables.map((v) => v.key),
        previewData: samplePreviewData,
      }),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'templates'] });
      toast.success('Template saved.');
    },
    onError: (error) => toast.error(error.message || 'Failed to save template.'),
  });

  const duplicate = useMutation({
    mutationFn: (template: PluginTemplate) => api.duplicateGuildPluginTemplate(guildId, pluginId, template.name, `${template.name} Copy`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'templates'] });
      toast.success('Template duplicated.');
    },
    onError: (error) => toast.error(error.message || 'Failed to duplicate template.'),
  });

  const remove = useMutation({
    mutationFn: (template: PluginTemplate) => api.deleteGuildPluginTemplate(guildId, pluginId, template.name),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'templates'] });
      toast.success('Template deleted.');
    },
    onError: (error) => toast.error(error.message || 'Failed to delete template.'),
  });

  if (templates.isLoading) return <Skeleton className="h-96 w-full" />;
  if (templates.isError) return <ErrorState message={templates.error.message} onRetry={() => void templates.refetch()} />;

  const items = templates.data?.data ?? [];
  const templateFuse = useMemo(() => new Fuse(items, { keys: ['name', 'type'], threshold: 0.4 }), [items]);
  const filteredItems = useMemo(
    () =>
      search.trim()
        ? templateFuse.search(search).map((result) => result.item)
        : items,
    [items, search, templateFuse],
  );
  const selectedName = editing === 'new' ? 'new' : editing?.name ?? null;

  function beginEdit(template: PluginTemplate | 'new') {
    setEditing(template);
    setName(template === 'new' ? 'New Template' : template.name);
    setType(template === 'new' ? 'welcome' : (template.type as 'welcome' | 'leave' | 'dm'));
    const nextMode = template === 'new' ? 'text' : template.contentMode === 'visual_card' ? 'text' : template.contentMode;
    setMode(nextMode);
    setContent(template === 'new' ? createDefaultMessage(nextMode) : (template.content as CoreMessage));
  }

  const list = (
    <PluginSection
      title="Templates"
      description="Reusable messages for Welcome, Leave, and DM flows."
      actions={[{ id: 'create-template', label: 'Create', icon: 'Create', variant: 'primary' }]}
      onAction={() => beginEdit('new')}
    >
      <div className="border-b border-border p-4">
        <Input placeholder="Search templates" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <ScrollArea className="h-[60vh]">
        {items.length === 0 ? (
          <PluginEmptyState title="No templates" description="Create a template for Welcome, Leave, or DM usage." />
        ) : filteredItems.length === 0 ? (
          <PluginEmptyState title="No matches" description="Try another template name." />
        ) : (
          filteredItems.map((template) => (
            <PluginListItem
              key={template.name}
              selected={selectedName === template.name}
              title={template.name}
              description={`Updated ${formatShortDate(template.updatedAt)}`}
              badges={[toUsage(template.type), labelMode(template.contentMode)]}
              onClick={() => beginEdit(template)}
              actions={[
                { id: 'duplicate', label: 'Duplicate', icon: 'Duplicate', variant: 'outline' },
                { id: 'delete', label: 'Delete', icon: 'Delete', variant: 'destructive' },
              ]}
              onAction={(action) => {
                if (action === 'duplicate') duplicate.mutate(template);
                if (action === 'delete') setDeleteTarget(template);
              }}
            />
          ))
        )}
      </ScrollArea>
    </PluginSection>
  );

  const editor = editing ? (
    <PluginSection title={editing === 'new' ? 'Create Template' : 'Edit Template'} description="Template details and message content.">
      <div className="flex flex-col gap-5 p-5">
        <PluginSection title="Template Details">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-type">Usage</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger id="template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="dm">DM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PluginSection>
        <PluginSection title="Message Content" description="Use Text, Embed, or Components V2.">
          <div className="p-5">
            <MessageComposer
              guildId={guildId}
              mode={mode}
              value={content}
              variables={welcomeVariables}
              showPreview={false}
              onModeChange={(nextMode) => { setMode(nextMode); setContent(createDefaultMessage(nextMode)); }}
              onChange={setContent}
            />
          </div>
        </PluginSection>
      </div>
      <PluginSaveBar
        actions={[
          { id: 'cancel-template', label: 'Cancel', icon: 'Cancel', variant: 'outline' },
          { id: 'save-template', label: 'Save template', icon: 'Save', variant: 'primary', loading: save.isPending },
        ]}
        onAction={(action) => {
          if (action === 'cancel-template') setEditing(null);
          if (action === 'save-template') save.mutate();
        }}
      />
    </PluginSection>
  ) : (
    <PluginEmptyState title="Select a template" description="Create or select a template to open the editor." />
  );

  const preview = (
    <PluginPreviewPanel title="Preview">
      <DiscordMessagePreview message={content} botName={botProfile.data?.username ?? 'Nexura'} botAvatarUrl={botProfile.data?.avatarUrl} />
    </PluginPreviewPanel>
  );

  return (
    <>
      <PluginEditorLayout list={list} editor={editor} preview={preview} />
      <DeleteTemplateDialog
        open={deleteTarget !== null}
        template={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
        isPending={remove.isPending}
      />
    </>
  );
}

const commandFormSchema = z.object({
  enabled: z.boolean(),
  name: z.string().min(1).max(32).regex(/^[a-z0-9_-]{1,32}$/),
  description: z.string().min(1).max(100),
  aliases: z.string(),
  allowedRoleIds: z.string(),
  enabledChannelIds: z.string(),
});

type CommandFormValues = z.infer<typeof commandFormSchema>;

function CommandsTab({ guildId }: { guildId: string }) {
  const queryClient = useQueryClient();
  const commands = useQuery({ ...guildPluginCommandsQuery(guildId, pluginId), enabled: Boolean(guildId) });
  const update = useMutation({
    mutationFn: ({ command, patch }: { command: PluginCommand; patch: Parameters<typeof api.updateGuildPluginCommand>[3] }) =>
      api.updateGuildPluginCommand(guildId, pluginId, command.commandId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'commands'] });
      toast.success('Command saved.');
    },
    onError: (error) => toast.error(error.message || 'Failed to save command.'),
  });

  if (commands.isLoading) return <Skeleton className="h-96 w-full" />;
  if (commands.isError) return <ErrorState message={commands.error.message} onRetry={() => void commands.refetch()} />;

  const configured = commands.data?.data ?? [];
  const fallback = [
    { commandId: 'create_invite', defaultName: 'create_invite', name: 'create_invite', defaultDescription: 'Create an invite link for the server.', description: 'Create an invite link for the server.', enabled: true, aliases: ['invite', 'newinvite'] },
    { commandId: 'setwelcome', defaultName: 'setwelcome', name: 'setwelcome', defaultDescription: 'Enable or disable welcome messages.', description: 'Enable or disable welcome messages.', enabled: true, aliases: ['welcome-toggle'] },
  ] as PluginCommand[];
  const list = configured.length ? configured : fallback;
  return <div className="grid gap-4 xl:grid-cols-2">{list.map((command) => <CommandCard key={command.commandId} command={command} onSave={(patch) => update.mutate({ command, patch })} />)}</div>;
}

function CommandCard({ command, onSave }: { command: PluginCommand; onSave: (patch: Parameters<typeof api.updateGuildPluginCommand>[3]) => void }) {
  const form = useForm<CommandFormValues>({
    resolver: zodResolver(commandFormSchema),
    defaultValues: {
      enabled: command.enabled,
      name: command.name,
      description: command.description,
      aliases: command.aliases.join(', '),
      allowedRoleIds: command.permissions.allowedRoleIds.join(', '),
      enabledChannelIds: command.permissions.enabledChannelIds.join(', '),
    },
  });

  useEffect(() => {
    form.reset({
      enabled: command.enabled,
      name: command.name,
      description: command.description,
      aliases: command.aliases.join(', '),
      allowedRoleIds: command.permissions.allowedRoleIds.join(', '),
      enabledChannelIds: command.permissions.enabledChannelIds.join(', '),
    });
  }, [command, form]);

  function onSubmit(values: CommandFormValues) {
    onSave({
      name: values.name,
      description: values.description,
      enabled: values.enabled,
      aliases: csv(values.aliases),
      permissions: {
        allowedRoleIds: csv(values.allowedRoleIds),
        ignoredRoleIds: command.permissions.ignoredRoleIds,
        ignoredChannelIds: command.permissions.ignoredChannelIds,
        enabledChannelIds: csv(values.enabledChannelIds),
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">/{command.defaultName}</CardTitle>
                <CardDescription>{command.defaultDescription}</CardDescription>
              </div>
              <Badge variant={form.watch('enabled') ? 'success' : 'outline'}>{form.watch('enabled') ? 'Enabled' : 'Disabled'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch id={`cmd-${command.commandId}`} checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel htmlFor={`cmd-${command.commandId}`} className="cursor-pointer">Enabled</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`cmd-name-${command.commandId}`}>Slash command name override</FormLabel>
                  <FormControl>
                    <Input id={`cmd-name-${command.commandId}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`cmd-desc-${command.commandId}`}>Description override</FormLabel>
                  <FormControl>
                    <Input id={`cmd-desc-${command.commandId}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aliases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`cmd-aliases-${command.commandId}`}>Prefix aliases (comma separated)</FormLabel>
                  <FormControl>
                    <Input id={`cmd-aliases-${command.commandId}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowedRoleIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`cmd-roles-${command.commandId}`}>Allowed roles (comma separated)</FormLabel>
                  <FormControl>
                    <Input id={`cmd-roles-${command.commandId}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="enabledChannelIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`cmd-channels-${command.commandId}`}>Enabled channels (comma separated)</FormLabel>
                  <FormControl>
                    <Input id={`cmd-channels-${command.commandId}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
              <SaveIcon data-icon="inline-start" /> Save command
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

const logSettingsFormSchema = z.object({
  destination: pluginLogDestinationSchema,
  channelId: discordSnowflakeSchema.nullable(),
  outputType: pluginLogOutputTypeSchema,
  embedColor: z.number().int().min(0).max(0xffffff).nullable(),
});

type LogSettingsFormValues = z.infer<typeof logSettingsFormSchema>;

function WelcomeLogsTab({ guildId }: { guildId: string }) {
  const queryClient = useQueryClient();
  const logs = useQuery({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'logs'], queryFn: () => api.getGuildPluginLogs(guildId, pluginId), enabled: Boolean(guildId) });
  const settings = useQuery({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'log-settings'], queryFn: () => api.getGuildPluginLogSettings(guildId, pluginId), enabled: Boolean(guildId) });
  const channels = useQuery({ ...guildChannelsQuery(guildId), enabled: Boolean(guildId) });
  const [level, setLevel] = useState<PluginLogLevel | ''>('');
  const [category, setCategory] = useState('');
  const updateSettings = useMutation({
    mutationFn: (patch: LogSettingsFormValues) => api.updateGuildPluginLogSettings(guildId, pluginId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins', pluginId, 'log-settings'] });
    },
  });

  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsFormSchema),
    defaultValues: settings.data
      ? {
          destination: settings.data.destination,
          channelId: settings.data.channelId,
          outputType: settings.data.outputType,
          embedColor: settings.data.embedColor,
        }
      : {
          destination: 'DISABLED',
          channelId: null,
          outputType: 'text',
          embedColor: null,
        },
  });

  useEffect(() => {
    if (settings.data) {
      form.reset({
        destination: settings.data.destination,
        channelId: settings.data.channelId,
        outputType: settings.data.outputType,
        embedColor: settings.data.embedColor,
      });
    }
  }, [settings.data, form]);

  const submitIfValid = useCallback(() => {
    void form.handleSubmit((data) => updateSettings.mutate(data))();
  }, [form, updateSettings]);

  const outputType = form.watch('outputType');

  if (logs.isLoading || settings.isLoading) return <Skeleton className="h-96 w-full" />;
  if (logs.isError) return <ErrorState message={logs.error.message} onRetry={() => void logs.refetch()} />;
  if (settings.isError) return <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />;

  const entries = (logs.data?.data ?? []).filter((entry) => (!level || entry.level === level) && (!category || String((entry.metadata.category ?? '') as string).toLowerCase().includes(category.toLowerCase())));

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Log destination</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Form {...form}>
            <form className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="log-destination">Destination</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        submitIfValid();
                      }}
                    >
                      <FormControl>
                        <SelectTrigger id="log-destination">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DASHBOARD">Dashboard only</SelectItem>
                        <SelectItem value="DISCORD">Discord channel only</SelectItem>
                        <SelectItem value="BOTH">Both</SelectItem>
                        <SelectItem value="DISABLED">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channelId"
                render={({ field }) => (
                  <FormItem>
                    <ChannelSelect
                      label={<FormLabel>Discord log channel</FormLabel>}
                      value={field.value}
                      channels={channels.data?.data ?? []}
                      onChange={(value) => {
                        field.onChange(value);
                        submitIfValid();
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="outputType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="log-output">Output type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== 'embed') {
                          form.setValue('embedColor', null, { shouldDirty: true });
                        } else if (form.getValues('embedColor') === null) {
                          form.setValue('embedColor', 0x5865f2, { shouldDirty: true });
                        }
                        submitIfValid();
                      }}
                    >
                      <FormControl>
                        <SelectTrigger id="log-output">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="embed">Embed</SelectItem>
                        <SelectItem value="components_v2">Components V2</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {outputType === 'embed' ? (
                <FormField
                  control={form.control}
                  name="embedColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="log-color">Embed color</FormLabel>
                      <FormControl>
                        <Input
                          id="log-color"
                          type="color"
                          value={`#${(field.value ?? 0x5865f2).toString(16).padStart(6, '0')}`}
                          onChange={(event) => {
                            field.onChange(Number.parseInt(event.target.value.replace('#', ''), 16));
                            submitIfValid();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm">Welcome plugin logs</CardTitle>
            <div className="flex gap-2">
              <Select value={level} onValueChange={(value) => setLevel(value as PluginLogLevel | '')}>
                <SelectTrigger className="h-8 w-auto">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All levels</SelectItem>
                  {levels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="h-8 w-40" placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {entries.length ? entries.map((entry) => (
            <article key={entry.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[90px_1fr_auto]">
              <Badge variant={entry.level === 'ERROR' ? 'destructive' : 'outline'}>{entry.level}</Badge>
              <div>
                <p className="text-sm">{entry.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{String((entry.metadata.category ?? 'uncategorized') as string)}</p>
              </div>
                <time className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
            </article>
          )) : <PluginEmptyState title="No welcome logs" description="Welcome plugin runtime activity will appear here." />}
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteTemplateDialog({ open, template, onCancel, onConfirm, isPending }: { open: boolean; template: PluginTemplate | null; onCancel: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{template?.name ?? ''}&quot;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            <TrashIcon data-icon="inline-start" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function usePluginSettingsQuery<T>(guildId: string, key: string) {
  return useQuery({
    queryKey: ['guilds', guildId, 'plugins', pluginId, 'storage', key],
    queryFn: () => api.getGuildPluginStorage(guildId, pluginId, key),
    select: (data) => data.value as T,
    enabled: Boolean(guildId),
  });
}

function createDefaultSettings(usage: 'welcome' | 'leave' | 'dm', defaultTemplateName: string): MessageSettings {
  if (usage === 'welcome') {
    return {
      enabled: false,
      channelId: null,
      messageType: 'text',
      templateId: defaultTemplateName,
      mentionUser: true,
      deleteIfUserLeavesBeforeSend: true,
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    };
  }
  if (usage === 'leave') {
    return {
      enabled: false,
      channelId: null,
      messageType: 'text',
      templateId: defaultTemplateName,
      autoDeleteEnabled: false,
      autoDeleteAfterSeconds: 30,
    };
  }
  return {
    enabled: false,
    messageType: 'text',
    templateId: defaultTemplateName,
    fallbackIfDmClosed: false,
    fallbackChannelId: null,
  };
}

function settingsToFormValues(settings: MessageSettings): MessageSettingsFormValues {
  return {
    enabled: settings.enabled,
    messageType: settings.messageType,
    templateId: settings.templateId,
    channelId: 'channelId' in settings ? settings.channelId : null,
    mentionUser: 'mentionUser' in settings ? settings.mentionUser : true,
    deleteIfUserLeavesBeforeSend: 'deleteIfUserLeavesBeforeSend' in settings ? settings.deleteIfUserLeavesBeforeSend : true,
    autoDeleteEnabled: 'autoDeleteEnabled' in settings ? settings.autoDeleteEnabled : false,
    autoDeleteAfterSeconds: 'autoDeleteAfterSeconds' in settings ? settings.autoDeleteAfterSeconds : 30,
    fallbackIfDmClosed: 'fallbackIfDmClosed' in settings ? settings.fallbackIfDmClosed : false,
    fallbackChannelId: 'fallbackChannelId' in settings ? settings.fallbackChannelId : null,
  };
}

function formValuesToSettings(values: MessageSettingsFormValues, usage: 'welcome' | 'leave' | 'dm'): MessageSettings {
  const base = {
    enabled: values.enabled,
    messageType: values.messageType,
    templateId: values.templateId,
  };
  if (usage === 'welcome') {
    return {
      ...base,
      channelId: values.channelId,
      mentionUser: values.mentionUser,
      deleteIfUserLeavesBeforeSend: values.deleteIfUserLeavesBeforeSend,
      autoDeleteEnabled: values.autoDeleteEnabled,
      autoDeleteAfterSeconds: values.autoDeleteAfterSeconds,
    };
  }
  if (usage === 'leave') {
    return {
      ...base,
      channelId: values.channelId,
      autoDeleteEnabled: values.autoDeleteEnabled,
      autoDeleteAfterSeconds: values.autoDeleteAfterSeconds,
    };
  }
  return {
    ...base,
    messageType: values.messageType as DmWelcomeSettings['messageType'],
    fallbackIfDmClosed: values.fallbackIfDmClosed,
    fallbackChannelId: values.fallbackChannelId,
  };
}

function ChannelSelect({ label, description, value, channels, onChange }: { label: ReactNode; description?: string; value: string | null; channels: Array<{ id: string; name: string }>; onChange: (value: string | null) => void }) {
  return (
    <div className="grid gap-2">
      {label}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <Select value={value ?? ''} onValueChange={(selected) => onChange(selected || null)}>
        <SelectTrigger>
          <SelectValue placeholder="Select channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No channel</SelectItem>
          {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TemplateSelect({ label, value, templates, onChange }: { label: ReactNode; value: string; templates: PluginTemplate[]; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function MessageTypeSelect({ label, value, onChange }: { label: ReactNode; value: MessageSettingsFormValues['messageType']; onChange: (value: MessageSettingsFormValues['messageType']) => void }) {
  return (
    <div className="grid gap-2">
      {label}
      <Select value={value} onValueChange={(value) => onChange(value as MessageSettingsFormValues['messageType'])}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text</SelectItem>
          <SelectItem value="embed">Embed</SelectItem>
          <SelectItem value="components_v2">Components V2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: ReactNode; value: number; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-2">
      {label}
      <Input type="number" min={1} max={86_400} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={cn('flex size-5 items-center justify-center rounded-full border', done ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground text-muted-foreground')}>
        {done ? <MonitorIcon className="size-3" /> : <BellIcon className="size-3" />}
      </div>
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function toUsage(type: string): string {
  if (type.toLowerCase().includes('leave')) return 'Leave';
  if (type.toLowerCase().includes('dm')) return 'DM';
  if (type.toLowerCase().includes('welcome')) return 'Welcome';
  return 'Any';
}

function labelMode(mode: string): string {
  if (mode === 'components_v2') return 'Components V2';
  if (mode === 'embed') return 'Embed';
  return 'Text';
}

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export { DiscordMessagePreview, MessageComposer };
