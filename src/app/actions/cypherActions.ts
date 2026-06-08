// src/app/actions/cypherActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";
import { logSystemEvent } from "@/lib/systemLogger";

// ============================================================================
// TYPES
// ============================================================================
export interface CypherToken {
    text: string;
    isWord: boolean;
    isRevealed: boolean;
    wordIndex?: number; 
    length?: number;
}

export interface ObfuscatedCypher {
    id: string;
    title: string;
    tokens: CypherToken[];
    created_at: string;
}

// ============================================================================
// ADMIN ACTIONS
// ============================================================================
export async function getAdminCyphers() {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('cyphers').select('*').order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, cyphers: data };
}

export async function saveCypher(id: string | null, title: string, content: string, is_published: boolean) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (id) {
        const { error } = await supabase.from('cyphers').update({ title, content, is_published }).eq('id', id);
        if (error) return { success: false, error: error.message };
    } else {
        const { error } = await supabase.from('cyphers').insert({ title, content, is_published, created_by: user?.id });
        if (error) return { success: false, error: error.message };
    }
    return { success: true };
}

// ============================================================================
// USER ACTIONS (THE ENGINE)
// ============================================================================
export async function getObfuscatedCyphers(): Promise<{ success: boolean; cyphers?: ObfuscatedCypher[]; error?: string }> {
    try {
        const supabase = await createServerClient();
        
        // Fetch published cyphers and their revealed words
        const { data: cyphers } = await supabase.from('cyphers').select('*').eq('is_published', true).order('created_at', { ascending: true });
        const { data: revealed } = await supabase.from('cypher_revealed_words').select('cypher_id, word');

        if (!cyphers) return { success: true, cyphers: [] };

        const revealedMap = new Map<string, Set<string>>();
        revealed?.forEach(r => {
            if (!revealedMap.has(r.cypher_id)) revealedMap.set(r.cypher_id, new Set());
            revealedMap.get(r.cypher_id)!.add(r.word.toLowerCase());
        });

        const obfuscatedCyphers: ObfuscatedCypher[] = cyphers.map(cypher => {
            const revealedSet = revealedMap.get(cypher.id) || new Set();
            const tokens: CypherToken[] = [];
            
            // Regex matches words containing letters and apostrophes
            const regex = /([a-zA-Z']+)/g;
            let lastIndex = 0;
            let match;
            let wordIndexCounter = 0;

            while ((match = regex.exec(cypher.content)) !== null) {
                // Push leading punctuation/spaces
                if (match.index > lastIndex) {
                    tokens.push({ text: cypher.content.slice(lastIndex, match.index), isWord: false, isRevealed: true });
                }
                
                const word = match[0];
                const cleanWord = word.toLowerCase();
                const isRevealed = revealedSet.has(cleanWord);
                
                tokens.push({
                    text: isRevealed ? word : "█".repeat(word.length),
                    isWord: true,
                    isRevealed,
                    wordIndex: wordIndexCounter,
                    length: word.length
                });
                
                wordIndexCounter++;
                lastIndex = regex.lastIndex;
            }
            // Push trailing punctuation/spaces
            if (lastIndex < cypher.content.length) {
                tokens.push({ text: cypher.content.slice(lastIndex), isWord: false, isRevealed: true });
            }

            return { id: cypher.id, title: cypher.title, tokens, created_at: cypher.created_at };
        });

        return { success: true, cyphers: obfuscatedCyphers };
    } catch (e) {
        return { success: false, error: "Failed to fetch cyphers." };
    }
}

export async function submitCypherGuess(cypherId: string, guess: string): Promise<{ success: boolean; message?: string; earned?: number; error?: string }> {
        // The longest word in the English dictionary is 45 letters. 
    if (guess.length > 50) {
        return { success: false, error: "Guess is too long." };
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const cleanGuess = guess.trim().toLowerCase();
    if (!cleanGuess) return { success: false, error: "Empty guess." };

    const { data: cypher } = await supabase.from('cyphers').select('content').eq('id', cypherId).single();
    if (!cypher) return { success: false, error: "Cypher not found." };

    // --- THE FIX: Cast the entire Array.from output BEFORE calling .map() ---
    const allWords = (Array.from(cypher.content.matchAll(/([a-zA-Z']+)/g)) as RegExpMatchArray[]).map(m => m[0].toLowerCase());
    
    if (!allWords.includes(cleanGuess)) {
        return { success: false, error: "Incorrect. That word is not hidden in this Cypher." };
    }

    // Check if it was already guessed by someone else
    const { data: existing } = await supabase.from('cypher_revealed_words').select('id').eq('cypher_id', cypherId).eq('word', cleanGuess).single();
    if (existing) {
        return { success: false, error: "Correct! But someone else already revealed this word." };
    }

    // Insert the discovery
    const { error: insertErr } = await supabase.from('cypher_revealed_words').insert({
        cypher_id: cypherId,
        word: cleanGuess,
        revealed_by: user.id,
        method: 'guess'
    });

    if (insertErr) return { success: false, error: "Database error. Someone may have just guessed it!" };

    // Grant Essence!
    const reward = cleanGuess.length; // 1 Essence per letter
    
    const { data: userData } = await supabase.from('users').select('essence_balance, essence_total_earned').eq('id', user.id).single();
    
    if (userData) {
        await supabase.from('users').update({
            essence_balance: (userData.essence_balance || 0) + reward,
            essence_total_earned: (userData.essence_total_earned || 0) + reward
        }).eq('id', user.id);

        await supabase.from('essence_transactions').insert({
            user_id: user.id, transaction_type: "grant", amount: reward,
            balance_after: (userData.essence_balance || 0) + reward,
            description: `Cypher Decode Reward: "${cleanGuess}"`, created_by: user.id
        });
    }

    return { success: true, earned: reward, message: `Brilliant! You revealed "${cleanGuess}" and earned ${reward} Essence!` };
}

export async function purchaseCypherWord(cypherId: string, wordIndex: number): Promise<{ success: boolean; message?: string; error?: string }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: cypher } = await supabase.from('cyphers').select('content').eq('id', cypherId).single();
    if (!cypher) return { success: false, error: "Cypher not found." };

    // --- THE FIX: Cast the entire Array.from output BEFORE calling .map() ---
    const regex = /([a-zA-Z']+)/g;
    const allWords = (Array.from(cypher.content.matchAll(regex)) as RegExpMatchArray[]).map(m => m[0]);
    
    if (wordIndex < 0 || wordIndex >= allWords.length) return { success: false, error: "Invalid word target." };
    
    const targetWord = allWords[wordIndex];
    const cleanWord = targetWord.toLowerCase();
    const cost = targetWord.length * 2; // 2 Essence per letter

    // Check if already revealed
    const { data: existing } = await supabase.from('cypher_revealed_words').select('id').eq('cypher_id', cypherId).eq('word', cleanWord).single();
    if (existing) return { success: false, error: "This word has already been revealed!" };

    // Check Balance
    const { data: userData } = await supabase.from('users').select('essence_balance').eq('id', user.id).single();
    if (!userData || (userData.essence_balance || 0) < cost) {
        return { success: false, error: `You need ${cost} Essence to reveal this word.` };
    }

    // Deduct Essence & Reveal Word
    const newBalance = userData.essence_balance - cost;
    
    await supabase.from('users').update({ essence_balance: newBalance }).eq('id', user.id);
    
    await supabase.from('essence_transactions').insert({
        user_id: user.id, transaction_type: "spend", amount: -cost,
        balance_after: newBalance, description: `Purchased Cypher Revelation: "${cleanWord}"`, created_by: user.id
    });

    await supabase.from('cypher_revealed_words').insert({
        cypher_id: cypherId, word: cleanWord, revealed_by: user.id, method: 'purchase'
    });

    return { success: true, message: `You spent ${cost} Essence to reveal "${targetWord}" for the realm.` };
}
