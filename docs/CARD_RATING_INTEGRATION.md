# Card Rating Integration Guide

This guide explains how to sync card power level ratings from external APIs (Scryfall/EDHREC) into your Dynasty Cube database.

## Overview

The card rating system enriches your card data with community-driven power level indicators:

- **EDHREC Rank**: Card popularity based on EDHREC deck data (lower = more popular)
- **CubeCobra ELO**: *(Future)* Card strength based on draft pick data
- **Scryfall ID**: Unique identifier for each card for API lookups

## Database Schema

Two tables have been enhanced with rating columns:

### `card_pools` Table
Available cards for drafting
```sql
edhrec_rank          integer    -- Lower is more popular (1 = most popular)
cubecobra_elo        integer    -- (Future) Higher is stronger
scryfall_id          uuid       -- Unique Scryfall identifier
rating_updated_at    timestamp  -- Last rating sync time
```

### `team_draft_picks` Table
Cards drafted by teams
```sql
edhrec_rank          integer    -- Lower is more popular
cubecobra_elo        integer    -- (Future) Higher is stronger
scryfall_id          uuid       -- Unique Scryfall identifier
rating_updated_at    timestamp  -- Last rating sync time
```

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration in Supabase SQL Editor:

```bash
# File: database/add-card-ratings.sql
```

This adds the rating columns to both `card_pools` and `team_draft_picks` tables.

### 2. Access Admin Interface

Navigate to: `/admin` → Card Rating Sync section

## Features

### Test Single Card

Before syncing all cards, test individual cards to verify API connectivity:

1. Enter card name (e.g., "Lightning Bolt")
2. Click "Test"
3. View EDHREC rank, set information, and Scryfall ID

### Sync Card Pools

Updates ratings for all cards in the `card_pools` table (available draft cards).

**Expected Time**: ~1 minute per 750 cards

### Sync Draft Picks

Updates ratings for all cards in the `team_draft_picks` table (cards teams have drafted).

**Expected Time**: ~1 minute per 750 cards

### Sync Everything

Runs both pool and draft pick syncs sequentially.

## How It Works

### API Flow

```
Your Database → Server Action → Scryfall API → Rate Limited Fetching → Database Update
```

### Rate Limiting

Scryfall API enforces rate limits:
- **10 requests per second** maximum
- **75 cards per request** using collection endpoint
- **100ms delay** between requests (built-in)

### Batch Processing

The system processes cards in batches of 75:
1. Fetch all card names from database
2. Split into batches of 75 cards
3. Request each batch from Scryfall
4. Update database with results
5. Wait 100ms before next batch

### Error Handling

- **Card Not Found**: Logged but doesn't stop sync
- **API Errors**: Logged and reported in results
- **Database Errors**: Logged per-card with details

## Understanding Ratings

### EDHREC Rank

**What it measures**: Card popularity in Commander/EDH format

**Interpretation**:
- Rank 1-100: Staple cards (Sol Ring, Arcane Signet)
- Rank 100-1000: Very popular cards
- Rank 1000-5000: Commonly played
- Rank 5000+: Niche or less popular
- No rank: New, obscure, or not played in Commander

**Note**: Lower is more popular (rank 1 is the most popular card)

### CubeCobra ELO *(Future)*

**What it measures**: Card strength based on draft pick priority

**Interpretation** *(when available)*:
- Higher ELO = Stronger card
- Based on actual cube draft data
- Dynamically updated based on picks

**Status**: Not yet available via public API. Database column exists for future integration.

## Usage Examples

### Query Cards by Rating

```sql
-- Top 10 most popular cards in pool
SELECT card_name, edhrec_rank
FROM card_pools
WHERE edhrec_rank IS NOT NULL
ORDER BY edhrec_rank ASC
LIMIT 10;

-- Cards without ratings (need sync)
SELECT card_name
FROM card_pools
WHERE edhrec_rank IS NULL
  AND rating_updated_at IS NULL;

-- Recently synced cards
SELECT card_name, edhrec_rank, rating_updated_at
FROM card_pools
WHERE rating_updated_at > NOW() - INTERVAL '7 days'
ORDER BY rating_updated_at DESC;
```

