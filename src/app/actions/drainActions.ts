// src/app/actions/drainActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// The hardcoded UUID for the Drainlings Team
const DRAINLINGS_TEAM_ID = "90177632-f6ab-4501-b235-3590a7e46472";
const sacrificeWarningCache = new Map<string, number>();

// =========================================================================
// RESPONSE GENERATORS
// =========================================================================
const getSelfSacrificeResponse = () => {
    const responses = [
        "THE CUBE ADMIRES YOUR COMMITMENT. PERHAPS WE WILL WELCOME YOU _ANOTHER TIME_.",
        "YOUR FLESH IS WILLING, BUT THE MAW IS CLOSED. WAIT.",
        "A NOBLE SACRIFICE. BUT THE CUBE DEMANDS PATIENCE."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getSelfSacrificeFinalResponse = () => {
    const responses = [
        "THE CUBE ACCEPTS YOUR FLESH. YOU ARE NOW ONE WITH THE DRAINLINGS OF THE BLIND ETERNITIES.",
        "YOUR ESSENCE UNRAVELS. THE VOID WELCOMES ITS NEWEST CHILD.",
        "YOU HAVE BEEN CONSUMED. WELCOME TO THE SHADOWS, DRAINLING."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getCardSacrificeResponse = (cardName: string, reward: number) => {
    const responses = [
        `THE CUBE ACCEPTS YOUR OFFERING. "${cardName}" HAS BEEN CONSUMED. YOU RECEIVE ${reward} ESSENCE.`,
        `A WORTHY TRIBUTE. "${cardName}" IS GONE. TAKE THESE ${reward} ESSENCE.`,
        `THE VOID SWALLOWS "${cardName}" WHOLE. ${reward} ESSENCE MATERIALIZES IN YOUR GRASP.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getOtherUserResponse = (username: string) => {
    const responses = [
        `WE WOULD GLADLY WELCOME ${username.toUpperCase()} TO THE VOID - BUT THEY MUST JOIN OF THEIR OWN ACCORD.`,
        `THE CUBE CANNOT STEAL A SOUL UNWILLINGLY. ${username.toUpperCase()} MUST OFFER THEMSELVES.`,
        `A TEMPTING SNACK, BUT COWARDLY. TELL ${username.toUpperCase()} TO FACE THE MAW THEMSELVES.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getCoolHatResponse = () => {
    const responses = [
        "YOUR SARTORIAL TASTE AMUSES THE CUBE. TAKE THIS ESSENCE AND BE GONE.",
        "A TRULY EXCELLENT ACCESSORY. THE MAW GRANTS YOU 500 ESSENCE IN EXCHANGE FOR YOUR FASHION SENSE.",
        "THE CUBE NODS APPROVINGLY. A REALLY COOL HAT DESERVES A REALLY COOL REWARD."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getCursedHatResponse = () => {
    const responses = [
        "THE VOID ACCEPTS YOUR CURSED BURDEN... ONLY TO RETURN IT HEAVIER. ENJOY YOUR NEW HAT.",
        "FOOL. YOU CANNOT DISCARD WHAT IS BOUND TO YOU. THE WITCH-SKIN HAT RETURNS, STRONGER THAN BEFORE.",
        "THE CUBE LAUGHS. IT TAKES THE HAT, STITCHES DARKER MAGIC INTO ITS BRIM, AND PLACES IT BACK UPON YOUR HEAD."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getFakeHatResponse = () => {
    const responses = [
        "YOUR TEAM POSSESSES NO SUCH HABERDASHERY. DO NOT LIE TO THE CUBE.",
        "THE MAW FINDS NOTHING ON YOUR HEAD TO CONSUME. COME BACK WITH A BETTER OFFER.",
        "YOU OFFER A HAT YOU DO NOT OWN. THE VOID IS UNAMUSED BY YOUR EMPTY HANDS."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getRegiftResponse = (cardName: string) => {
    const responses = [
        `THE CUBE RECOGNIZES THIS TRASH. YOU DARE OFFER "${cardName}" A SECOND TIME? WE ACCEPT, BUT WE ARE DISPLEASED.`,
        `WE HAVE TASTED THIS BEFORE. WE WILL CONSUME "${cardName}" AGAIN, BUT DO NOT TEST OUR PATIENCE.`,
        `A REGIFTED OFFERING? HOW PATHETIC. THE VOID TAKES "${cardName}", BUT REMEMBERS YOUR INSULT.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getExperimentalItemResponse = (itemName: string) => {
    const responses = [
        `YOUR TEAM'S REPEATED INSOLENCE HAS TRIGGERED AN ANOMALY. THE VOID SPITS OUT [ ${itemName.toUpperCase()} ].`,
        `THE PARADOX OF YOUR REGIFTING HAS MANIFESTED PHYSICAL FORM. YOUR TEAM ACQUIRES [ ${itemName.toUpperCase()} ].`,
        `FOR YOUR PERSISTENT IMPUDENCE, THE CUBE CURSES YOU WITH SCIENTIFIC BURDENS. YOU RECEIVED [ ${itemName.toUpperCase()} ].`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getFuturePickResponse = (round: number) => {
    const responses = [
        `YOUR FUTURE HAS BEEN SOLD. WE WILL DRAFT IN ROUND ${round} IN YOUR STEAD. YOUR ESSENCE WILL WAIT UNTIL THEN.`,
        `THE CUBE CLAIMS YOUR ROUND ${round} PICK. THE SHADOWS SHALL DRAFT FOR YOU. YOUR REWARD IS DEFERRED.`,
        `A GAMBLE WITH TIME ITSELF. THE MAW TAKES YOUR ROUND ${round} SLOT. YOU WILL BE PAID WHEN WE FEED.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getEssencePurchaseResponse = (cardName: string) => {
    const responses = [
        `YOUR WEALTH HAS DISTURBED THE POOL. "${cardName.toUpperCase()}" ESCAPES THE DRAIN AND ENTERS THE CHAMBER.`,
        `THE CUBE ACCEPTS YOUR BRIBE. "${cardName.toUpperCase()}" HAS BEEN EXPELLED TO THE CHAMBER.`,
        `MONEY TALKS, EVEN IN THE ABYSS. "${cardName.toUpperCase()}" FLOATS TO THE SURFACE AND RE-ENTERS THE CHAMBER.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getCubucksResponse = () => {
    const responses = [
        "CORPORATE SCRIP HAS NO POWER HERE. OFFER SOMETHING TANGIBLE.",
        "THE VOID DOES NOT ACCEPT FIAT CURRENCY. BE GONE.",
        "ÇUBUCKS HOLD NO WEIGHT IN THE BLIND ETERNITIES. WE REQUIRE FLESH, MAGIC, OR ESSENCE."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getSmartAleckResponse = () => {
    const responses = [
        "YOUR IMPERTINENCE IS NOTED. YOU CANNOT SACRIFICE THAT WHICH CONTAINS YOU.",
        "HOW HUMOROUS. YOU WISH TO FEED THE MAW TO ITSELF? THE CUBE REJECTS YOUR INSOLENCE.",
        "AN IMPOSSIBLE PARADOX. THE LEAGUE IS ETERNAL. DO NOT TEST OUR PATIENCE AGAIN."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getDefaultRejectResponse = () => {
    const responses = [
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
    if (Math.random() < 0.01) return "THE CUBE PUTS ON READING GLASSES, SQUINTS, SIGHS DEEPLY, AND SLIDES IT BACK ACROSS THE TABLE. THE CUBE REJECTS THIS GIFT.";
    return responses[Math.floor(Math.random() * responses.length)];
};


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

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // =========================================================================
    // SMART-ALECK CHECK (The Cube, The League)
    // =========================================================================
    if (["the cube", "cube", "dynasty cube", "dynastycube", "the league", "league"].includes(cleanOffer)) {
        sacrificeWarningCache.delete(user.id);
        await logSystemEvent("TheDrain", "warn", `User ${user.id} tried to sacrifice The Cube.`);
        return { success: true, message: getSmartAleckResponse(), type: "rejected" };
    }

    // =========================================================================
    // CUBUCKS CHECK (Rejects any variation of Cubucks/C/Ç)
    // =========================================================================
    if (/^\d+\s*(c|ç|cubucks|cubuck)$/i.test(cleanOffer) || /^(c|ç)\s*\d+$/i.test(cleanOffer)) {
        sacrificeWarningCache.delete(user.id);
        await logSystemEvent("TheDrain", "warn", `User ${user.id} tried to sacrifice Cubucks: ${cleanOffer}`);
        return { success: true, message: getCubucksResponse(), type: "rejected" };
    }

    // Fetch core user data
    const { data: userData } = await supabaseAdmin.from('users').select('display_name, discord_username, essence_balance').eq('id', user.id).single();
    const name1 = (userData?.display_name || "").toLowerCase();
    const name2 = (userData?.discord_username || "").toLowerCase();
    const currentEssence = userData?.essence_balance || 0;

    const { data: member } = await supabaseAdmin.from('team_members').select('team_id').eq('user_id', user.id).single();

    // =========================================================================
    // 1. SELF SACRIFICE CHECK (The 3-Step Warning)
    // =========================================================================
    if (cleanOffer === name1 || cleanOffer === name2) {
        const currentMembership = member;

        if (currentMembership && currentMembership.team_id === DRAINLINGS_TEAM_ID) {
            return { success: true, message: "YOU ARE ALREADY ONE WITH THE VOID. THERE IS NOTHING LEFT TO CONSUME.", type: "self" };
        }

        const currentStep = sacrificeWarningCache.get(user.id) || 0;

        if (currentStep === 0) {
            sacrificeWarningCache.set(user.id, 1);
            return { success: true, message: "YOUR FLESH IS WILLING, BUT THE MAW IS WIDE. ARE YOU PREPARED TO ABANDON YOUR ALIGNMENT? SPEAK YOUR NAME AGAIN TO AFFIRM.", type: "self" };
        } 
        
        if (currentStep === 1) {
            sacrificeWarningCache.set(user.id, 2);
            return { success: true, message: "THE BLIND ETERNITIES STIR. THERE IS NO RETURN FROM THE ABYSS. IF YOU TRULY WISH TO UNRAVEL, SPEAK YOUR NAME ONE FINAL TIME.", type: "self" };
        }

        // STEP 3: Complete Sacrifice
        sacrificeWarningCache.delete(user.id); 

        if (currentMembership) {
            await supabaseAdmin.from('team_member_roles').delete().eq('team_member_id', currentMembership.id);
            await supabaseAdmin.from('team_members').delete().eq('id', currentMembership.id);
        }

        await supabaseAdmin.from('team_members').insert({
            user_id: user.id, team_id: DRAINLINGS_TEAM_ID, user_email: userData?.display_name || userData?.discord_username || user.email
        });

        await logSystemEvent("TheDrain", "warn", `User ${user.id} sacrificed themselves and joined the Drainlings.`);
        return { success: true, message: getSelfSacrificeFinalResponse(), type: "self" };
    }

    // Reset warning cache if they type anything else
    sacrificeWarningCache.delete(user.id);

    // =========================================================================
    // 2. OTHER USER SACRIFICE CHECK
    // =========================================================================
    const { data: otherUser } = await supabaseAdmin.from('users').select('id, display_name').or(`display_name.ilike.${cleanOffer},discord_username.ilike.${cleanOffer}`).single();
    if (otherUser) {
        await logSystemEvent("TheDrain", "info", `User ${user.id} tried to sacrifice another user: ${otherUser.display_name}`);
        return { success: true, message: getOtherUserResponse(otherUser.display_name || cleanOffer), type: "rejected" };
    }

    // =========================================================================
    // 3. ESSENCE PURCHASE MECHANIC (Retrieve random card from Drainlings to Chamber)
    // =========================================================================
    // Match strings like "150e", "150 essence", "€150"
    const essenceMatch = cleanOffer.match(/^(\d+)\s*(e|essence|€)$/i) || cleanOffer.match(/^(€)\s*(\d+)$/i);
    if (essenceMatch) {
        const bidAmount = parseInt(essenceMatch[1] || essenceMatch[2], 10);

        if (bidAmount <= currentEssence) {
            // Find ALL cards in the drainlings pool
            const { data: drainCards } = await supabaseAdmin.from('team_draft_picks').select('id, card_id, card_name, cubucks_cost, card_pool_id').eq('team_id', DRAINLINGS_TEAM_ID);
            
            if (drainCards && drainCards.length > 0) {
                // Filter eligible cards where bid >= 12x the card's cubuck cost
                const eligibleCards = drainCards.filter(c => bidAmount >= ((c.cubucks_cost || 1) * 12));
                
                if (eligibleCards.length > 0) {
                    // Pick a random eligible card
                    const randomCard = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];

                    // Deduct Essence
                    const newBalance = currentEssence - bidAmount;
                    await supabaseAdmin.from('users').update({ essence_balance: newBalance }).eq('id', user.id);
                    await supabaseAdmin.from('essence_transactions').insert({
                        user_id: user.id, transaction_type: "spend", amount: -bidAmount, balance_after: newBalance, description: `Drain Retrieval Bid: ${bidAmount}E`, created_by: user.id
                    });

                    // Remove from Drainlings roster
                    await supabaseAdmin.from('team_draft_picks').delete().eq('id', randomCard.id);

                    // Re-insert to The Chamber!
                    if (randomCard.card_pool_id) {
                        await supabaseAdmin.from('card_pools').update({ pool_name: 'the_chamber' }).eq('id', randomCard.card_pool_id);
                    }

                    await logSystemEvent("TheDrain", "info", `User ${user.id} spent ${bidAmount} Essence to retrieve ${randomCard.card_name} back to The Chamber.`);
                    return { success: true, message: getEssencePurchaseResponse(randomCard.card_name), type: "card" };
                }
            }
        }
    }

    // =========================================================================
    // TEAM-GATED CHECKS (Hats, Future Picks, Current Cards)
    // =========================================================================
    if (member?.team_id) {

        // --- HAT LOGIC ---
        if (cleanOffer.endsWith("hat") && cleanOffer.trim().split(" ").length > 1) {
            // Check if team owns this specific hat
            const { data: ownedHats } = await supabaseAdmin.from('team_hats').select(`id, hat_id, quantity, hats:hats!inner(hatName)`).eq('team_id', member.team_id);
            
            const matchingHat = (ownedHats || []).find(h => {
                const hatObj = Array.isArray(h.hats) ? h.hats[0] : h.hats;
                return hatObj?.hatName?.toLowerCase().includes(cleanOffer.replace(/the|a|an/gi, '').trim());
            });

            if (matchingHat) {
                const hatData = Array.isArray(matchingHat.hats) ? matchingHat.hats[0] : matchingHat.hats;
                const hatName = hatData?.hatName?.toLowerCase() || "";

                if (hatName.includes("really cool hat")) {
                    await supabaseAdmin.from('team_hats').delete().eq('id', matchingHat.id); // Destroy Hat
                    // Reward 500 Essence
                    await supabaseAdmin.from('users').update({ essence_balance: currentEssence + 500 }).eq('id', user.id);
                    await logSystemEvent("TheDrain", "info", `User ${user.id} sacrificed A Really Cool Hat for 500 Essence.`);
                    return { success: true, message: getCoolHatResponse(), type: "card" };
                }
                
                if (hatName.includes("cursed") || hatName.includes("witch")) {
                    // Level it up (worsening the curse) and feign acceptance!
                    const { data: hatDefinition } = await supabaseAdmin.from('hats').select('hatLevel').eq('hatId', matchingHat.hat_id).single();
                    if (hatDefinition) {
                        // Increase overage/curse severity
                        await supabaseAdmin.from('team_hats').update({ highest_overage: (matchingHat.highest_overage || hatDefinition.hatLevel || 1) + 1 }).eq('id', matchingHat.id);
                        await logSystemEvent("TheDrain", "info", `User ${user.id} tried to sacrifice the Cursed Hat. It leveled up instead.`);
                        return { success: true, message: getCursedHatResponse(), type: "card" };
                    }
                }
            } else {
                // Phrase ends in Hat, has multiple words, but they don't own it
                return { success: true, message: getFakeHatResponse(), type: "rejected" };
            }
        }

        // --- FUTURE DRAFT PICK LOGIC ---
        // Matches inputs like "Round 2 pick", "Draft pick round 3"
        const pickMatch = cleanOffer.match(/round\s*(\d+)/i) || cleanOffer.match(/(\d+)(st|nd|rd|th)?\s*round/i);
        if (pickMatch && cleanOffer.includes("pick")) {
            const roundNum = parseInt(pickMatch[1], 10);
            
            // Check if they own this future pick
            const { data: futurePick } = await supabaseAdmin.from('future_draft_picks').select('id, season_id').eq('team_id', member.team_id).eq('round_number', roundNum).single();
            
            if (futurePick) {
                // Trade the pick to the Drainlings!
                await supabaseAdmin.from('future_draft_picks').update({
                    team_id: DRAINLINGS_TEAM_ID,
                    traded_to_team_id: DRAINLINGS_TEAM_ID,
                    is_traded: true
                }).eq('id', futurePick.id);

                await logSystemEvent("TheDrain", "info", `User ${user.id} sacrificed Round ${roundNum} future pick to The Drainlings.`);
                return { success: true, message: getFuturePickResponse(roundNum), type: "card" };
            }
        }

        // --- STANDARD CARD SACRIFICE LOGIC ---
        // Enforce Season Phase Constraint for Card Sacrifices
        const { data: seasonData } = await supabaseAdmin.from('seasons').select('phase').eq('is_active', true).single();
        if (seasonData?.phase !== 'season') {
            return { success: true, message: "THE MAW SLUMBERS. TRIBUTES ARE ONLY CONSUMED DURING THE REGULAR SEASON.", type: "rejected" };
        }

        const { data: pick } = await supabaseAdmin.from('team_draft_picks').select('id, card_id, card_name, card_set, cubucks_cost, card_pool_id').eq('team_id', member.team_id).ilike('card_name', cleanOffer).eq('is_keeper', false).limit(1).maybeSingle();

        if (pick) {
            const cardCost = pick.cubucks_cost || 1;
            const essenceReward = cardCost * 5; 

            // Check REGIFTING (Has this card been sacrificed before?)
            const { data: previousSacrifice } = await supabaseAdmin.from('the_drain').select('id').eq('card_id', pick.card_id).limit(1).maybeSingle();
            let isRegift = !!previousSacrifice;

            // 1. Transfer the card to the Drainlings
            const { error: transferError } = await supabaseAdmin.from('team_draft_picks').update({ team_id: DRAINLINGS_TEAM_ID, acquisition_method: 'drained', scars: ['drained'] }).eq('id', pick.id);
            if (transferError) return { success: true, message: "THE VOID SHUDDERS AND REJECTS YOUR OFFERING. AN ERROR OCCURRED.", type: "rejected" };

            // 2. Update the card_pools pool_name to 'drainlings'
            if (pick.card_pool_id) await supabaseAdmin.from('card_pools').update({ pool_name: 'drainlings' }).eq('id', pick.card_pool_id);

            // 3. Write the receipt to the_drain ledger
            await supabaseAdmin.from('the_drain').insert({
                card_id: pick.card_id, card_name: pick.card_name, card_set: pick.card_set, sacrificed_by_user_id: user.id, sacrificed_by_team_id: member.team_id, cubucks_value_at_sacrifice: cardCost, essence_rewarded: essenceReward
            });

            // 4. Reward the User
            await supabaseAdmin.from('users').update({
                essence_balance: currentEssence + essenceReward, essence_total_earned: (userData?.essence_total_earned || 0) + essenceReward
            }).eq('id', user.id);

            await supabaseAdmin.from('essence_transactions').insert({
                user_id: user.id, transaction_type: "grant", amount: essenceReward, balance_after: currentEssence + essenceReward, description: `Sacrifice Reward: "${pick.card_name}"`, created_by: user.id
            });

            let finalMsg = getCardSacrificeResponse(pick.card_name, essenceReward);

            // 5. Apply Regift/Experimental Item logic
            if (isRegift) {
                finalMsg = getRegiftResponse(pick.card_name);
                
                // Check if any other teammate has regifted before!
                const { data: teamRegifts } = await supabaseAdmin.from('the_drain').select('id').eq('sacrificed_by_team_id', member.team_id).neq('sacrificed_by_user_id', user.id).limit(1);
                
                if (teamRegifts && teamRegifts.length > 0) {
                    // Grant an experimental item! (Find one not currently assigned)
                    const { data: unassignedItem } = await supabaseAdmin.from('experimental_items').select('id, item_name').is('current_team_id', null).limit(1).maybeSingle();
                    if (unassignedItem) {
                        await supabaseAdmin.from('experimental_items').update({ current_team_id: member.team_id, granted_at: new Date().toISOString() }).eq('id', unassignedItem.id);
                        finalMsg += `\n\n${getExperimentalItemResponse(unassignedItem.item_name)}`;
                    }
                }
            }

            await logSystemEvent("TheDrain", "info", `User ${user.id} successfully sacrificed: ${pick.card_name} for ${essenceReward} Essence. Regift: ${isRegift}`);
            return { success: true, message: finalMsg, type: "card" };
        }
    }

    // =========================================================================
    // 4. DEFAULT REJECTION
    // =========================================================================
    await logSystemEvent("TheDrain", "warn", `User ${user.id} offered invalid tribute: "${offer}"`);
    return { success: true, message: getDefaultRejectResponse(), type: "rejected" };
}
