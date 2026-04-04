# Display Name System - Implementation Guide

## Overview

This document describes the display name system for the Dynasty Cube application, which allows users to have a customizable display name that appears throughout the application (messages, teams, etc.), separate from their OAuth provider names.

## Database Schema

### public.users table fields:
- **`discord_id`**: Provider's user ID (Discord ID for Discord users, Google ID for Google users)
- **`discord_username`**: Discord username (only populated for Discord OAuth users)
- **`display_name`**: User's chosen display name (editable by user)
- **`avatar_url`**: User's avatar URL
- **`email`**: User's email address

### Display Name Priority

When displaying a user's name in the UI, the system uses the following fallback priority:

1. **`display_name`** - User's custom display name (if set)
2. **`discord_username`** - Discord username (for Discord users only)
3. **`email`** - User's email address
4. **`'Unknown User'`** - Fallback if nothing else is available

## OAuth Provider Metadata Mapping

### Discord OAuth
When a user signs in with Discord, the following metadata is mapped:
- `raw_user_meta_data.provider_id` → `discord_id`
- `raw_user_meta_data.full_name` → `discord_username` AND `display_name` (initially)
- `raw_user_meta_data.avatar_url` → `avatar_url`

### Google OAuth
When a user signs in with Google, the following metadata is mapped:
- `raw_user_meta_data.provider_id` → `discord_id` (stores Google user ID)
- `discord_username` → NULL (not applicable for Google users)
- `raw_user_meta_data.full_name` → `display_name` (initially)
- `raw_user_meta_data.picture` → `avatar_url`

## Migration Steps

To fix existing data and implement the display name system:

1. **Run the migration script**:
   ```bash
   # Connect to your Supabase database and run:
   psql [your-connection-string] -f database/fix-display-names.sql
   ```

2. **Verify the migration**:
   ```sql
   -- Check that all users have display names
   SELECT id, email, display_name, discord_username
   FROM public.users
   WHERE display_name IS NULL;
   ```

3. **Test the messages view**:
   ```sql
   -- Test that the view works correctly
   SELECT * FROM messages_with_user_info LIMIT 5;
   ```

## Frontend Implementation

### Current User Profile Display
The account page (`src/app/account/page.tsx`) shows:
- OAuth provider metadata (from `auth.users.raw_user_meta_data`)
- This is fine for the user's own profile view

### Display Name for Other Users
When displaying user names to other users (in messages, teams, etc.), the system should query:
- `public.users.display_name` (not auth metadata)
- This is already implemented in the `messages_with_user_info` view

### Adding Display Name Editor (TODO)
You should create a component that allows users to edit their display name:

1. Create `src/app/components/DisplayNameEditor.tsx`
2. Add it to the account page
3. Allow users to update their `public.users.display_name` field

Example implementation:
```typescript
const updateDisplayName = async (newName: string) => {
  const { error } = await supabase
    .from('users')
    .update({ display_name: newName })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to update display name:', error);
  }
};
```

## Database Files Changed

### Modified Files:
1. **`database/users-schema.sql`**
   - Updated `handle_new_user()` trigger to properly map OAuth metadata
   - Fixed backfill query to use correct field mappings

2. **`database/add-message-user-info-view.sql`**
   - Changed `full_name` → `display_name` in COALESCE
   - Changed `username` → `discord_username` in COALESCE

### New Files:
1. **`database/fix-display-names.sql`**
   - Migration script to fix existing data
   - Updates all existing users with proper display names
   - Recreates the messages view with correct columns
   - Updates the trigger function

## Testing Checklist

- [ ] Run migration script on your database
- [ ] Test Discord OAuth login (new user)
- [ ] Test Google OAuth login (new user)
- [ ] Verify display names are populated correctly
- [ ] Test messages view (no more "column does not exist" errors)
- [ ] Add display name editor component to account page
- [ ] Test display name updates from frontend
- [ ] Verify display names show correctly throughout the app

## Notes

- The `discord_id` field name is misleading for Google users - consider renaming to `provider_user_id` in a future update
- The display name system is now OAuth provider-agnostic
- Users can customize their display name regardless of their auth provider
- The system maintains Discord username separately for Discord-specific features

## Related Files

- Database: `database/users-schema.sql`, `database/add-message-user-info-view.sql`, `database/fix-display-names.sql`
- Frontend: `src/app/account/page.tsx`, `src/app/components/AccountLinking.tsx`
- Types: Consider adding a User type in `src/types/` for type safety
