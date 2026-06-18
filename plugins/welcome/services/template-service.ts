import type { PluginTemplate, TemplateContentMode } from '@nexura/types';
import type { PluginTemplates } from '@nexura/shared';

const defaultTemplates = [
  {
    name: 'Default Welcome',
    type: 'welcome',
    contentMode: 'text' as const,
    content: { type: 'text' as const, content: 'Welcome [user] to **[serverName]**!' },
  },
  {
    name: 'Minimal Welcome',
    type: 'welcome',
    contentMode: 'text' as const,
    content: { type: 'text' as const, content: 'Welcome, [userName].' },
  },
  {
    name: 'Community Welcome',
    type: 'welcome',
    contentMode: 'embed' as const,
    content: {
      type: 'embed' as const,
      title: 'Welcome to [serverName]',
      description: '[user], you are member **[memberCount]**.',
      color: 0x5865f2,
      fields: [],
    },
  },
  {
    name: 'Staff Welcome',
    type: 'welcome',
    contentMode: 'components_v2' as const,
    content: {
      type: 'components_v2' as const,
      components: [
        {
          type: 'container' as const,
          spoiler: false,
          items: [{ type: 'text_display' as const, content: 'Welcome [user] to [serverName].' }],
        },
      ],
    },
  },
  {
    name: 'DM Welcome',
    type: 'dm',
    contentMode: 'text' as const,
    content: { type: 'text' as const, content: 'Welcome to [serverName], [userName]!' },
  },
  {
    name: 'Leave Message',
    type: 'leave',
    contentMode: 'text' as const,
    content: { type: 'text' as const, content: '[userName] left [serverName].' },
  },
] as const;

export class WelcomeTemplateService {
  constructor(private readonly templates: PluginTemplates) {}

  async ensureDefaults(): Promise<void> {
    const existing = new Set((await this.templates.list()).map((template) => template.name));
    for (const template of defaultTemplates) {
      if (!existing.has(template.name)) {
        await this.templates.save({ ...template, variables: getVariables(template.contentMode) });
      }
    }
  }

  get(name: string): Promise<PluginTemplate | null> {
    return this.templates.get(name);
  }

  list(): Promise<PluginTemplate[]> {
    return this.templates.list();
  }

  save(template: {
    name: string;
    type: string;
    contentMode: TemplateContentMode;
    content: unknown;
    previewData?: Record<string, string>;
  }): Promise<PluginTemplate> {
    return this.templates.save({
      ...template,
      variables: getVariables(template.contentMode),
    });
  }
}

function getVariables(_mode: TemplateContentMode): string[] {
  return [
    'user',
    'userName',
    'userCreatedDate',
    'userCreatedDays',
    'serverName',
    'memberCount',
    'inviter',
    'inviterName',
    'invitesCount',
    'inviteCode',
  ];
}
