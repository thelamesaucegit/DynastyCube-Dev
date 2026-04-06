-- =================================================
-- ADD MESSAGE USER INFO VIEW
-- =================================================
-- Creates a view that includes user information with messages
-- This makes it easier to display sender/recipient names

-- Create view for messages with user info
CREATE OR REPLACE VIEW messages_with_user_info AS
SELECT
  m.id,
  m.from_user_id,
  m.to_user_id,
  m.subject,
  m.message,
  m.is_read,
  m.parent_message_id,
  m.created_at,

  -- From user info
  from_user.email as from_user_email,
  COALESCE(
    from_user_data.display_name,
    from_user_data.discord_username,
    from_user.email,
    'Unknown User'
  ) as from_user_name,

  -- To user info
  to_user.email as to_user_email,
  COALESCE(
    to_user_data.display_name,
    to_user_data.discord_username,
    to_user.email,
    'Unknown User'
  ) as to_user_name

FROM messages m
LEFT JOIN auth.users from_user ON m.from_user_id = from_user.id
LEFT JOIN public.users from_user_data ON m.from_user_id = from_user_data.id
LEFT JOIN auth.users to_user ON m.to_user_id = to_user.id
LEFT JOIN public.users to_user_data ON m.to_user_id = to_user_data.id;

-- Grant access to authenticated users
GRANT SELECT ON messages_with_user_info TO authenticated;

-- Add RLS to the view (inherits from messages table)
ALTER VIEW messages_with_user_info SET (security_invoker = true);

-- Comment
COMMENT ON VIEW messages_with_user_info IS 'Messages with sender and recipient user information for easy display';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully created messages_with_user_info view';
  RAISE NOTICE 'Messages will now display user names instead of IDs';
END $$;
