-- Add audio storage support for RC recordings

-- Column to store the RC audio content URI (for downloading)
ALTER TABLE rc_recordings ADD COLUMN IF NOT EXISTS audio_content_uri TEXT;

-- Column to store Supabase Storage path after upload
ALTER TABLE rc_recordings ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;

-- Create storage bucket for RC audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('rc-audio', 'rc-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can read audio files
CREATE POLICY "authenticated_read_rc_audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'rc-audio');

-- Policy: service role can upload audio files
CREATE POLICY "service_upload_rc_audio"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'rc-audio');
