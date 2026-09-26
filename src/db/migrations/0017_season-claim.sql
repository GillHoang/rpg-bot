-- Phase 5 season payout (battle-upgrade-plan.md §Trục E).
-- Tracks which closed season the player already claimed (lazy claim, no cron).
ALTER TABLE "user_character" ADD COLUMN "last_season_claim_id" integer;
