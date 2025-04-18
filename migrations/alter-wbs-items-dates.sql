-- Alter the wbs_items table to make date fields nullable
ALTER TABLE wbs_items ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE wbs_items ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE wbs_items ALTER COLUMN duration DROP NOT NULL;

-- Comment explaining the change
COMMENT ON COLUMN wbs_items.start_date IS 'Start date (nullable, only required for Activity type)';
COMMENT ON COLUMN wbs_items.end_date IS 'End date (nullable, only required for Activity type)';
COMMENT ON COLUMN wbs_items.duration IS 'Duration in days (nullable, only required for Activity type)'; 