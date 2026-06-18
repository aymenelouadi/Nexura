import { coreMessageSchema, discordSnowflakeSchema, visualEditorLayoutSchema } from '@nexura/types';
import { z } from 'zod';

export const welcomeMessageTypeSchema = z.enum([
  'text',
  'embed',
  'components_v2',
  'visual_card',
]);

const autoDeleteSchema = z
  .object({
    autoDeleteEnabled: z.boolean().default(false),
    autoDeleteAfterSeconds: z.number().int().min(1).max(86_400).default(30),
  })
  .strict();

export const welcomeSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: discordSnowflakeSchema.nullable().default(null),
    messageType: welcomeMessageTypeSchema.default('text'),
    templateId: z.string().min(1).max(100).default('Default Welcome'),
    mentionUser: z.boolean().default(true),
    deleteIfUserLeavesBeforeSend: z.boolean().default(true),
  })
  .extend(autoDeleteSchema.shape)
  .strict();

export const leaveSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: discordSnowflakeSchema.nullable().default(null),
    messageType: welcomeMessageTypeSchema.default('text'),
    templateId: z.string().min(1).max(100).default('Leave Message'),
  })
  .extend(autoDeleteSchema.shape)
  .strict();

export const dmWelcomeSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    messageType: z.enum(['text', 'embed', 'components_v2']).default('text'),
    templateId: z.string().min(1).max(100).default('DM Welcome'),
    fallbackIfDmClosed: z.boolean().default(false),
    fallbackChannelId: discordSnowflakeSchema.nullable().default(null),
  })
  .strict();

export const welcomeSettingsBundleSchema = z
  .object({
    welcome: welcomeSettingsSchema,
    leave: leaveSettingsSchema,
    dm: dmWelcomeSettingsSchema,
  })
  .strict();

export const welcomeTemplateContentSchema = z.union([
  coreMessageSchema,
  visualEditorLayoutSchema,
]);

export type WelcomeSettings = z.infer<typeof welcomeSettingsSchema>;
export type LeaveSettings = z.infer<typeof leaveSettingsSchema>;
export type DmWelcomeSettings = z.infer<typeof dmWelcomeSettingsSchema>;
export type WelcomeSettingsBundle = z.infer<typeof welcomeSettingsBundleSchema>;
export type WelcomeMessageType = z.infer<typeof welcomeMessageTypeSchema>;

export const defaultWelcomeSettings: WelcomeSettings = welcomeSettingsSchema.parse({});
export const defaultLeaveSettings: LeaveSettings = leaveSettingsSchema.parse({});
export const defaultDmWelcomeSettings: DmWelcomeSettings = dmWelcomeSettingsSchema.parse({});