### Filter by Power Level

```sql
-- High-power cards (top 1000)
SELECT card_name, edhrec_rank
FROM card_pools
WHERE edhrec_rank <= 1000
ORDER BY edhrec_rank;

-- Niche/budget cards (rank 10000+)
SELECT card_name, edhrec_rank
FROM card_pools
WHERE edhrec_rank >= 10000
ORDER BY edhrec_rank;
```

## API Reference

### Server Actions

#### `updateAllCardRatings()`
Syncs ratings for all cards (pools + draft picks)

**Returns**:
```typescript
{
  success: boolean;
  poolResult: CardRatingResult;
  draftResult: CardRatingResult;
  message: string;
}
```

#### `updatePoolCardRatings()`
Syncs ratings for card pool only

**Returns**:
```typescript
{
  success: boolean;
  updatedCount: number;
  notFoundCount: number;
  errorCount: number;
  message: string;
  errors?: string[];
}
```

#### `updateDraftPickRatings()`
Syncs ratings for draft picks only

**Returns**: Same as `updatePoolCardRatings()`

#### `getCardRating(cardName: string)`
Tests single card lookup

**Returns**:
```typescript
{
  success: boolean;
  card?: ScryfallCard;
  message: string;
}
```

### Scryfall Client

#### `searchCardByName(cardName: string)`
Fetch single card by exact name

#### `fetchCardCollection(cardNames: string[])`
Fetch up to 75 cards in one request

#### `fetchAllCards(cardNames: string[])`
Batch fetch any number of cards with rate limiting

## Best Practices

### When to Sync

- **After bulk card imports**: Sync new cards immediately
- **Weekly/Monthly**: Keep ratings fresh
- **Before major drafts**: Ensure up-to-date power levels

### Performance Tips

1. **Sync during off-hours**: Large syncs take time
2. **Monitor progress**: Check browser console for batch updates
3. **Don't refresh**: Let sync complete fully
4. **Check results**: Review not-found cards for typos

### Handling Not Found Cards

Cards not found on Scryfall typically have:
- Spelling errors in card names
- Custom/proxy cards
- Very new cards (< 24 hours old)
- Non-English names

**Fix**: Verify card names match Scryfall exactly

## Troubleshooting

### Problem: All cards showing "Not Found"

**Cause**: Card names don't match Scryfall database

**Solution**: Ensure card names are exact English names (e.g., "Lightning Bolt" not "Lightning Bolt (M10)")

### Problem: Sync takes too long

**Cause**: Large number of cards + rate limiting

**Solution**:
- Normal for 1000+ cards
- Sync pools and picks separately
- Run during low-traffic periods

### Problem: Some cards never get ratings

**Cause**: Cards legitimately don't have EDHREC rank

**Solution**: This is expected for:
- Non-Commander viable cards
- Very new releases
- Obscure cards

These cards will have `edhrec_rank = NULL` which is correct.

### Problem: "Not authenticated" error

**Cause**: Not logged in or not admin

**Solution**:
1. Ensure you're logged in
2. Verify admin status in `users` table
3. Clear cookies and re-login

## Future Enhancements

### CubeCobra ELO Integration

When CubeCobra releases a public API:

1. Implement `cubecobra-client.ts` similar to `scryfall-client.ts`
2. Add `updateCubeCobraELO()` server action
3. Update UI with CubeCobra sync button
4. Combine both ratings for comprehensive power levels

### Additional Rating Sources

Potential future integrations:
- **MTGGoldfish**: Format-specific popularity
- **TCGPlayer**: Market price as power indicator
- **Custom ratings**: Team-specific power rankings

## Resources

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [EDHREC](https://edhrec.com)
- [CubeCobra](https://cubecobra.com)

## Support

For issues or questions:
1. Check browser console for detailed error logs
2. Verify database migration ran successfully
3. Test single card lookup before bulk sync
4. Review not-found cards for name mismatches
