//src/app/actions/deckGenerationActions.ts

"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase";

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

const COLOR_TO_BASIC_LAND: Record<string, string> = {
    W: 'Plains',
    U: 'Island',
    B: 'Swamp',
    R: 'Mountain',
    G: 'Forest',
};

const BASIC_LAND_CARD_IDS: Record<string, string> = {
    Plains: 'basic-plains',
    Island: 'basic-island',
    Swamp: 'basic-swamp',
    Mountain: 'basic-mountain',
    Forest: 'basic-forest',
};

/** Parse colored mana pips from a mana cost string e.g. "{2}{W}{W}" → {W:2} */
function parseColorPips(manaCost: string): Record<string, number> {
    const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    if (!manaCost) return pips;
    for (const char of manaCost) {
        if (char in pips) pips[char]++;
    }
    return pips;
}

/** Format deck_cards rows into a .dck string for the sim */
function formatAsDck(
    teamId: string,
    cards: Array<{ card_name: string; quantity: number }>
): string {
    const mainLines = cards
        .map(c => `${c.quantity} ${c.card_name}`)
        .join('\n');
    return `[metadata]\nName=${teamId}\n\n[Main]\n${mainLines}`;
}

/**
 * Generate a placeholder deck for a team using the ELO+budget algorithm.
 * Creates rows in team_decks and deck_cards.
 * Called automatically at the end of a draft for each participating team.
 * 
 * This is a system operation — created_by is null (not user-generated),
 * so it does NOT count against the 3-deck-per-user-per-team limit.
 */
