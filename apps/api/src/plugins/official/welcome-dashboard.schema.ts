import type { PluginDashboardSchemaDocument } from '@nexura/types';

export const welcomeDashboardSchema = {
  version: 1,
  contentMode: 'schema',
  previewVariables: {
    user: '@Mira',
    userName: 'Mira',
    userDisplayName: 'Mira Vale',
    serverName: 'Nexura Labs',
    memberCount: '12482',
    inviter: '@Nora',
    invitesCount: '42',
  },
  defaults: {
    'settings.welcome.enabled': false,
    'settings.welcome.channelId': null,
    'settings.welcome.messageType': 'text',
    'settings.welcome.templateId': 'Default Welcome',
    'settings.welcome.mentionUser': true,
    'settings.welcome.deleteIfUserLeavesBeforeSend': true,
    'settings.welcome.autoDeleteEnabled': false,
    'settings.welcome.autoDeleteAfterSeconds': 30,
    'settings.leave.enabled': false,
    'settings.leave.channelId': null,
    'settings.leave.messageType': 'text',
    'settings.leave.templateId': 'Leave Message',
    'settings.leave.autoDeleteEnabled': false,
    'settings.leave.autoDeleteAfterSeconds': 30,
    'settings.dm.enabled': false,
    'settings.dm.messageType': 'text',
    'settings.dm.templateId': 'DM Welcome',
    'settings.dm.fallbackIfDmClosed': false,
    'settings.dm.fallbackChannelId': null,
  },
  defaultMessages: {
    'Default Welcome': {
      type: 'text',
      content: 'Welcome [user] to [serverName]!',
    },
    'Leave Message': {
      type: 'text',
      content: '[userName] left [serverName].',
    },
    'DM Welcome': {
      type: 'text',
      content: 'Welcome to [serverName], [userName]!',
    },
  },
  tabs: [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Manage welcome, leave, DM welcome, templates, commands, and logs from one dashboard.',
      sections: [
        {
          id: 'overview.summary',
          title: 'Welcome automation',
          description: 'Configure how new members are greeted and how leave messages are handled.',
          fields: [],
          actions: [],
        },
      ],
    },
    {
      id: 'welcome',
      label: 'Welcome',
      sections: [
        {
          id: 'welcome.settings',
          title: 'Welcome messages',
          description: 'Configure the message sent when a member joins the server.',
          fields: [
            { id: 'welcome.enabled', type: 'switch', label: 'Enable welcome messages', description: 'Send a welcome message when a member joins.', storageKey: 'settings', path: 'welcome.enabled', defaultValue: false },
            { id: 'welcome.channel', type: 'channel_select', label: 'Welcome channel', storageKey: 'settings', path: 'welcome.channelId', defaultValue: null },
            { id: 'welcome.message-type', type: 'select', label: 'Message type', storageKey: 'settings', path: 'welcome.messageType', defaultValue: 'text', options: [{ label: 'Text', value: 'text' }, { label: 'Embed', value: 'embed' }, { label: 'Components V2', value: 'components_v2' }] },
            { id: 'welcome.template-select', type: 'template_select', label: 'Template', storageKey: 'settings', path: 'welcome.templateId', defaultValue: 'Default Welcome', templateType: 'welcome' },
            { id: 'welcome.mention', type: 'switch', label: 'Mention user', storageKey: 'settings', path: 'welcome.mentionUser', defaultValue: true },
            { id: 'welcome.delete-if-left', type: 'switch', label: 'Cancel if user leaves before send', storageKey: 'settings', path: 'welcome.deleteIfUserLeavesBeforeSend', defaultValue: true },
            { id: 'welcome.auto-delete', type: 'switch', label: 'Auto-delete message', storageKey: 'settings', path: 'welcome.autoDeleteEnabled', defaultValue: false },
            { id: 'welcome.auto-delete-after', type: 'number', label: 'Auto-delete after seconds', storageKey: 'settings', path: 'welcome.autoDeleteAfterSeconds', defaultValue: 30 },
            { id: 'welcome.composer', type: 'message_composer', label: 'Message composer', storageKey: 'templates', path: 'Default Welcome', templateType: 'welcome', contentModes: ['text', 'embed', 'components_v2'], placeholder: 'Welcome [user] to [serverName]!' },
          ],
          actions: [
            { id: 'welcome.save', type: 'save_storage', label: 'Save welcome settings', storageKeys: ['settings'] },
            { id: 'welcome.save-template', type: 'save_template', label: 'Save template', templateNamePath: 'welcome.templateId', templateContentPath: 'Default Welcome', templateType: 'welcome', templateContentModePath: 'welcome.messageType' },
            { id: 'welcome.test', type: 'test_template', label: 'Send test welcome message', templateNamePath: 'welcome.templateId', channelIdPath: 'welcome.channelId' },
          ],
        },
      ],
    },
    {
      id: 'leave',
      label: 'Leave',
      sections: [
        {
          id: 'leave.settings',
          title: 'Leave messages',
          description: 'Configure the message sent when a member leaves.',
          fields: [
            { id: 'leave.enabled', type: 'switch', label: 'Enable leave messages', storageKey: 'settings', path: 'leave.enabled', defaultValue: false },
            { id: 'leave.channel', type: 'channel_select', label: 'Leave channel', storageKey: 'settings', path: 'leave.channelId', defaultValue: null },
            { id: 'leave.message-type', type: 'select', label: 'Message type', storageKey: 'settings', path: 'leave.messageType', defaultValue: 'text', options: [{ label: 'Text', value: 'text' }, { label: 'Embed', value: 'embed' }, { label: 'Components V2', value: 'components_v2' }] },
            { id: 'leave.template-select', type: 'template_select', label: 'Template', storageKey: 'settings', path: 'leave.templateId', defaultValue: 'Leave Message', templateType: 'leave' },
            { id: 'leave.composer', type: 'message_composer', label: 'Message composer', storageKey: 'templates', path: 'Leave Message', templateType: 'leave', contentModes: ['text', 'embed', 'components_v2'], placeholder: '[userName] left [serverName].' },
          ],
          actions: [
            { id: 'leave.save', type: 'save_storage', label: 'Save leave settings', storageKeys: ['settings'] },
            { id: 'leave.save-template', type: 'save_template', label: 'Save template', templateNamePath: 'leave.templateId', templateContentPath: 'Leave Message', templateType: 'leave', templateContentModePath: 'leave.messageType' },
          ],
        },
      ],
    },
    {
      id: 'dm',
      label: 'DM',
      sections: [
        {
          id: 'dm.settings',
          title: 'DM Welcome',
          description: 'Configure private welcome messages sent to new members.',
          fields: [
            { id: 'dm.enabled', type: 'switch', label: 'Enable DM welcome', storageKey: 'settings', path: 'dm.enabled', defaultValue: false },
            { id: 'dm.message-type', type: 'select', label: 'Message type', storageKey: 'settings', path: 'dm.messageType', defaultValue: 'text', options: [{ label: 'Text', value: 'text' }, { label: 'Embed', value: 'embed' }, { label: 'Components V2', value: 'components_v2' }] },
            { id: 'dm.template-select', type: 'template_select', label: 'Template', storageKey: 'settings', path: 'dm.templateId', defaultValue: 'DM Welcome', templateType: 'dm_welcome' },
            { id: 'dm.fallback', type: 'switch', label: 'Fallback if DMs are closed', storageKey: 'settings', path: 'dm.fallbackIfDmClosed', defaultValue: false },
            { id: 'dm.fallback-channel', type: 'channel_select', label: 'Fallback channel', storageKey: 'settings', path: 'dm.fallbackChannelId', defaultValue: null },
            { id: 'dm.composer', type: 'message_composer', label: 'Message composer', storageKey: 'templates', path: 'DM Welcome', templateType: 'dm_welcome', contentModes: ['text', 'embed', 'components_v2'], placeholder: 'Welcome to [serverName], [userName]!' },
          ],
          actions: [
            { id: 'dm.save', type: 'save_storage', label: 'Save DM settings', storageKeys: ['settings'] },
            { id: 'dm.save-template', type: 'save_template', label: 'Save template', templateNamePath: 'dm.templateId', templateContentPath: 'DM Welcome', templateType: 'dm_welcome', templateContentModePath: 'dm.messageType' },
          ],
        },
      ],
    },
    {
      id: 'templates',
      label: 'Templates',
      sections: [
        {
          id: 'templates.manager',
          title: 'Templates',
          description: 'Create and update message templates used by this plugin.',
          fields: [],
          actions: [],
        },
      ],
    },
    {
      id: 'commands',
      label: 'Commands',
      sections: [
        {
          id: 'commands.manager',
          title: 'Commands',
          description: 'View and manage plugin commands.',
          fields: [],
          actions: [],
        },
      ],
    },
    {
      id: 'logs',
      label: 'Logs',
      sections: [
        {
          id: 'logs.manager',
          title: 'Welcome plugin logs',
          description: 'Runtime records and audits for this plugin.',
          fields: [],
          actions: [],
        },
      ],
    },
  ],
} satisfies PluginDashboardSchemaDocument;
