ALTER TABLE "user_character" ADD COLUMN "portal_gates_cleared" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_character" ADD CONSTRAINT "portal_gates_cleared_nonnegative" CHECK ("portal_gates_cleared" >= 0);