export async function generatePlaceholderDeck(
    teamId: string,
    draftSessionId?: string
): Promise<{ success: boolean; deckId?: string; summary?: object; error?: string }> {
    const supabase = createServiceClient();

    try {
        // 1. Fetch active season's budget cap
        const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select('cubucks_allocation, season_number')
            .eq('is_active', true)
            .single();

        if (seasonError || !season) {
            return { success: false, error: 'No active season found' };
        }

        const budgetCap = season.cubucks_allocation;

        // 2. Fetch team's draft picks joined with card_pools for cubucks_cost
        const { data: picks, error: picksError } = await supabase
            .from('team_draft_picks')
            .select(`
                id,
                card_id,
                card_name,
                card_type,
                mana_cost,
                cubecobra_elo,
                card_pool_id,
                card_pools!card_pool_id(cubucks_cost)
            `)
            .eq('team_id', teamId)
            .neq('card_id', 'skipped-pick');

        if (picksError) {
            return { success: false, error: `Failed to fetch draft picks: ${picksError.message}` };
        }

        if (!picks || picks.length === 0) {
            return { success: false, error: 'Team has no draft picks to generate a deck from' };
        }

        // 3. Normalize picks — treat null ELO as 0, null cubucks_cost as 1
        const normalizedPicks = picks.map(p => ({
            id: p.id,
            card_id: p.card_id,
            card_name: p.card_name,
            card_type: p.card_type || '',
            mana_cost: p.mana_cost || '',
            elo: p.cubecobra_elo ?? 0,
            cost: (p.card_pools as any)?.cubucks_cost ?? 1,
        }));

        // 4. Sort by ELO descending
        normalizedPicks.sort((a, b) => b.elo - a.elo);

        // 5. Select cards within budget cap
        const selectedCards: typeof normalizedPicks = [];
        let budgetUsed = 0;

        for (const card of normalizedPicks) {
            if (budgetUsed + card.cost <= budgetCap) {
                selectedCards.push(card);
                budgetUsed += card.cost;
            }
        }

        // 6. Separate lands from non-lands
        const isLand = (cardType: string) => cardType.toLowerCase().includes('land');
        const draftedLands = selectedCards.filter(c => isLand(c.card_type));
        const nonLands = selectedCards.filter(c => !isLand(c.card_type));

        // 7. Calculate basic lands needed
        const requiredTotalLands = Math.ceil(nonLands.length / 2);
        const basicLandsToAddCount = Math.max(0, requiredTotalLands - draftedLands.length);

        // 8. Calculate color pip distribution
        const totalPips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        let totalColoredPips = 0;

        nonLands.forEach(card => {
            const pips = parseColorPips(card.mana_cost);
            for (const color in pips) {
                totalPips[color] += pips[color];
                totalColoredPips += pips[color];
            }
        });

        // 9. Distribute basic lands by color ratio
        const basicLandCounts: Record<string, number> = {};

        if (totalColoredPips > 0 && basicLandsToAddCount > 0) {
            let roundedTotal = 0;
            const remainders: Array<{ color: string; remainder: number }> = [];

            for (const color in totalPips) {
                const exact = (totalPips[color] / totalColoredPips) * basicLandsToAddCount;
                const rounded = Math.floor(exact);
                basicLandCounts[color] = rounded;
                roundedTotal += rounded;
                remainders.push({ color, remainder: exact - rounded });
            }

            // Distribute remaining lands to colors with largest remainders
            const difference = basicLandsToAddCount - roundedTotal;
            remainders.sort((a, b) => b.remainder - a.remainder);
            for (let i = 0; i < difference; i++) {
                basicLandCounts[remainders[i].color]++;
            }
        } else if (basicLandsToAddCount > 0) {
            // Colorless deck — add Wastes (represented as Plains for sim compatibility)
            basicLandCounts['W'] = basicLandsToAddCount;
        }

        // 10. Delete any existing auto-generated deck for this team this season
        //     (identified by created_by = null and deck_name pattern)
        await supabase
            .from('team_decks')
            .delete()
            .eq('team_id', teamId)
            .is('created_by', null)
            .like('deck_name', `Auto-Generated%Season ${season.season_number}%`);

        // 11. Create team_decks row
        const deckName = `Auto-Generated Deck — Season ${season.season_number}`;
        const { data: newDeck, error: deckError } = await supabase
            .from('team_decks')
            .insert({
                team_id: teamId,
                deck_name: deckName,
                description: `Default deck auto-generated from draft picks. Budget used: ${budgetUsed}/${budgetCap}.`,
                format: 'standard',
                is_public: false,
                created_by: null, // system-generated, not user-created
            })
            .select('id')
            .single();

        if (deckError || !newDeck) {
            return { success: false, error: `Failed to create deck: ${deckError?.message}` };
        }

        const deckId = newDeck.id;

        // 12. Build deck_cards rows for selected draft picks
        const deckCardRows = selectedCards.map(card => ({
            deck_id: deckId,
            draft_pick_id: card.id,
            card_id: card.card_id,
            card_name: card.card_name,
            quantity: 1,
            is_commander: false,
            category: 'mainboard',
        }));

        // 13. Add basic land rows
        for (const [color, count] of Object.entries(basicLandCounts)) {
            if (count <= 0) continue;
            const landName = COLOR_TO_BASIC_LAND[color];
            if (!landName) continue;
            deckCardRows.push({
                deck_id: deckId,
                draft_pick_id: null as any,
                card_id: BASIC_LAND_CARD_IDS[landName],
                card_name: landName,
                quantity: count,
                is_commander: false,
                category: 'mainboard',
            });
        }

        const { error: cardsError } = await supabase
            .from('deck_cards')
            .insert(deckCardRows);

        if (cardsError) {
            // Clean up the deck row if cards failed
            await supabase.from('team_decks').delete().eq('id', deckId);
            return { success: false, error: `Failed to insert deck cards: ${cardsError.message}` };
        }

        const totalCards = selectedCards.length + basicLandsToAddCount;
        const summary = {
            totalCards,
            nonLandCount: nonLands.length,
            draftedLandCount: draftedLands.length,
            basicLandsAdded: basicLandsToAddCount,
            basicLandBreakdown: Object.fromEntries(
                Object.entries(basicLandCounts)
                    .filter(([, v]) => v > 0)
                    .map(([color, count]) => [COLOR_TO_BASIC_LAND[color], count])
            ),
            budgetUsed,
            budgetCap,
        };

        console.log(`[generatePlaceholderDeck] Team ${teamId}: created deck "${deckName}"`, summary);
        return { success: true, deckId, summary };

    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unexpected error';
        return { success: false, error: msg };
    }
}

