ALTER TABLE "user_character" DROP CONSTRAINT "character_valid_level";
--> statement-breakpoint
ALTER TABLE "user_character" ADD CONSTRAINT "character_valid_level" CHECK ("user_character"."combat_level" BETWEEN 1 AND 100);
--> statement-breakpoint
ALTER TABLE "user_character" ALTER COLUMN "lifetime_exp" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "user_character" ALTER COLUMN "combat_exp" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "raid_logs" ALTER COLUMN "updated_exp" TYPE bigint;
