// src/app/actions/drainActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// Hardcoded UUID for the Drainlings
const DRAINLINGS_TEAM_ID = "90177632-f6ab-4501-b235-3590a7e46472";

// Temporary in-memory session cache to hold warning progressions across the server environment.
const sacrificeWarningCache = new Map<string, number>();

// Strict interface to remove 'any' from the Hat logic
interface TeamHatRecord {
    id: string;
    hat_id: number;
    quantity: number;
    hats: { hatName: string } | { hatName: string }[] | null;
}

// =========================================================================
// RESPONSE GENERATORS (3+ responses for every outcome)
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
        `THE VOID IS INTRIGUED BY YOUR RELENTLESS CURIOSITY. YOUR IMPUDENT REGIFTING HAS MANIFESTED A PHYSICAL ANOMALY. YOUR TEAM GRASPS [ ${itemName.toUpperCase()} ].`,
        `REPETITION BREEDS PARADOX. THE CUBE FINDS YOUR PERSISTENT EXPERIMENTATION AMUSING. IT SPITS OUT [ ${itemName.toUpperCase()} ] AS A REWARD FOR YOUR HUBRIS.`,
        `YOUR TEAM TEARS AT THE FABRIC OF RULES WITH THIS REGIFTING. THE RESULTING TEAR YIELDS SCIENTIFIC RESIDUE. YOU HAVE ACQUIRED [ ${itemName.toUpperCase()} ].`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};

