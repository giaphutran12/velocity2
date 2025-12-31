-- Reset audio_storage_path to re-download with new naming format
-- Run once, then delete this migration file

UPDATE rc_recordings
SET audio_storage_path = NULL, download_error = NULL
WHERE audio_storage_path IS NOT NULL;
