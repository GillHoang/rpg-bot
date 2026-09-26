-- Phase 5 World Boss (battle-upgrade-plan.md §Trục E).
-- Per-day attack budget per player per spawn; reset against last_daily_reset.
ALTER TABLE "boss_attack_log" ADD COLUMN "daily_attacks" integer NOT NULL DEFAULT 0;