const getFuturePickResponse = (round: number) => {
    const responses = [
        `YOUR FUTURE HAS BEEN SOLD. THE DRAINLINGS WILL DRAFT IN ROUND ${round} IN YOUR STEAD. YOUR ESSENCE WILL WAIT UNTIL THEN.`,
        `THE CUBE CLAIMS YOUR ROUND ${round} PICK. THE SHADOWS SHALL DRAFT FOR YOU. YOUR REWARD IS DEFERRED.`,
        `A GAMBLE WITH TIME ITSELF. THE MAW TAKES YOUR ROUND ${round} SLOT. YOU WILL BE PAID WHEN THE DRAINLINGS FEED.`
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

    // THE FIX: Included 'essence_total_earned' in the select payload!
    const { data: userData } = await supabaseAdmin.from('users').select('display_name, discord_username, essence_balance, essence_total_earned').eq('id', user.id).single();
    const name1 = (userData?.display_name || "").toLowerCase();
    const name2 = (userData?.discord_username || "").toLowerCase();
    const currentEssence = userData?.essence_balance || 0;
    const currentTotalEarned = userData?.essence_total_earned || 0;

    const { data: member } = await supabaseAdmin.from('team_members').select('id, team_id').eq('user_id', user.id).single();
    const teamId = member?.team_id || null;

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

        if (currentMembership && currentMembership.id) {
            await supabaseAdmin.from('team_member_roles').delete().eq('team_member_id', currentMembership.id);
            await supabaseAdmin.from('team_members').delete().eq('id', currentMembership.id);
        }

        await supabaseAdmin.from('team_members').insert({
            user_id: user.id, team_id: DRAINLINGS_TEAM_ID, user_email: userData?.display_name || userData?.discord_username || user.email
        });

        await logSystemEvent("TheDrain", "warn", `User ${user.id} sacrificed themselves and joined the Drainlings.`);
        return { success: true, message: getSelfSacrificeFinalResponse(), type: "self" };
    }

    sacrificeWarningCache.delete(user.id);

    // =========================================================================
    // 2. OTHER USERNAME SACRIFICE CHECK
    // =========================================================================
    const { data: otherUser } = await supabaseAdmin.from('users').select('id, display_name').or(`display_name.ilike.${cleanOffer},discord_username.ilike.${cleanOffer}`).maybeSingle();
    if (otherUser && otherUser.id !== user.id) {
        await logSystemEvent("TheDrain", "info", `User ${user.id} tried to sacrifice another user: ${otherUser.display_name}`);
        return { success: true, message: getOtherUserResponse(otherUser.display_name || cleanOffer), type: "rejected" };
    }

    // =========================================================================
    // 3. ESSENCE PURCHASE MECHANIC (Retrieve random card from Drainlings to Chamber)
    // =========================================================================
    const essenceMatch = cleanOffer.match(/^[\s]*[€e]?[\s]*(essence)?[\s]*(\d+)[\s]*[€e]?[\s]*(essence)?[\s]*$/i);
    if (essenceMatch) {
        const amount = parseInt(essenceMatch[2], 10);

        if (amount <= currentEssence) {
            const { data: drainCards } = await supabaseAdmin.from('team_draft_picks').select('id, card_id, card_name, cubucks_cost, card_pool_id').eq('team_id', DRAINLINGS_TEAM_ID);
            
            if (drainCards && drainCards.length > 0) {
                const eligibleCards = drainCards.filter(c => amount >= ((c.cubucks_cost || 1) * 12));
                
                if (eligibleCards.length > 0) {
                    const randomCard = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
                    const newBalance = currentEssence - amount;
                    
                    await supabaseAdmin.from('users').update({ essence_balance: newBalance }).eq('id', user.id);
                    await supabaseAdmin.from('essence_transactions').insert({
                        user_id: user.id, transaction_type: "spend", amount: -amount, balance_after: newBalance, description: `Drain Retrieval Bid: ${amount}E`, created_by: user.id
                    });

                    await supabaseAdmin.from('team_draft_picks').delete().eq('id', randomCard.id);

                    if (randomCard.card_pool_id) {
                        await supabaseAdmin.from('card_pools').update({ pool_name: 'the_chamber', was_drafted: false }).eq('id', randomCard.card_pool_id);
                    }

                    await logSystemEvent("TheDrain", "info", `User ${user.id} spent ${amount} Essence to retrieve ${randomCard.card_name} back to The Chamber.`);
                    return { success: true, message: getEssencePurchaseResponse(randomCard.card_name), type: "card" };
                }
            }
        }
    }

    // =========================================================================
    // REQUIRE TEAM MEMBERSHIP FROM THIS POINT ON
    // =========================================================================
    if (!teamId) {
        return { success: true, message: "ONLY THOSE BOUND TO A TEAM MAY OFFER TRIBUTE.", type: "rejected" };
    }

    // =========================================================================
    // 6. FUTURE DRAFT PICK SACRIFICE
    // =========================================================================
    const pickMatch = cleanOffer.match(/(?:my )?(?:next |future )?(?:draft )?pick(?: in )?(?:round )?(\d+)?/i);
    if (pickMatch) {
        const roundNum = pickMatch[1] ? parseInt(pickMatch[1], 10) : 1; 

        const { data: activeSeason } = await supabaseAdmin.from('seasons').select('id, phase').eq('is_active', true).single();
        if (activeSeason) {
            const { data: futurePick } = await supabaseAdmin.from('future_draft_picks')
                .select('id')
                .eq('season_id', activeSeason.id)
                .eq('original_team_id', teamId)
                .eq('round_number', roundNum)
                .single();
            
            if (futurePick) {
                await supabaseAdmin.from('future_draft_picks').update({
                    traded_to_team_id: DRAINLINGS_TEAM_ID,
                    is_traded: true
                }).eq('id', futurePick.id);

                await logSystemEvent("TheDrain", "info", `Team ${teamId} sacrificed Round ${roundNum} future pick to The Drainlings.`);
                return { success: true, message: getFuturePickResponse(roundNum), type: "card" };
            }
        }
    }

    // =========================================================================
    // 7. HAT SACRIFICE
    // =========================================================================
    if (cleanOffer.endsWith("hat")) {
        const { data: teamHats } = await supabaseAdmin.from('team_hats').select(`id, hat_id, quantity, hats!inner(hatName)`).eq('team_id', teamId);
        
        // THE FIX: Explicitly mapped via the TeamHatRecord interface to avoid "any"
        const typedTeamHats = (teamHats || []) as unknown as TeamHatRecord[];
        const matchingHat = typedTeamHats.find((h) => {
            const hatObj = Array.isArray(h.hats) ? h.hats[0] : h.hats;
            return hatObj?.hatName?.toLowerCase().includes(cleanOffer.replace(/the|a|an/gi, '').trim());
        });

        if (matchingHat) {
            const rawHatData = Array.isArray(matchingHat.hats) ? matchingHat.hats[0] : matchingHat.hats;
            const hatName = rawHatData?.hatName || "Hat";
            const hatId = matchingHat.hat_id;

            if (matchingHat.quantity > 1) {
                await supabaseAdmin.from('team_hats').update({ quantity: matchingHat.quantity - 1 }).eq('id', matchingHat.id);
            } else {
                await supabaseAdmin.from('team_hats').delete().eq('id', matchingHat.id);
            }

            if (hatId === 1) {
                await supabaseAdmin.from('users').update({ 
                    essence_balance: currentEssence + 500, 
                    essence_total_earned: currentTotalEarned + 500 
                }).eq('id', user.id);
                
                await supabaseAdmin.from('essence_transactions').insert({ 
                    user_id: user.id, transaction_type: "grant", amount: 500, balance_after: currentEssence + 500, description: `Sacrificed A Really Cool Hat`, created_by: user.id 
                });

                return { success: true, message: getCoolHatResponse(), type: "card" };
            }

            if (hatId === 2) {
                await supabaseAdmin.from('team_hats').insert({ team_id: teamId, hat_id: 3, quantity: 1 }); 
                return { success: true, message: getCursedHatResponse(), type: "rejected" };
            }

            return { success: true, message: `THE CUBE ACCEPTS YOUR TRIBUTE. "${hatName}" HAS BEEN CONSUMED.`, type: "card" };
        } else {
            const words = cleanOffer.split(' ');
            const nonArticles = words.filter(w => !['the', 'a', 'an'].includes(w));
            if (nonArticles.length > 1) {
                return { success: true, message: getFakeHatResponse(), type: "rejected" };
            }
        }
    }

    // =========================================================================
    // Enforce Season Phase Constraint for Card Sacrifices
    // =========================================================================
    const { data: seasonData } = await supabase.from('seasons').select('phase').eq('is_active', true).single();
    if (seasonData?.phase !== 'season') {
        return { success: true, message: "THE MAW SLUMBERS. TRIBUTES ARE ONLY CONSUMED DURING THE REGULAR SEASON.", type: "rejected" };
    }

    // =========================================================================
    // 8. CARD SACRIFICE
    // =========================================================================
    const { data: pick } = await supabaseAdmin
        .from('team_draft_picks')
        .select('id, card_id, card_name, card_set, cubucks_cost, card_pool_id')
        .eq('team_id', teamId)
        .ilike('card_name', cleanOffer)
        .eq('is_keeper', false)
        .limit(1)
        .maybeSingle();

    if (pick) {
        const { data: prevDrain } = await supabaseAdmin.from('the_drain').select('id').eq('card_id', pick.card_id).limit(1).maybeSingle();
        
        const cardCost = pick.cubucks_cost || 1;
        const essenceReward = cardCost * 5; 

        await supabaseAdmin.from('team_draft_picks').update({ team_id: DRAINLINGS_TEAM_ID, acquisition_method: 'drained', scars: ['drained'] }).eq('id', pick.id);

        if (pick.card_pool_id) {
            await supabaseAdmin.from('card_pools').update({ pool_name: 'drainlings' }).eq('id', pick.card_pool_id);
        }

        await supabaseAdmin.from('the_drain').insert({
            card_id: pick.card_id, card_name: pick.card_name, card_set: pick.card_set, sacrificed_by_user_id: user.id, sacrificed_by_team_id: teamId, cubucks_value_at_sacrifice: cardCost, essence_rewarded: essenceReward
        });

        await supabaseAdmin.from('users').update({ essence_balance: currentEssence + essenceReward, essence_total_earned: currentTotalEarned + essenceReward }).eq('id', user.id);
        await supabaseAdmin.from('essence_transactions').insert({
            user_id: user.id, transaction_type: "grant", amount: essenceReward, balance_after: currentEssence + essenceReward, description: `Sacrifice Reward: "${pick.card_name}"`, created_by: user.id
        });

        let finalMsg = getCardSacrificeResponse(pick.card_name, essenceReward);

        if (prevDrain) {
            finalMsg = getRegiftResponse(pick.card_name);
            const { data: teamRegifts } = await supabaseAdmin.from('the_drain').select('id').eq('sacrificed_by_team_id', teamId).neq('sacrificed_by_user_id', user.id).limit(1);
            
            if (teamRegifts && teamRegifts.length > 0) {
                const { data: unassignedItem } = await supabaseAdmin.from('experimental_items').select('id, item_name').is('current_team_id', null).limit(1).maybeSingle();
                
                if (unassignedItem) {
                    await supabaseAdmin.from('experimental_items').update({ current_team_id: teamId, granted_at: new Date().toISOString() }).eq('id', unassignedItem.id);
                    finalMsg += `\n\n${getExperimentalItemResponse(unassignedItem.item_name)}`;
                }
            }
        }

        await logSystemEvent("TheDrain", "info", `User ${user.id} successfully sacrificed: ${pick.card_name} for ${essenceReward} Essence. Regift: ${!!prevDrain}`);
        return { success: true, message: finalMsg, type: "card" };
    }

    // =========================================================================
    // 9. DEFAULT REJECTION
    // =========================================================================
    await logSystemEvent("TheDrain", "warn", `User ${user.id} offered invalid tribute: "${offer}"`);
    return { success: true, message: getDefaultRejectResponse(), type: "rejected" };
}
