-- Existing naive values follow the application's UTC storage convention.
-- Interpret them explicitly, independently of the migration session timezone (same as 0007).
ALTER TABLE "active_duel_participants" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "active_duels" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "active_duels" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "active_duels" ALTER COLUMN "accepted_at" SET DATA TYPE timestamp with time zone USING "accepted_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "active_duels" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "active_ranked_fights" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone USING "started_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "active_ranked_fights" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "active_ranked_fights" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pvp_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone USING "timestamp" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pvp_logs" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "wager_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone USING "timestamp" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "wager_logs" ALTER COLUMN "timestamp" SET DEFAULT now();
