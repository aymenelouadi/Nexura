import type {
  CommandCustomization,
  CommandRegistration,
  PluginCommands,
  PluginComponents,
  PluginContext,
  PluginEmbeds,
  PluginEvents,
  PluginLogger,
  PluginMessages,
  PluginModule,
  PluginPermissions,
  PluginScope,
  PluginStorage,
  PluginDatabase,
  PluginTemplates,
  PluginVariables,
  CommandRegistrationWriter,
} from '../plugin-contracts.js';
import type { CommandRegistry } from './command-registry.js';
import type { EventRegistry } from './event-registry.js';
import { ScopedPluginScheduler } from './scheduler.js';

export class PluginRegistry {
  private readonly modules = new Map<string, PluginModule>();

  register(pluginId: string, module: PluginModule): void {
    if (this.modules.has(pluginId)) {
      throw new Error(`Plugin module ${pluginId} is already registered.`);
    }
    this.modules.set(pluginId, module);
  }

  get(pluginId: string): PluginModule | null {
    return this.modules.get(pluginId) ?? null;
  }
}

export interface PluginContextDependencies {
  logger: PluginLogger;
  permissions: PluginPermissions;
  variables: PluginVariables;
  templates: PluginTemplates;
  messages: PluginMessages;
  embeds: PluginEmbeds;
  components: PluginComponents;
  storage: PluginStorage;
  database: PluginDatabase;
  createInvite?: PluginCommands['createInvite'];
  getGuildInvites?: PluginEvents['getGuildInvites'];
  commandWriter?: CommandRegistrationWriter;
}

export class PluginRuntime {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly commands: CommandRegistry,
    private readonly events: EventRegistry,
  ) {}

  createContext(scope: PluginScope, dependencies: PluginContextDependencies): PluginContext {
    const commandApi: PluginCommands = {
      register: async (
        registration: CommandRegistration,
        customization?: CommandCustomization,
      ) => {
        const persisted = await dependencies.commandWriter?.register(scope, registration);
        this.commands.register(
          scope,
          registration,
          dependencies.permissions,
          dependencies.logger,
          { ...customization, ...persisted },
        );
      },
      createInvite:
        dependencies.createInvite ??
        (() => Promise.reject(new Error('Invite creation adapter is not configured.'))),
    };
    const eventApi: PluginEvents = {
      on: (event, handler) => this.events.on(scope, event, handler, dependencies.logger),
      getGuildInvites:
        dependencies.getGuildInvites ??
        (() => Promise.reject(new Error('Invite adapter is not configured.'))),
    };
    return {
      ...scope,
      ...dependencies,
      commands: commandApi,
      events: eventApi,
      scheduler: new ScopedPluginScheduler(dependencies.logger),
    };
  }

  async runLifecycle(
    scope: PluginScope,
    lifecycle: keyof PluginModule,
    context: PluginContext,
  ): Promise<void> {
    const module = this.registry.get(scope.pluginId);
    const handler = module?.[lifecycle];
    if (!handler) {
      return;
    }
    try {
      await handler(context);
    } catch (error) {
      await context.logger.error(`Plugin lifecycle ${lifecycle} failed.`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
