// src/app/actions/resortAdminActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// The exact string we tested, fully URI encoded
const SCRYFALL_RESORT_QUERY = "t:land -is:basic (produces>=2 OR (o:search AND (o:land OR o:Plains OR o:Island OR o:Swamp OR o:Mountain OR o:Forest)) OR o:\"put a land\") -o:/search your library for an? (basic )?(Plains|Island|Swamp|Mountain|Forest) card/ -o:/^\\{T\\}: Add \\{[WUBRG]\\}\\.$/ -o:/Add \\{[CWUBRG]\\}\\{[CWUBRG]\\}/ -o:\"it's still a land\" -is:dfc -is:mdfc -st:funny -is:ub";

export async function importResortPoolFromScryfall(): Promise<{ success: boolean; message: string; count?: number; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        await logSystemEvent("ResortAdmin", "info", `Starting Scryfall import for Resort Pool.`);
        
        let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(SCRYFALL_RESORT_QUERY)}`;
        let importedCount = 0;
        let hasMore = true;

        // Scryfall Rate Limit Delay Helper
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        while (hasMore) {
            const response = await fetch(url);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`Scryfall API Error: ${errData.details || response.statusText}`);
            }

            const data = await response.json();
            
            // Map Scryfall data to our schema
            const cardsToInsert = data.data.map((card: any) => ({
                card_id: card.id,
                card_name: card.name,
                card_set: card.set.toUpperCase(),
                card_type: card.type_line,
                rarity: card.rarity,
                colors: card.colors || [],
                color_identity: card.color_identity || [],
                image_url: card.image_uris?.normal || card.image_uris?.large || null,
                oracle_id: card.oracle_id,
                mana_cost: card.mana_cost || null,
                cmc: card.cmc || 0,
                cubucks_cost: 1, // Base cost for Resort pool
                hidden: true,    // All newly imported cards start hidden!
            }));

            if (cardsToInsert.length > 0) {
                const { error: upsertError } = await supabase
                    .from('resort_pool')
                    .upsert(cardsToInsert, { onConflict: 'card_id' });

                if (upsertError) throw new Error(`Database Upsert Error: ${upsertError.message}`);
                importedCount += cardsToInsert.length;
            }

            hasMore = data.has_more;
            if (hasMore) {
                url = data.next_page;
                await delay(100); // Respect Scryfall 100ms rate limit
            }
        }

        await logSystemEvent("ResortAdmin", "info", `Successfully imported ${importedCount} lands into the Resort Pool.`);
        return { success: true, count: importedCount, message: `Successfully imported and hid ${importedCount} Resort lands.` };

    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("Resort Import Error:", msg);
        await logSystemEvent("ResortAdmin", "error", `Import failed: ${msg}`);
        return { success: false, message: "Import failed.", error: msg };
    }
}
