# Deck Builder Guide

The Deck Builder allows you to create and manage decks from your team's drafted cards.

## 🎯 Overview

The Deck Builder provides a complete deck construction interface with:
- Multiple deck management
- Mainboard / Sideboard / Maybeboard organization
- One-click card addition
- Real-time deck statistics
- Easy card removal

## 🚀 Getting Started

### Step 1: Navigate to Deck Builder
1. Go to your team page: `/teams/[your-team-id]`
2. Click the "📚 Decks" tab
3. The Deck Builder interface will load

### Step 2: Create Your First Deck
1. Click the "+ New Deck" button (top right)
2. Fill in the deck details:
   - **Deck Name** (required): e.g., "Red Aggro"
   - **Description** (optional): Describe your strategy
   - **Format**: Choose from Standard, Modern, Commander, etc.
3. Click "Create Deck"
4. Your new deck will appear in the deck list

### Step 3: Select Your Deck
Click on any deck card to select it and start building

## 📦 Interface Layout

The Deck Builder has a **split-screen design**:

### Left Side: Available Cards
- Shows all your team's drafted cards
- Only displays cards **not yet in the current section**
- Each card shows:
  - Card image (thumbnail)
  - Card name
  - Card type
- Click any card to add it to your deck

### Right Side: Deck Contents
- Shows your deck's current contents
- Three sections (tabs):
  - **Mainboard**: Your main 60+ cards
  - **Sideboard**: Up to 15 extra cards
  - **Maybeboard**: Cards you're considering
- Click "Remove" to take cards out

## 🃏 Building Your Deck

### Adding Cards

**Method 1: Click to Add**
1. Make sure you're on the right tab (Mainboard/Sideboard/Maybeboard)
2. Find the card in the "Available Cards" list (left side)
3. Click the card once
4. It instantly moves to the selected section

**Smart Features:**
- Cards already in the current section won't appear in Available Cards
- You'll see a success message when a card is added
- The card count updates automatically

### Removing Cards

1. Go to the tab where the card is (Mainboard/Sideboard/Maybeboard)
2. Find the card in the list
3. Click the "Remove" button
4. The card returns to Available Cards

### Organizing Your Deck

**Mainboard**
- Your primary deck (usually 60 cards minimum)
- The cards you'll start every game with
- Build your core strategy here

**Sideboard**
- Up to 15 additional cards
- Swap these in between games
- Use for specific matchups

**Maybeboard**
- Unlimited cards
- Testing ground for potential additions
- Keep alternatives here

## 📊 Deck Statistics

At the bottom of the deck view, you'll see:

```
Mainboard: 42  |  Sideboard: 8  |  Maybeboard: 5
```

These numbers show the total count of cards in each section (accounting for quantity).

## 🔧 Deck Management

### Viewing All Your Decks
- All your decks appear in a grid at the top
- Shows deck name, format, and description
- Click any deck to load it
- Selected deck has blue border and background

### Deleting a Deck
1. Select the deck you want to delete
2. Click "🗑️ Delete Deck" (top right of deck contents)
3. Confirm the deletion
4. The deck is permanently removed

### Switching Between Decks
- Simply click another deck in the grid
- Your current work is automatically saved
- No need to manually save changes

## 💡 Pro Tips

### Deck Building Strategy

**Start with a Plan**
1. Decide on your strategy (aggro, control, midrange, combo)
2. Choose 2-3 colors max
3. Have a clear win condition

**Card Distribution (60-card deck)**
- **24 Lands**: Mana base
- **22-26 Creatures**: Your threats
- **10-14 Spells**: Removal, card draw, etc.

**Mana Curve**
- **1-2 CMC**: 12-15 cards (early plays)
- **3-4 CMC**: 15-20 cards (mid-game)
- **5+ CMC**: 3-6 cards (late-game finishers)

### Building by Archetype

**Aggro**
- Low mana curve (lots of 1-3 drops)
- 24-28 creatures
- 8-12 burn/removal spells
- 22-24 lands

**Control**
- Higher mana curve
- 4-8 creatures (finishers)
- 26-30 removal/counter spells
- 26 lands

**Midrange**
- Balanced curve
- 20-24 creatures
- 12-16 interaction spells
- 24-26 lands

**Commander (100 cards)**
- 1 Commander
- 35-40 lands
- 30-35 creatures
- 25-30 spells

