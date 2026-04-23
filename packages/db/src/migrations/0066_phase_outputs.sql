ALTER TABLE "issues" ADD COLUMN "phase_outputs" jsonb DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX "issues_phase_outputs_idx" ON "issues" USING gin ("phase_outputs");
