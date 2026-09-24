-- Existing naive values follow the application's UTC storage convention.
-- Interpret them explicitly, independently of the migration session timezone.
ALTER TABLE "ranked_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone
USING "timestamp" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "ranked_logs" ALTER COLUMN "timestamp" SET DEFAULT now();
