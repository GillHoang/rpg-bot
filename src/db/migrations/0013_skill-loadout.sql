-- Phase 2 skill loadout + Phase 3 branch prep (battle-upgrade-plan.md).
-- Skill: two equipped skill keys per character + battle order stance.
-- Branch: nullable branch key, validated in application (Lv.40+, per-class).
ALTER TABLE "user_character" ADD COLUMN "skill_slot_1" text;--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "skill_slot_2" text;--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "battle_order" text DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_character" ADD COLUMN "class_branch" text;--> statement-breakpoint
ALTER TABLE "user_character" ADD CONSTRAINT "character_valid_battle_order" CHECK ("battle_order" IN ('aggressive', 'balanced', 'defensive', 'counter'));
