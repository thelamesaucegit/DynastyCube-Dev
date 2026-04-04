# Deck Export Feature Guide

This guide explains how to export your Dynasty Cube decks to various formats for use in other MTG applications.

## Supported Export Formats

### 1. **Cockatrice (.cod)**
- **Format**: Cockatrice deck file
- **Extension**: `.cod`
- **Use for**: Playing MTG online with Cockatrice
- **What's included**:
  - Deck name
  - Format type
  - Deck description
  - Mainboard cards with quantities
  - Sideboard cards with quantities

**Example output:**
```
// Deck: My Awesome Deck
// Format: standard
// Description: A powerful control deck
// Exported from Dynasty Cube

// Mainboard (60 cards)
4 Lightning Bolt
4 Counterspell
20 Island
...

// Sideboard (15 cards)
SB: 2 Negate
SB: 3 Relic of Progenitus
...
```

### 2. **MTG Arena (.txt)**
- **Format**: MTG Arena deck list
- **Extension**: `.txt`
- **Use for**: Importing decks into MTG Arena
- **What's included**:
  - Mainboard cards with quantities
  - Sideboard cards with quantities

**Example output:**
```
Deck
4 Lightning Bolt
4 Counterspell
20 Island
...

Sideboard
2 Negate
3 Relic of Progenitus
...
```

## How to Export

1. **Navigate to your deck**
   - Go to a team page
   - Click the "📚 Decks" tab
   - Select or create a deck

2. **Use the Export button**
   - Hover over the "📥 Export" button in the deck header
   - A dropdown menu will appear
   - Choose your desired format:
     - **Cockatrice (.cod)** - For Cockatrice
     - **MTG Arena (.txt)** - For MTG Arena

3. **Save the file**
   - The deck file will automatically download
   - File name format: `deck_name.cod` or `deck_name.txt`

## Using Exported Decks

### Importing into Cockatrice

1. Open Cockatrice
2. Go to **Deck Editor**
3. Click **Load Deck**
4. Select your exported `.cod` file
5. The deck will load with all mainboard and sideboard cards

### Importing into MTG Arena

1. Open MTG Arena
2. Go to **Decks** tab
3. Click **Import Deck**
4. Open your exported `.txt` file in a text editor
5. Copy the entire contents
6. Paste into the Arena import dialog
7. Click **Import**

**Note:** Arena can only import cards that exist in Arena. If a card isn't available in Arena, it will be skipped.

## Features

- ✅ **Automatic file naming** - Deck names are sanitized for safe filenames
- ✅ **Quantity support** - Card quantities are preserved
- ✅ **Category separation** - Mainboard and sideboard are kept separate
- ✅ **Metadata included** - Cockatrice exports include deck name, format, and description
- ✅ **One-click export** - Downloads happen automatically
- ✅ **Format flexibility** - Export to multiple formats from the same deck

## Deck Categories

The export feature handles three deck categories:

1. **Mainboard** - Your main 60+ card deck (exported to both formats)
2. **Sideboard** - Up to 15 sideboard cards (exported to both formats)
3. **Maybeboard** - Not exported (this is for cards you're considering)

Only mainboard and sideboard cards are included in exports, as these are the two categories recognized by Cockatrice and MTG Arena.

## Troubleshooting

### Export button doesn't appear
- Make sure you have selected a deck
- The export button only appears when viewing a deck

### Downloaded file won't open
- Make sure you have Cockatrice installed for `.cod` files
- `.txt` files can be opened in any text editor

### Cards missing after import
- **MTG Arena**: Only cards available in Arena will import
- **Cockatrice**: Make sure your card database is up to date

### File name looks strange
- Special characters in deck names are replaced with underscores
- Example: "My Deck!" becomes "my_deck_.cod"

## Tips

- **Name your decks clearly** before exporting for easier organization
- **Add descriptions** - They're included in Cockatrice exports
- **Test in Cockatrice** first if you're unsure about a decklist
- **Use MTG Arena format** for quick copy/paste sharing

## Future Enhancements

Planned features for future releases:
- MTGO (.dek) format support
- Archidekt export
- Moxfield export
- Deck statistics in exports
- Multiple deck export at once

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
