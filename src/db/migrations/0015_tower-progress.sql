-- Phase 4 Tower mode (battle-upgrade-plan.md §Trục D).
-- Weekly best floor on user_character; tower_week is the ISO week key
-- (see ranked weekWindowAt) so the climb resets without a cron job.
ALTER TABLE "user_character" ADD COLUMN "tower_floor" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "tower_week" text;
