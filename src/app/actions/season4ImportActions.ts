// /src/app/actions/season4ImportActions.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchAllCards, fetchOldestPrintings, ScryfallCard } from "@/lib/scryfall-client";

// This function can remain the same
async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
        },
      },
    }
  );
}

const SESSION_ID = 'e419655d-e308-4648-8f90-2da7ee119847';
const SEASON_ID = '4b1d9936-bf5e-4ee5-bd56-741a7c12307e';

export async function processSeason4CSV(csvText: string): Promise<{ success: boolean; message: string; }> {
    const supabase = await createClient();
    try {
        const lines = csvText.split('\n').map(l => l.split(','));
        const teamNames = lines[2].slice(2, 8).map(n => n.trim());

        // 1. Resolve Team IDs
        const { data: teamsData, error: teamsError } = await supabase.from('teams').select('id, name');
        if (teamsError) throw new Error("Could not fetch teams from database.");
        
        const teamMap = new Map<string, string>();
        teamsData.forEach(t => teamMap.set(t.name.toLowerCase().trim(), t.id));

        const orderedTeamIds = teamNames.map(name => {
            const id = teamMap.get(name.toLowerCase());
            if (!id) throw new Error(`Could not find team ID for: ${name}`);
            return id;
        });

        // 2. Clear & Generate Draft Order
        await supabase.from('draft_order').delete().eq('season_id', SEASON_ID);
        const draftOrderInserts = orderedTeamIds.map((teamId, index) => ({
            season_id: SEASON_ID,
            team_id: teamId,
            pick_position: index + 1,
            lottery_number: index + 1 
        }));
        await supabase.from('draft_order').insert(draftOrderInserts);

        // 3. Parse CSV Grid, preserving ALL picks including duplicates
        const parsedPicks: Array<{ teamId: string; cardName: string; pickNumber: number; pickSource: 'draft' | 'keeper' }> = [];
        let keeperCounter = 193; // Keepers start after the main draft

        // Rounds 1-32 (Snake Math)
        for (let r = 1; r <= 32; r++) {
            const line = lines[r + 2];
            if (!line) continue;
            const isEvenRound = r % 2 === 0;

            for (let c = 2; c <= 7; c++) {
                const rawName = line[c];
                if (!rawName || !rawName.trim()) continue;

                const cardName = rawName.trim().replace(/\d+$/, '');
                const teamIndex = isEvenRound ? (7 - c) : (c - 2);
                const pickNumber = ((r - 1) * 6) + (isEvenRound ? (c - 1) : (c - 2)) + 1;
                
                parsedPicks.push({ teamId: orderedTeamIds[teamIndex], cardName, pickNumber, pickSource: 'draft' });
            }
        }

        // Keepers (Rows 35-42)
        for (let k = 35; k < lines.length; k++) {
            const line = lines[k];
            if (!line) continue;
            for (let c = 2; c <= 7; c++) {
                const rawName = line[c];
                if (!rawName || !rawName.trim() || rawName.trim().toUpperCase() === 'KEEPERS') continue;

                const cardName = rawName.trim().replace(/\d+$/, '');
                parsedPicks.push({ teamId: orderedTeamIds[c - 2], cardName, pickNumber: keeperCounter++, pickSource: 'keeper' });
            }
        }

        // 4. Fetch Scryfall Data using only the unique names
        const uniqueNames = [...new Set(parsedPicks.map(p => p.cardName))];
        const { cards: scryfallResults } = await fetchAllCards(uniqueNames);
        
        const reprintOracleIds = scryfallResults.filter(c => c.reprint).map(c => c.oracle_id).filter(Boolean) as string[];
        const originalPrintingsMap = await fetchOldestPrintings(reprintOracleIds);

        const scryfallCardMap = new Map<string, ScryfallCard>();
        scryfallResults.forEach(card => {
            if (card.reprint && card.oracle_id && originalPrintingsMap.has(card.oracle_id)) {
                scryfallCardMap.set(card.name.toLowerCase(), originalPrintingsMap.get(card.oracle_id)!);
            } else {
                scryfallCardMap.set(card.name.toLowerCase(), card);
            }
        });

        // 5. Construct & Insert
        const baseTime = new Date('2023-08-01T12:00:00-05:00').getTime();
        const finalInserts = parsedPicks.map(pick => {
            const scryData = scryfallCardMap.get(pick.cardName.toLowerCase());
            const draftedAt = new Date(baseTime + (pick.pickNumber * 60000)).toISOString();
            
            return {
                draft_session_id: SESSION_ID,
                team_id: pick.teamId,
                card_id: scryData?.id || 'unknown',
                card_name: scryData?.name || pick.cardName,
                card_set: scryData?.set_name || null,
                card_type: scryData?.type_line || null,
                rarity: scryData?.rarity || null,
                colors: scryData?.colors || [],
                color_identity: scryData?.color_identity || [],
                image_url: scryData?.image_uris?.normal || scryData?.image_uris?.small || null,
                oldest_image_url: scryData?.image_uris?.normal || scryData?.image_uris?.small || null,
                mana_cost: scryData?.mana_cost || null,
                cmc: scryData?.cmc || 0,
                pick_number: pick.pickNumber,
                pick_source: pick.pickSource,
                drafted_at: draftedAt,
            };
        });

        await supabase.from('historical_draft_picks').delete().eq('draft_session_id', SESSION_ID);
        const { error: insertError } = await supabase.from('historical_draft_picks').insert(finalInserts);
        if (insertError) throw insertError;

        return { success: true, message: `Successfully parsed and inserted ${finalInserts.length} picks for Season 4!` };
    } catch (err: any) {
        return { success: false, message: err.message || "An unknown error occurred." };
    }
}
