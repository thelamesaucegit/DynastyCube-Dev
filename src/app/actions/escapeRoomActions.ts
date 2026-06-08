// src/app/actions/escapeRoomActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

export async function processEscapeRoomRewards(seasonId: string, weekNumber: number) {
    const supabase = await createServerClient();
    
    // 1. Find all teams that are currently eliminated (is_escaped = true)
    const { data: escapedTeams } = await supabase
        .from('teams')
        .select('id, name, plane')
        .eq('is_escaped', true)
        .eq('is_hidden', false);

    if (!escapedTeams || escapedTeams.length === 0) return;

    for (const team of escapedTeams) {
        try {
            // 2. Count how many Escape Room rewards this team has already received this season
            // We do this by checking their draft picks for the 'escape' scar
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

            // 4. Construct the Scryfall Random Query based on the Reward Tier
            let scryfallQuery = "-is:ub -st:funny -is:dfc -is:mdfc ";
            
            if (rewardTier === 1) {
                // Tier 1: Any rarity from home plane
                scryfallQuery += setQuery ? setQuery : ""; 
            } else if (rewardTier === 2) {
                // Tier 2: Uncommon, Rare, or Mythic from home plane
                scryfallQuery += `(r:uncommon OR r:rare OR r:mythic) ${setQuery}`;
            } else if (rewardTier === 3) {
                // Tier 3: Rare or Mythic from home plane
                scryfallQuery += `(r:rare OR r:mythic) ${setQuery}`;
            } else {
                // Tier 4+: Rare or Mythic from ANY set
                scryfallQuery += `(r:rare OR r:mythic)`;
            }

            // 5. Fetch a random card matching the criteria
            const scryfallUrl = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(scryfallQuery)}`;
            const response = await fetch(scryfallUrl, {
                headers: { 'User-Agent': 'DynastyCube/1.0', 'Accept': 'application/json' }
            });

            if (!response.ok) {
                console.warn(`[EscapeRoom] Failed to find card for ${team.name} using query: ${scryfallQuery}`);
                continue;
            }

            const card = await response.json();

            // 6. Insert the card into the global card_pools table first so it physically exists in the database
            const imageUris = card.image_uris as Record<string, string> | undefined;
            const { data: poolCard, error: poolErr } = await supabase.from('card_pools').insert({
                card_id: String(card.id),
                card_name: String(card.name),
                card_set: String((card.set as string).toUpperCase()),
                card_type: String(card.type_line),
                rarity: String(card.rarity),
                colors: Array.isArray(card.colors) ? card.colors : [],
                color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
                image_url: imageUris?.normal || imageUris?.large || null,
                oracle_id: String(card.oracle_id),
                mana_cost: card.mana_cost ? String(card.mana_cost) : null,
                cmc: typeof card.cmc === 'number' ? card.cmc : 0,
                cubucks_cost: 0, // Free for now, Rollover will set it to 3 or 5% of cap
                scars: ['escape'] // <-- Mark it!
            }).select('id').single();

            if (poolErr || !poolCard) throw new Error(`Pool insert failed: ${poolErr?.message}`);

            // 7. Grant the card directly to the team's draft picks
            const { error: pickErr } = await supabase.from('team_draft_picks').insert({
                team_id: team.id,
                card_pool_id: poolCard.id,
                card_id: String(card.id),
                card_name: String(card.name),
                card_set: String((card.set as string).toUpperCase()),
                card_type: String(card.type_line),
                rarity: String(card.rarity),
                colors: Array.isArray(card.colors) ? card.colors : [],
                color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
                image_url: imageUris?.normal || imageUris?.large || null,
                mana_cost: card.mana_cost ? String(card.mana_cost) : null,
                cmc: typeof card.cmc === 'number' ? card.cmc : 0,
                pick_number: 999, // Arbitrary high number for mid-season additions
                acquisition_method: 'escape_room',
                scars: ['escape'] // <-- Mark it here too for easy querying!
            });

            if (pickErr) throw new Error(`Pick insert failed: ${pickErr.message}`);

            await logSystemEvent("EscapeRoom", "info", `Granted ${card.name} to ${team.name} (Reward Tier ${rewardTier}) for Week ${weekNumber}.`);
            console.log(`[EscapeRoom] 🚪 ${team.name} received ${card.name}!`);

        } catch (err) {
            console.error(`[EscapeRoom] Error processing reward for ${team.name}:`, err);
        }
    }
}
