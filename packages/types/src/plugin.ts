import { z } from 'zod';

export const semanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
export const pluginIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
export const pluginPermissionSchema = z.string().regex(/^[a-z][a-z0-9._:-]{1,127}$/);

export const pluginCapabilitiesSchema = z
  .object({
    commands: z.boolean(),
    events: z.boolean(),
    dashboard: z.boolean(),
    database: z.boolean(),
    templates: z.boolean().default(false),
    visualEditor: z.boolean().default(false),
    logs: z.boolean().default(false),
  })
  .strict();

const pluginDashboardShape = z
  .object({
    enabled: z.boolean(),
    route: z.string().min(1).max(255),
    label: z.string().min(1).max(100),
    icon: z.string().min(1).max(100),
    tabs: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)).max(20).default([]),
  })
  .strict();

export const pluginDashboardSchema = pluginDashboardShape.optional();

export const pluginManifestSchema = z
  .object({
    id: pluginIdSchema,
    name: z.string().min(1).max(100),
    version: semanticVersionSchema,
    description: z.string().min(1).max(500),
    author: z.string().min(1).max(100),
    minCoreVersion: semanticVersionSchema,
    entry: z.string().min(1).max(255),
    permissions: z.array(pluginPermissionSchema).max(100),
    capabilities: pluginCapabilitiesSchema,
    dashboard: pluginDashboardSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    if (new Set(manifest.permissions).size !== manifest.permissions.length) {
      context.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Plugin permissions must be unique.',
      });
    }
  });

export const pluginStatusSchema = z.enum(['INSTALLED', 'ERROR']);
export const guildPluginStatusSchema = z.enum(['ENABLED', 'DISABLED']);
export const pluginLogLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'AUDIT']);

export const guildPluginSchema = z.object({
  id: pluginIdSchema,
  name: z.string(),
  version: semanticVersionSchema,
  description: z.string(),
  author: z.string(),
  status: pluginStatusSchema,
  enabled: z.boolean(),
  guildStatus: guildPluginStatusSchema,
  installedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  dashboard: pluginDashboardShape.nullable(),
});

export const guildPluginListResponseSchema = z.object({
  data: z.array(guildPluginSchema),
});

export const pluginLogSchema = z.object({
  id: z.uuid(),
  guildId: z.string().regex(/^\d{17,20}$/),
  pluginId: pluginIdSchema,
  level: pluginLogLevelSchema,
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  destination: z.enum(['DASHBOARD', 'DISCORD', 'BOTH', 'DISABLED']),
  createdAt: z.iso.datetime(),
});

export const pluginLogListResponseSchema = z.object({
  data: z.array(pluginLogSchema),
});

export type PluginCapabilities = z.infer<typeof pluginCapabilitiesSchema>;
export type PluginDashboard = z.infer<typeof pluginDashboardShape>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginStatus = z.infer<typeof pluginStatusSchema>;
export type GuildPluginStatus = z.infer<typeof guildPluginStatusSchema>;
export type PluginLogLevel = z.infer<typeof pluginLogLevelSchema>;
export type GuildPlugin = z.infer<typeof guildPluginSchema>;
export type GuildPluginListResponse = z.infer<typeof guildPluginListResponseSchema>;
export type PluginLog = z.infer<typeof pluginLogSchema>;
export type PluginLogListResponse = z.infer<typeof pluginLogListResponseSchema>;
