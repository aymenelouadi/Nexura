CREATE TABLE IF NOT EXISTS welcome_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id varchar(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  plugin_id varchar(64) NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  setting_group varchar(32) NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, plugin_id, setting_group)
);

CREATE TABLE IF NOT EXISTS welcome_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id varchar(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  plugin_id varchar(64) NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  core_template_id uuid REFERENCES plugin_templates(id) ON DELETE CASCADE,
  purpose varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, plugin_id, core_template_id)
);

CREATE TABLE IF NOT EXISTS welcome_invite_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id varchar(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  plugin_id varchar(64) NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  invite_code varchar(100) NOT NULL,
  inviter_id varchar(20),
  uses integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, plugin_id, invite_code)
);

CREATE TABLE IF NOT EXISTS welcome_invite_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id varchar(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  plugin_id varchar(64) NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  member_id varchar(20) NOT NULL,
  inviter_id varchar(20),
  invite_code varchar(100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS welcome_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id varchar(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  plugin_id varchar(64) NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  delivery_type varchar(32) NOT NULL,
  destination_id varchar(20),
  status varchar(32) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welcome_invite_events_scope_created_idx
  ON welcome_invite_events (guild_id, plugin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS welcome_delivery_logs_scope_created_idx
  ON welcome_delivery_logs (guild_id, plugin_id, created_at DESC);
