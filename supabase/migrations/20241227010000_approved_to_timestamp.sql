-- Change approved column from BOOLEAN to TIMESTAMPTZ
-- This stores the actual approval date rather than just true/false

ALTER TABLE vl_mortgage_requests
  ALTER COLUMN approved TYPE TIMESTAMPTZ
  USING CASE
    WHEN approved = TRUE THEN NOW()  -- Convert existing TRUE to current time
    ELSE NULL
  END;

COMMENT ON COLUMN vl_mortgage_requests.approved IS 'Timestamp when the mortgage request was approved';
