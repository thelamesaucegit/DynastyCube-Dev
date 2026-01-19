# Team Pages & Draft Management Guide

This guide explains the new team pages system with draft picks and deck building functionality.

## What's New

### 1. Individual Team Pages
Each team now has its own dedicated page accessible at `/teams/[teamId]`:
- `/teams/shards` - Alara Shards
- `/teams/ninja` - Kamigawa Ninja
- `/teams/creeps` - Innistrad Creeps
- `/teams/demigods` - Theros Demigods
- `/teams/guildpact` - Ravnica Guildpact
- `/teams/changelings` - Lorwyn Changelings
- `/teams/hedrons` - Zendikar Hedrons
- `/teams/dragons` - Tarkir Dragons

### 2. Three Main Sections Per Team

Each team page has 3 tabs:

#### 🎴 Draft Picks
- Shows all cards the team has drafted from the card pool
- Displays card images, names, and sets
- Grid layout for easy viewing
- Currently empty until you add cards

#### 📚 Decks
- Shows all decks the team has created
- Each deck has a name, description, and format (Standard, Commander, etc.)
- Can be marked as public or private
- Currently empty until decks are created

#### 👥 Members
- Lists all team members
- Shows when they joined
- Pulled from the `team_members` table

## Database Setup

### Step 1: Run the Draft Schema

Run `database/draft-schema.sql` in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy contents of `database/draft-schema.sql`
4. Click "Run"

This creates 3 new tables:
- `team_draft_picks` - Cards owned by each team
- `team_decks` - Deck metadata
- `deck_cards` - Which cards are in which decks

### Step 2: (Optional) Disable RLS for Testing

If you want to test quickly, temporarily disable RLS:

```sql
ALTER TABLE team_draft_picks DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards DISABLE ROW LEVEL SECURITY;
```

## Features Implemented

### ✅ Server Actions
- `getTeamDraftPicks(teamId)` - Get all cards for a team
- `addDraftPick(pick)` - Add a card to team's collection
- `removeDraftPick(pickId)` - Remove a card
- `getTeamDecks(teamId)` - Get all decks for a team
- `createDeck(deck)` - Create a new deck
- `deleteDeck(deckId)` - Delete a deck
- `getDeckCards(deckId)` - Get cards in a deck
- `addCardToDeck(card)` - Add card to deck
- `removeCardFromDeck(cardId)` - Remove card from deck

### ✅ Navigation
- **Teams Page** (`/teams`): Click any team card to view their page
- **Account Page** (`/account`): Click your team to view your team's page

### ✅ Dynamic Routing
- Uses Next.js 15 dynamic routes: `/teams/[teamId]`
- Loads team data, draft picks, and decks automatically

## What's Coming Next (Future Features)

### Draft Pool Integration
Currently, teams need cards manually added. You could:
1. Add a "Draft from Pool" button on team pages
2. Let teams select cards from the global `card_pools` table
3. Track pick order and draft history

### Deck Builder UI
A full deck builder interface with:
- Drag-and-drop card management
- Mainboard / Sideboard / Maybeboard sections
- Card filtering and sorting
- Mana curve visualization
- Deck export formats

### Advanced Features
- **Draft Events**: Create timed draft sessions
- **Deck Statistics**: Show mana curve, color distribution
- **Deck Sharing**: Public deck lists other teams can view
- **Card Trading**: Allow teams to trade cards
- **Commander Support**: Special handling for Commander format

## How to Test

### 1. View Team Pages
1. Go to http://localhost:3000/teams
2. Click any team (e.g., "Kamigawa Ninja")
3. You'll see the team page with 3 tabs

### 2. Check Your Team
1. Join a team from `/account` if you haven't
2. Your team will be clickable
3. Click "View Team Page" to see your team's page

### 3. Add Test Data (Optional)

To see how it looks with data, you can manually add test picks in Supabase:

```sql
-- Add a test card to Kamigawa Ninja
INSERT INTO team_draft_picks (team_id, card_id, card_name, card_set, image_url)
VALUES (
  'ninja',
  'test-id-1',
  'Lightning Bolt',
  'Alpha',
  'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg'
);

-- Create a test deck
INSERT INTO team_decks (team_id, deck_name, description, format)
VALUES (
  'ninja',
  'Aggro Red',
  'Fast red deck with lots of burn spells',
  'standard'
);
```

## Files Created

### Database
- `database/draft-schema.sql` - Complete schema for draft/deck system

### Server Actions
- `src/app/actions/draftActions.ts` - All draft and deck server actions

### Pages
- `src/app/teams/[teamId]/page.tsx` - Dynamic team page with tabs

### Updates
- `src/app/account/page.tsx` - Added clickable link to team page
- Team navigation already existed at `/teams`

## API Reference

All server actions are in `src/app/actions/draftActions.ts`:

```typescript
// Draft Picks
await getTeamDraftPicks(teamId);
await addDraftPick({ team_id, card_id, card_name, ... });
await removeDraftPick(pickId);

// Decks
await getTeamDecks(teamId);
await createDeck({ team_id, deck_name, description, format });
await deleteDeck(deckId);

// Deck Cards
await getDeckCards(deckId);
await addCardToDeck({ deck_id, card_id, card_name, quantity });
await removeCardFromDeck(cardId);
```

## Next Steps

1. **Run the schema** to create the database tables
2. **Test navigation** by visiting `/teams` and clicking a team
3. **Add some test data** to see how it looks with cards
4. **Build out draft functionality** to let teams pick cards from the pool
5. **Create deck builder UI** for managing deck contents

---

**Ready to draft!** The foundation is in place for a full draft and deck management system. 🎴📚
