-- =================================
-- DYNASTY CUBE MESSAGING & REPORTS SYSTEM
-- =================================
-- Features:
-- - Direct user-to-user messaging
-- - Report system for bad actors, bugs, and issues
-- - Admin notification system for reports
-- =================================

-- =================================
-- 1. MESSAGES TABLE
-- Direct messages between users
-- =================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  parent_message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

CREATE INDEX IF NOT EXISTS messages_from_user_idx ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS messages_to_user_idx ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS messages_read_idx ON messages(is_read);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_parent_idx ON messages(parent_message_id);

COMMENT ON TABLE messages IS 'Direct messages between users';
COMMENT ON COLUMN messages.parent_message_id IS 'For threaded conversations/replies';

-- =================================
-- 2. REPORTS TABLE
-- User-submitted reports for bad actors, bugs, and issues
-- =================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  report_type text NOT NULL CHECK (report_type IN ('bad_actor', 'bug', 'issue', 'other')),

  -- For bad actor reports
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Report details
  title text NOT NULL,
  description text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Status tracking
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'dismissed')),
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,

  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_type_idx ON reports(report_type);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_severity_idx ON reports(severity);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);

COMMENT ON TABLE reports IS 'User-submitted reports for bad actors, bugs, and issues';
COMMENT ON COLUMN reports.report_type IS 'bad_actor, bug, issue, or other';
COMMENT ON COLUMN reports.severity IS 'low, medium, high, or critical';
COMMENT ON COLUMN reports.status IS 'pending, in_review, resolved, or dismissed';

-- =================================
-- 3. REPORT ATTACHMENTS TABLE
-- Optional screenshots/files for reports
-- =================================
CREATE TABLE IF NOT EXISTS report_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id uuid REFERENCES reports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_attachments_report_idx ON report_attachments(report_id);

COMMENT ON TABLE report_attachments IS 'File attachments for reports (screenshots, logs, etc.)';

-- =================================
-- 4. HELPER FUNCTIONS
-- =================================

-- Function to notify admins of new reports
CREATE OR REPLACE FUNCTION notify_admins_of_report(
  p_report_id uuid,
  p_report_type text,
  p_title text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_message text;
BEGIN
  -- Build notification message
  v_message := 'New ' || p_report_type || ' report: ' || p_title;

  -- Notify all admin users (from public.users table)
  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  SELECT
    id,
    'report_submitted',
    NULL, -- No trade_id for reports
    v_message
  FROM public.users
  WHERE is_admin = true
  LIMIT 10; -- Limit to prevent spam if many admins

END;
$$;

-- Function to send a message to a user
CREATE OR REPLACE FUNCTION send_message(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_subject text,
  p_message text,
  p_parent_message_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  -- Insert message
  INSERT INTO messages (from_user_id, to_user_id, subject, message, parent_message_id)
  VALUES (p_from_user_id, p_to_user_id, p_subject, p_message, p_parent_message_id)
  RETURNING id INTO v_message_id;

  -- Create notification for recipient
  INSERT INTO notifications (user_id, notification_type, trade_id, message)
  VALUES (
    p_to_user_id,
    'new_message',
    NULL,
    'New message from user: ' || p_subject
  );

  RETURN v_message_id;
END;
$$;

-- Update function to mark report as updated
CREATE OR REPLACE FUNCTION update_report_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();

  -- If status changed to resolved, set resolved_at
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_update_timestamp ON reports;
CREATE TRIGGER reports_update_timestamp
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_report_timestamp();

-- =================================
-- 5. ROW LEVEL SECURITY
-- =================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;

-- Messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark their received messages as read" ON messages;
CREATE POLICY "Users can mark their received messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());

-- Reports policies
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING (
    -- Check if user is admin in public.users table
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update reports" ON reports;
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Report attachments policies
DROP POLICY IF EXISTS "Users can view attachments for their reports" ON report_attachments;
CREATE POLICY "Users can view attachments for their reports"
  ON report_attachments FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM reports
      WHERE reporter_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all attachments" ON report_attachments;
CREATE POLICY "Admins can view all attachments"
  ON report_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can add attachments to their reports" ON report_attachments;
CREATE POLICY "Users can add attachments to their reports"
  ON report_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT id FROM reports
      WHERE reporter_user_id = auth.uid()
    )
  );

-- =================================
-- 6. VIEWS FOR EASY QUERYING
-- =================================

-- View for message counts per user
CREATE OR REPLACE VIEW message_counts_view AS
SELECT
  to_user_id as user_id,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count,
  COUNT(*) as total_count
FROM messages
GROUP BY to_user_id;

COMMENT ON VIEW message_counts_view IS 'Message counts per user (unread and total)';

-- View for pending reports
CREATE OR REPLACE VIEW pending_reports_view AS
SELECT
  r.id,
  r.report_type,
  r.title,
  r.severity,
  r.status,
  r.created_at,
  r.reporter_user_id,
  ru.email as reporter_email,
  r.reported_user_id,
  rpu.email as reported_user_email
FROM reports r
LEFT JOIN auth.users ru ON r.reporter_user_id = ru.id
LEFT JOIN auth.users rpu ON r.reported_user_id = rpu.id
WHERE r.status IN ('pending', 'in_review')
ORDER BY
  CASE r.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  r.created_at DESC;

COMMENT ON VIEW pending_reports_view IS 'Active reports sorted by severity and date';

-- Initialize notifications type for messages and reports
-- Add to existing notification_type enum if it exists
DO $$
BEGIN
  -- Note: You may need to add these types to your notifications table
  -- ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
  -- ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'report_submitted';

  -- For now, we'll rely on the text field in notifications table
  NULL;
END $$;
