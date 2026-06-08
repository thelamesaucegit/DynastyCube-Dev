// src/app/actions/drainActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

export async function offerToTheDrain(offer: string): Promise<{ success: boolean; message: string; type: "card" | "self" | "rejected" | "unauthenticated" }> {
       // Maximum MTG card name length is usually under 50 chars. 150 is plenty safe.
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
            "THE CUBE ADMIRES YOUR COMMITMENT. PERHAPS WE WILL WELCOME YOU _ANOTHER TIME_.",
            "YOUR FLESH IS WILLING, BUT THE MAW IS CLOSED. WAIT.",
            "A NOBLE SACRIFICE. BUT THE CUBE DEMANDS PATIENCE."
        ];
        await logSystemEvent("TheDrain", "info", `User ${user.id} attempted self-sacrifice.`);
        return { success: true, message: selfResponses[Math.floor(Math.random() * selfResponses.length)], type: "self" };
    }

    // 2. Card Sacrifice Check (Must be on a team, and must own the non-keeper card)
    const { data: member } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).single();
    
    if (member?.team_id) {
        // Look for non-keeper cards in their pool matching the exact name
        const { data: pick } = await supabase
            .from('team_draft_picks')
            .select('id, card_name')
            .eq('team_id', member.team_id)
            .ilike('card_name', cleanOffer)
            .eq('is_keeper', false)
            .limit(1)
            .maybeSingle();

        if (pick) {
            const cardResponses = [
                "THE CUBE IS NOT YET READY TO ACCEPT THIS GIFT.",
                "THE DRAIN SLUMBERS. YOUR TRIBUTE IS PREMATURE.",
                "THE VOID STIRS, BUT CANNOT YET CONSUME."
            ];
            await logSystemEvent("TheDrain", "info", `User ${user.id} attempted to sacrifice card: ${pick.card_name}`);
            return { success: true, message: cardResponses[Math.floor(Math.random() * cardResponses.length)], type: "card" };
        }
    }

    // 3. Default Rejection (Not a card they own, not themselves)
    const rejectResponses = [
        "THE CUBE REJECTS THIS GIFT.",
        "WORTHLESS DROSS. THE CUBE REJECTS THIS GIFT.",
        "DO NOT INSULT THE ABYSS. THE CUBE REJECTS THIS GIFT.",
        "A PATHETIC OFFERING. THE CUBE REJECTS THIS GIFT.",
        "THE MAW SPITS IT BACK. THE CUBE REJECTS THIS GIFT.",
        "YOU OFFER NOTHING OF VALUE. THE CUBE REJECTS THIS GIFT.",
        "THE DRAIN REMAINS EMPTY. THE CUBE REJECTS THIS GIFT.",
        "INSUFFICIENT TRIBUTE. THE CUBE REJECTS THIS GIFT.",
        "THE VOID FINDS NO NOURISHMENT HERE. THE CUBE REJECTS THIS GIFT.",
        "AN OFFENSE TO THE ETERNITIES. THE CUBE REJECTS THIS GIFT.",
        "ASH AND DUST. THE CUBE REJECTS THIS GIFT.",
        "THE SHADOWS TURN AWAY IN DISGUST. THE CUBE REJECTS THIS GIFT."
    ];

    let finalMessage = "";

    // 1% chance for the ultra-rare absurdity
    if (Math.random() < 0.01) {
        finalMessage = "THE CUBE PUTS ON READING GLASSES, SQUINTS, SIGHS DEEPLY, AND SLIDES IT BACK ACROSS THE TABLE. THE CUBE REJECTS THIS GIFT.";
    } else {
        finalMessage = rejectResponses[Math.floor(Math.random() * rejectResponses.length)];
    }
    
    await logSystemEvent("TheDrain", "warn", `User ${user.id} offered invalid tribute: "${offer}"`);
    return { success: true, message: finalMessage, type: "rejected" };
}
