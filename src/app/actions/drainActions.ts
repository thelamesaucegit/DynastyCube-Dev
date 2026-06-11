// src/app/actions/drainActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

export async function offerToTheDrain(offer: string): Promise<{ success: boolean; message: string; type: "card" | "self" | "rejected" | "unauthenticated" }> {
    if (offer.length > 150) {
        return { success: true, message: "YOUR HUBRIS EXCEEDS YOUR GRASP. THE CUBE REJECTS THIS GIFT.", type: "rejected" };
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return { success: false, message: "THE CUBE DOES NOT ACKNOWLEDGE THE NAMELESS.", type: "unauthenticated" };
    }

    const cleanOffer = offer.trim().toLowerCase();
    if (!cleanOffer) {
        return { success: true, message: "SILENCE IS NO TRIBUTE. THE CUBE REJECTS THIS GIFT.", type: "rejected" };
    }

    // 1. Self Sacrifice Check
    const { data: userData } = await supabase.from('users').select('display_name, discord_username').eq('id', user.id).single();
    const name1 = (userData?.display_name || "").toLowerCase();
    const name2 = (userData?.discord_username || "").toLowerCase();

    if (cleanOffer === name1 || cleanOffer === name2) {
        const selfResponses = [
            "THE CUBE ADMIRES YOUR COMMITMENT. PERHAPS WE WILL WELCOME YOU <strong>ANOTHER TIME</strong>.",
            "YOUR FLESH IS WILLING, BUT THE MAW IS CLOSED. <strong>WAIT</strong>.",
            "A NOBLE SACRIFICE. BUT THE CUBE DEMANDS <strong>PATIENCE</strong>."
        ];
        await logSystemEvent("TheDrain", "info", `User ${user.id} attempted self-sacrifice.`);
        return { success: true, message: selfResponses[Math.floor(Math.random() * selfResponses.length)], type: "self" };
    }

    // =========================================================================
    // THE FIX: Enforce Season Phase Constraint
    // Prevent liquidating cards for Essence outside of the regular season
    // =========================================================================
    const { data: seasonData } = await supabase.from('seasons').select('phase').eq('is_active', true).single();
    if (seasonData?.phase !== 'season') {
        return { 
            success: true, 
            message: "THE MAW SLUMBERS. TRIBUTES ARE ONLY CONSUMED DURING THE REGULAR SEASON.", 
            type: "rejected" 
        };
    }

    // 2. Card Sacrifice Check 
    const { data: member } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
    
    if (member?.team_id) {
        // Look for non-keeper cards in their pool matching the exact name
        const { data: pick } = await supabase
            .from('team_draft_picks')
            .select('id, card_id, card_name, card_set, cubucks_cost, card_pool_id')
            .eq('team_id', member.team_id)
            .ilike('card_name', cleanOffer)
            .eq('is_keeper', false)
            .limit(1)
            .maybeSingle();

        if (pick) {
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

            const cardCost = pick.cubucks_cost || 1;
            const essenceReward = cardCost * 5; 

            // Drainlings hardcoded team UUID
            const DRAINLINGS_TEAM_ID = "90177632-f6ab-4501-b235-3590a7e46472";

            // 1. Transfer the card to the Drainlings in the active team picks table
            const { error: transferError } = await supabaseAdmin
                .from('team_draft_picks')
                .update({ 
                    team_id: DRAINLINGS_TEAM_ID, 
                    acquisition_method: 'drained',
                    scars: ['drained'] 
                })
                .eq('id', pick.id);

            if (transferError) {
                console.error("Transfer error:", transferError);
                return { success: true, message: "THE VOID SHUDDERS AND REJECTS YOUR OFFERING. AN ERROR OCCURRED.", type: "rejected" };
            }

            // 2. Update the card_pools pool_name to 'drainlings'
            if (pick.card_pool_id) {
                await supabaseAdmin.from('card_pools').update({ pool_name: 'drainlings' }).eq('id', pick.card_pool_id);
            }

            // 3. Write the receipt to the_drain ledger
            await supabaseAdmin.from('the_drain').insert({
                card_id: pick.card_id,
                card_name: pick.card_name,
                card_set: pick.card_set,
                sacrificed_by_user_id: user.id,
                sacrificed_by_team_id: member.team_id,
                cubucks_value_at_sacrifice: cardCost,
                essence_rewarded: essenceReward
            });

            // 4. Reward the User
            const { data: rewardData } = await supabaseAdmin.from('users').select('essence_balance, essence_total_earned').eq('id', user.id).single();
            if (rewardData) {
                await supabaseAdmin.from('users').update({
                    essence_balance: (rewardData.essence_balance || 0) + essenceReward,
                    essence_total_earned: (rewardData.essence_total_earned || 0) + essenceReward
                }).eq('id', user.id);

                await supabaseAdmin.from('essence_transactions').insert({
                    user_id: user.id, transaction_type: "grant", amount: essenceReward,
                    balance_after: (rewardData.essence_balance || 0) + essenceReward,
                    description: `Sacrifice Reward: "${pick.card_name}"`, created_by: user.id
                });
            }

            const cardResponses = [
                `THE CUBE ACCEPTS YOUR OFFERING. "${pick.card_name}" HAS BEEN CONSUMED. YOU RECEIVE ${essenceReward} ESSENCE.`,
                `<strong>A WORTHY TRIBUTE</strong>. "${pick.card_name}" IS GONE. TAKE THESE ${essenceReward} ESSENCE.`,
                `THE VOID SWALLOWS "${pick.card_name}" WHOLE. ${essenceReward} ESSENCE MATERIALIZES IN YOUR GRASP.`
            ];

            await logSystemEvent("TheDrain", "info", `User ${user.id} successfully sacrificed: ${pick.card_name} for ${essenceReward} Essence.`);
            return { success: true, message: cardResponses[Math.floor(Math.random() * cardResponses.length)], type: "card" };
        }
    }

    // Default Rejection 
    const rejectResponses = [
        "THE CUBE REJECTS THIS GIFT.",
        "<strong>WORTHLESS DROSS</strong>. THE CUBE REJECTS THIS GIFT.",
        "DO NOT INSULT THE ABYSS. THE CUBE REJECTS THIS GIFT."
    ];

    await logSystemEvent("TheDrain", "warn", `User ${user.id} offered invalid tribute: "${offer}"`);
    return { success: true, message: rejectResponses[Math.floor(Math.random() * rejectResponses.length)], type: "rejected" };
}
