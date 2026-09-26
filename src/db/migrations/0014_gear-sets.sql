-- Phase 3 gear sets (battle-upgrade-plan.md §Trục C).
-- Gear pieces belong to a named set; equipping weapon + armor of the same
-- set grants its 2-piece bonus (see shared/config/gearSets.ts).
ALTER TABLE "weapon_roster" ADD COLUMN "set_key" text;--> statement-breakpoint
ALTER TABLE "armor_roster" ADD COLUMN "set_key" text;
