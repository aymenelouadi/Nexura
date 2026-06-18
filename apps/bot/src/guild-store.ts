import { guildMembers, guilds, users, type Database } from '@nexura/database';
import type { Guild } from 'discord.js';
import { eq } from 'drizzle-orm';

export class GuildStore {
  constructor(private readonly database: Database) {}

  async markPresent(guild: Guild): Promise<void> {
    await this.database
      .insert(guilds)
      .values({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
        botPresent: true,
      })
      .onConflictDoUpdate({
        target: guilds.id,
        set: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
          botPresent: true,
          updatedAt: new Date(),
        },
      });

    await this.synchronizeKnownOwner(guild);
  }

  async markAbsent(guildId: string): Promise<void> {
    await this.database
      .update(guilds)
      .set({ botPresent: false, updatedAt: new Date() })
      .where(eq(guilds.id, guildId));
  }

  private async synchronizeKnownOwner(guild: Guild): Promise<void> {
    const [owner] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.discordId, guild.ownerId))
      .limit(1);

    if (!owner) {
      return;
    }

    await this.database
      .insert(guildMembers)
      .values({ guildId: guild.id, userId: owner.id, role: 'OWNER' })
      .onConflictDoUpdate({
        target: [guildMembers.guildId, guildMembers.userId],
        set: { role: 'OWNER', updatedAt: new Date() },
      });
  }
}
