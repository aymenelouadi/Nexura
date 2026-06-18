import type { PluginStorage } from '@nexura/shared';

import {
  defaultDmWelcomeSettings,
  defaultLeaveSettings,
  defaultWelcomeSettings,
  dmWelcomeSettingsSchema,
  leaveSettingsSchema,
  welcomeSettingsSchema,
  type DmWelcomeSettings,
  type LeaveSettings,
  type WelcomeSettings,
} from '../schemas/settings.js';

const keys = {
  welcome: 'settings/welcome',
  leave: 'settings/leave',
  dm: 'settings/dm',
} as const;

export class WelcomeSettingsService {
  constructor(private readonly storage: PluginStorage) {}

  async getWelcome(): Promise<WelcomeSettings> {
    return welcomeSettingsSchema.parse(
      (await this.storage.get(keys.welcome)) ?? defaultWelcomeSettings,
    );
  }

  async saveWelcome(settings: WelcomeSettings): Promise<WelcomeSettings> {
    const parsed = welcomeSettingsSchema.parse(settings);
    await this.storage.set(keys.welcome, parsed);
    return parsed;
  }

  async getLeave(): Promise<LeaveSettings> {
    return leaveSettingsSchema.parse((await this.storage.get(keys.leave)) ?? defaultLeaveSettings);
  }

  async saveLeave(settings: LeaveSettings): Promise<LeaveSettings> {
    const parsed = leaveSettingsSchema.parse(settings);
    await this.storage.set(keys.leave, parsed);
    return parsed;
  }

  async getDm(): Promise<DmWelcomeSettings> {
    return dmWelcomeSettingsSchema.parse(
      (await this.storage.get(keys.dm)) ?? defaultDmWelcomeSettings,
    );
  }

  async saveDm(settings: DmWelcomeSettings): Promise<DmWelcomeSettings> {
    const parsed = dmWelcomeSettingsSchema.parse(settings);
    await this.storage.set(keys.dm, parsed);
    return parsed;
  }
}
