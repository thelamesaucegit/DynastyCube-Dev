// src/app/actions/escapeRoomActions.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { logSystemEvent } from "@/lib/systemLogger";
import { updateAllCubecobraElo } from "./cardRatingActions"; // Bring in your ELO syncer

// --- STRICT SCRYFALL INTERFACES ---
interface ScryfallCardFace {
    oracle_text?: string;
    image_uris?: {
        normal?: string;
        small?: string;
        large?: string;
    };
}

interface ScryfallCardResponse {
    id: string;
    name: string;
    set: string;
    type_line: string;
    rarity: string;
    colors?: string[];
    color_identity?: string[];
    oracle_id?: string;
    mana_cost?: string;
    cmc?: number;
    oracle_text?: string;
    image_uris?: {
        normal?: string;
        small?: string;
        large?: string;
    };
    card_faces?: ScryfallCardFace[];
}
// ----------------------------------

// Use service client to bypass RLS for background tasks
function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );
}

// Helper to safely extract oracle text, even for split/dual-faced cards
const extractOracleText = (card: ScryfallCardResponse) => {
    if (card.oracle_text) return card.oracle_text;
    if (card.card_faces) {
        return card.card_faces.map((f: ScryfallCardFace) => f.oracle_text).filter(Boolean).join('\n//\n');
    }
    return null;
};

// Helper to safely extract image URLs, even for DFCs
const extractImageUrl = (card: ScryfallCardResponse) => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces && card.card_faces[0]?.image_uris?.normal) {
        return card.card_faces[0].image_uris.normal;
    }
    return card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null;
};

export async function processEscapeRoomRewards(seasonId: string, weekNumber: number) {
    const supabase = createServiceClient();
    
    // 1. Find all teams that are currently eliminated (is_escaped = true)
    const { data: escapedTeams } = await supabase
        .from('teams')
        .select('id, name, plane')
        .eq('is_escaped', true)
        .eq('is_hidden', false);

    if (!escapedTeams || escapedTeams.length === 0) return;

    // We will track what we insert so we can sync ELOs at the end
    const insertedPicks: { poolId: string, pickId: string }[] = [];

    for (const team of escapedTeams) {
        try {
            // 2. Count how many Escape Room rewards this team has already received this season
            const { count: previousRewards } = await supabase
                .from('team_draft_picks')
                .select('id', { count: 'exact', head: true })
                .eq('team_id', team.id)
                .contains('scars', ['escape']);

            const rewardTier = (previousRewards || 0) + 1;
            
            // 3. Find the sets associated with their home plane
            let setQuery = "";
            if (team.plane && rewardTier <= 3) {
                const { data: chamberSets } = await supabase
                    .from('chamber_records')
                    .select('set_code')
                    .ilike('plane', team.plane);
                
                if (chamberSets && chamberSets.length > 0) {
                    const setCodes = chamberSets.map(s => `e:${s.set_code}`).join(' OR ');
                    setQuery = `(${setCodes})`;
                }
            }

            // 4. Construct the Scryfall Random Query
            let scryfallQuery = "-is:ub -st:funny -is:dfc -is:mdfc ";
            
            if (rewardTier === 1) {
                scryfallQuery += setQuery ? setQuery : ""; 
            } else if (rewardTier === 2) {
                scryfallQuery += `(r:uncommon OR r:rare OR r:mythic) ${setQuery}`;
            } else if (rewardTier === 3) {
                scryfallQuery += `(r:rare OR r:mythic) ${setQuery}`;
            } else {
                scryfallQuery += `(r:rare OR r:mythic)`;
            }

            // 5. Fetch a random card
            const scryfallUrl = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(scryfallQuery)}`;
            const response = await fetch(scryfallUrl, {
                headers: { 'User-Agent': 'DynastyCube/1.0', 'Accept': 'application/json' }
            });

            if (!response.ok) {
                console.warn(`[EscapeRoom] Failed to find card for ${team.name} using query: ${scryfallQuery}`);
                continue;
            }

            // Cast the JSON response to our strict interface
            const card = (await response.json()) as ScryfallCardResponse;

            // Robustly extract data
            const imageUrl = extractImageUrl(card);
            const oracleText = extractOracleText(card);
            const cardSet = String(card.set).toLowerCase(); 

            // 6. Insert into card_pools
            const { data: poolCard, error: poolErr } = await supabase.from('card_pools').insert({
                card_id: String(card.id),
                card_name: String(card.name),
                card_set: cardSet,
                card_type: String(card.type_line),
                rarity: String(card.rarity),
                colors: Array.isArray(card.colors) ? card.colors : [],
                color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
                image_url: imageUrl,
                oldest_image_url: imageUrl,
                oracle_id: card.oracle_id ? String(card.oracle_id) : null,
                oracle_text: oracleText,
                mana_cost: card.mana_cost ? String(card.mana_cost) : null,
                cmc: typeof card.cmc === 'number' ? card.cmc : 0,
                cubucks_cost: 3, // Force cost to 3
                scars: ['escape'],
                pool_name: 'draft'
            }).select('id').single();

            if (poolErr || !poolCard) throw new Error(`Pool insert failed: ${poolErr?.message}`);

            // 7. Insert into team_draft_picks
            const { data: pickData, error: pickErr } = await supabase.from('team_draft_picks').insert({
                team_id: team.id,
                card_pool_id: poolCard.id,
                card_id: String(card.id),
                card_name: String(card.name),
                card_set: cardSet,
                card_type: String(card.type_line),
                rarity: String(card.rarity),
                colors: Array.isArray(card.colors) ? card.colors : [],
                color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
                image_url: imageUrl,
                oldest_image_url: imageUrl,
                oracle_text: oracleText,
                mana_cost: card.mana_cost ? String(card.mana_cost) : null,
                cmc: typeof card.cmc === 'number' ? card.cmc : 0,
                pick_number: 999, 
                acquisition_method: 'escape_room',
                scars: ['escape'],
                cubucks_cost: 3 // Force cost to 3
            }).select('id').single();

            if (pickErr || !pickData) throw new Error(`Pick insert failed: ${pickErr.message}`);

            // Log it for final sync
            insertedPicks.push({ poolId: poolCard.id, pickId: pickData.id });

            await logSystemEvent("EscapeRoom", "info", `Granted ${card.name} to ${team.name} (Reward Tier ${rewardTier}) for Week ${weekNumber}.`);
            console.log(`[EscapeRoom] 🚪 ${team.name} received ${card.name}!`);

        } catch (err) {
            console.error(`[EscapeRoom] Error processing reward for ${team.name}:`, err);
        }
    }

    // 8. Sync ELOs for the newly imported cards
    if (insertedPicks.length > 0) {
        try {
            // Re-sync all card_pools with Cubecobra
            await updateAllCubecobraElo('card_pools');
            
            // Push those freshly retrieved ELOs down to the team_draft_picks table
            for (const pick of insertedPicks) {
                const { data: poolData } = await supabase
                    .from('card_pools')
                    .select('cubecobra_elo')
                    .eq('id', pick.poolId)
                    .single();
                    
                if (poolData && poolData.cubecobra_elo) {
                    await supabase
                        .from('team_draft_picks')
                        .update({ cubecobra_elo: poolData.cubecobra_elo })
                        .eq('id', pick.pickId);
                }
            }
        } catch (eloErr) {
            console.error("[EscapeRoom] Failed to sync ELOs for new escape room cards:", eloErr);
        }
    }
}
