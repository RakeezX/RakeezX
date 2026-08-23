-- Add 'remote' to calendar_days kind

ALTER TABLE rakeezx.calendar_days DROP CONSTRAINT IF EXISTS calendar_days_kind_check;
ALTER TABLE rakeezx.calendar_days ADD CONSTRAINT calendar_days_kind_check CHECK (kind IN ('study', 'holiday', 'national', 'founding', 'exam', 'event', 'remote'));