### Sideboard Strategy

**Game 1**: Use only Mainboard
**Games 2-3**: Swap up to 15 cards with Sideboard

Common sideboard cards:
- Additional removal for specific threats
- Graveyard hate
- Artifact/enchantment destruction
- Protection spells
- Alternative win conditions

### Using the Maybeboard

**Perfect for:**
- Cards you're testing
- Alternatives to current choices
- High-impact cards you're not sure about
- Extra copies beyond the 4-card limit

**Workflow:**
1. Add promising cards to Maybeboard
2. Test the deck
3. Move keepers to Mainboard/Sideboard
4. Remove underperformers

## ⌨️ Workflow Example

### Building a Red-Green Aggro Deck

1. **Create Deck**
   - Click "+ New Deck"
   - Name: "RG Stompy"
   - Description: "Fast creatures backed by pump spells"
   - Format: Standard

2. **Add Creatures (Mainboard)**
   - Switch to Mainboard tab
   - Add all your 1-drop creatures
   - Add your 2-3 drop threats
   - Add a few 4-5 drop finishers
   - **Goal: 24 creatures**

3. **Add Spells (Mainboard)**
   - Add pump spells (Giant Growth effects)
   - Add removal (Lightning Bolt, etc.)
   - **Goal: 12 spells**

4. **Add Lands (Mainboard)**
   - Add all your red/green dual lands
   - Add basic Mountains and Forests
   - **Goal: 24 lands**

5. **Build Sideboard**
   - Switch to Sideboard tab
   - Add artifact/enchantment removal
   - Add anti-control cards
   - Add anti-aggro cards
   - **Goal: 15 cards**

6. **Populate Maybeboard**
   - Switch to Maybeboard tab
   - Add alternative creatures
   - Add cards you're considering
   - Keep testing options here

## 🔄 Iterating on Your Deck

### After Testing

**Cards Underperformed?**
1. Remove them from Mainboard
2. Try alternatives from Maybeboard
3. Or return to Draft tab to pick new cards

**Need More of a Type?**
1. Go to Draft tab
2. Use filters to find what you need
3. Draft additional cards
4. Return to Deck Builder

**Deck Too Slow/Fast?**
- Review your mana curve
- Adjust creature counts at each mana cost
- Add/remove lands as needed

## 🎨 Visual Guide

```
┌─────────────────────────────────────────────────────┐
│  + New Deck              [Deck 1] [Deck 2] [Deck 3] │
├──────────────────┬──────────────────────────────────┤
│ Available Cards  │  RG Stompy                Delete │
│ (24 cards)       │  [Mainboard] [Sideboard] [Maybe] │
│                  │                                   │
│ [Card Image]     │  1x Llanowar Elves     [Remove]  │
│ Lightning Bolt   │  4x Lightning Bolt     [Remove]  │
│ [+]              │  2x Giant Growth       [Remove]  │
│                  │  ...                              │
│ [Card Image]     │                                   │
│ Giant Growth     │  Stats: Main: 60 | Side: 15      │
│ [+]              │                                   │
│                  │                                   │
│ ...              │                                   │
└──────────────────┴──────────────────────────────────┘
```

## 🐛 Troubleshooting

### "Card is already in this section"
- The card is already in your current tab (Mainboard/Sideboard/Maybeboard)
- Switch tabs or remove it first

### Available Cards list is empty
- All your drafted cards are in the current section
- Switch to a different tab to see different available cards
- Or remove some cards from the current section

### Deck won't delete
- Confirm you're clicking the confirmation dialog
- Refresh the page and try again
- Check browser console for errors

### Cards not showing up
- Make sure your team has drafted cards (Draft tab)
- Check that the database tables exist
- Verify you're looking at the right team

## 🚀 Advanced Features (Future)

Potential enhancements:
- **Mana curve visualization**: Graph showing card distribution by cost
- **Color pie chart**: Visual breakdown of color distribution
- **Deck validation**: Check if deck meets format requirements
- **Card quantity editor**: Adjust quantities without re-adding
- **Bulk operations**: Add multiple cards at once
- **Deck export**: Export to Arena, MTGO, or text format
- **Deck import**: Import deck lists from other sources
- **Deck comparison**: Compare two decks side-by-side
- **Playtest mode**: Virtual playtesting against AI

---

**Start building your championship deck today!** 🏆✨
