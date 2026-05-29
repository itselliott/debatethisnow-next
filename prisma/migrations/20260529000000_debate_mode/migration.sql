-- Casual / competitive ruleset switch per debate. Default keeps
-- every existing debate on the old competitive rules.
ALTER TABLE "debates"
ADD COLUMN "mode" VARCHAR(16) NOT NULL DEFAULT 'competitive';
