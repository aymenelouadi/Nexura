ALTER TYPE "public"."plugin_status" ADD VALUE 'BROKEN';--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" varchar(64) NOT NULL,
	"guild_id" varchar(20),
	"plugin_id" varchar(64),
	"action" varchar(64) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" varchar(128),
	"type" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugin_commands" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plugins" ADD COLUMN "broken_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_actor_created_index" ON "activity_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_action_index" ON "activity_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_events_resource_type_index" ON "activity_events" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "activity_events_guild_id_index" ON "activity_events" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "activity_events_plugin_id_index" ON "activity_events" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "activity_events_created_at_index" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_settings_id_index" ON "app_settings" USING btree ("id");