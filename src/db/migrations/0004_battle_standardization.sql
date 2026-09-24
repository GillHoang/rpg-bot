CREATE TABLE "hunt_cooldowns" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"ready_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hunt_cooldowns" ADD CONSTRAINT "hunt_cooldowns_discord_id_users_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."users"("discord_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pvp_logs" ADD COLUMN "outcome" text DEFAULT 'draw' NOT NULL;
--> statement-breakpoint
UPDATE "pvp_logs"
SET "outcome" = CASE
	WHEN "winner_id" = "challenger_id" THEN 'win'
	ELSE 'loss'
END
WHERE "winner_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "pvp_logs" ALTER COLUMN "winner_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "duel_wins" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "duel_losses" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "highest_duel_streak" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "ranked_wins" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "ranked_losses" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "user_character" AS c
SET
	"duel_wins" = COALESCE((
		SELECT COUNT(*)
		FROM "pvp_logs" AS p
		WHERE p."winner_id" = c."discord_id"
	), 0),
	"duel_losses" = COALESCE((
		SELECT COUNT(*)
		FROM "pvp_logs" AS p
		WHERE p."winner_id" IS NOT NULL
		  AND p."winner_id" <> c."discord_id"
		  AND (p."challenger_id" = c."discord_id" OR p."opponent_id" = c."discord_id")
	), 0),
	"ranked_wins" = COALESCE((
		SELECT COUNT(*)
		FROM "ranked_logs" AS r
		WHERE r."player_id" = c."discord_id" AND r."result" = 'win'
	), 0),
	"ranked_losses" = COALESCE((
		SELECT COUNT(*)
		FROM "ranked_logs" AS r
		WHERE r."player_id" = c."discord_id" AND r."result" = 'loss'
	), 0);
--> statement-breakpoint
WITH expanded AS (
	SELECT
		p."id",
		p."challenger_id" AS "player_id",
		p."outcome" AS "result"
	FROM "pvp_logs" AS p
	UNION ALL
	SELECT
		p."id",
		p."opponent_id" AS "player_id",
		CASE p."outcome" WHEN 'draw' THEN 'draw' WHEN 'win' THEN 'loss' ELSE 'win' END AS "result"
	FROM "pvp_logs" AS p
), grouped AS (
	SELECT
		"player_id",
		"result",
		SUM(CASE WHEN "result" = 'win' THEN 0 ELSE 1 END)
			OVER (PARTITION BY "player_id" ORDER BY "id" ROWS UNBOUNDED PRECEDING) AS "run_id"
	FROM expanded
), runs AS (
	SELECT "player_id", "result", COUNT(*) AS "length"
	FROM grouped
	GROUP BY "player_id", "result", "run_id"
), highest AS (
	SELECT "player_id", MAX("length") AS "streak"
	FROM runs
	WHERE "result" = 'win'
	GROUP BY "player_id"
)
UPDATE "user_character" AS c
SET "highest_duel_streak" = COALESCE((
	SELECT h."streak" FROM highest AS h WHERE h."player_id" = c."discord_id"
), 0);
--> statement-breakpoint
WITH grouped AS (
	SELECT
		r."player_id",
		r."result",
		SUM(CASE WHEN r."result" = 'win' THEN 0 ELSE 1 END)
			OVER (PARTITION BY r."player_id" ORDER BY r."id" ROWS UNBOUNDED PRECEDING) AS "run_id"
	FROM "ranked_logs" AS r
), runs AS (
	SELECT "player_id", "result", COUNT(*) AS "length"
	FROM grouped
	GROUP BY "player_id", "result", "run_id"
), highest AS (
	SELECT "player_id", MAX("length") AS "streak"
	FROM runs
	WHERE "result" = 'win'
	GROUP BY "player_id"
)
UPDATE "user_character" AS c
SET "highest_rank_streak" = GREATEST(c."highest_rank_streak", COALESCE((
	SELECT h."streak" FROM highest AS h WHERE h."player_id" = c."discord_id"
), 0));