/**
 * Convert a team_decks entry (via deck_cards) into a deck_submissions row.
 * This is called when a deck vote resolves, or manually by an admin.
 * 
 * If a submission already exists for this team+week, it is updated in place.
 * Only mainboard cards are included in the sim decklist.
 */
export async function submitDeckForWeek(
    deckId: string,
    teamId: string,
    weekId: string
): Promise<{ success: boolean; submissionId?: string; error?: string }> {
    const supabase = createServiceClient();

    try {
        // 1. Fetch mainboard cards for this deck
        const { data: cards, error: cardsError } = await supabase
            .from('deck_cards')
            .select('card_name, quantity')
            .eq('deck_id', deckId)
            .eq('category', 'mainboard');

        if (cardsError || !cards || cards.length === 0) {
            return { 
                success: false, 
                error: cardsError?.message || 'No mainboard cards found in deck' 
            };
        }

        // 2. Fetch deck metadata for the name
        const { data: deck, error: deckError } = await supabase
            .from('team_decks')
            .select('deck_name')
            .eq('id', deckId)
            .single();

        if (deckError || !deck) {
            return { success: false, error: 'Deck not found' };
        }

        // 3. Format as .dck string
        const deckList = formatAsDck(teamId, cards);

        // 4. Check for existing submission for this team+week
        const { data: existing } = await supabase
            .from('deck_submissions')
            .select('id')
            .eq('team_id', teamId)
            .eq('week_id', weekId)
            .maybeSingle();

        if (existing) {
            // Update in place — preserves version history intent
            const { data: updated, error: updateError } = await supabase
                .from('deck_submissions')
                .update({
                    deck_list: deckList,
                    deck_name: deck.deck_name,
                    is_current: true,
                    version: supabase.rpc as any, // increment handled by DB if trigger exists
                })
                .eq('id', existing.id)
                .select('id')
                .single();

            if (updateError) {
                return { success: false, error: updateError.message };
            }
            return { success: true, submissionId: existing.id };
        }

        // 5. Insert new submission
        const { data: submission, error: insertError } = await supabase
            .from('deck_submissions')
            .insert({
                team_id: teamId,
                week_id: weekId,
                deck_name: deck.deck_name,
                deck_list: deckList,
                is_current: true,
                confirmed_by_captain: false,
                version: 1,
            })
            .select('id')
            .single();

        if (insertError || !submission) {
            return { success: false, error: insertError?.message || 'Failed to create submission' };
        }

        return { success: true, submissionId: submission.id };

    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}

/**
 * Purge all user-created team decks at season rollover.
 * Auto-generated decks (created_by = null) from the OLD season are also removed.
 * Decks used in matches are preserved in the matches/sim_matches tables for history.
 * 
 * Call this as part of the end-of-season admin process.
 */
export async function purgeTeamDecksForSeasonRollover(): Promise<{ 
    success: boolean; 
    deletedCount: number; 
    error?: string 
}> {
    const supabase = createServiceClient();

    try {
        // Count first so we can report
        const { count } = await supabase
            .from('team_decks')
            .select('id', { count: 'exact', head: true });

        const { error } = await supabase
            .from('team_decks')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

        if (error) return { success: false, deletedCount: 0, error: error.message };

        return { success: true, deletedCount: count ?? 0 };
    } catch (e) {
        return { success: false, deletedCount: 0, error: e instanceof Error ? e.message : 'Unexpected error' };
    }
}
