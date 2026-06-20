// src/app/auth/apply-referral/page.tsx
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ApplyReferralPage() {
    const router = useRouter();

    useEffect(() => {
        async function applyReferral() {
            const referralId = localStorage.getItem('dynasty_referral_id');
            
            if (referralId) {
                const supabase = createClient();
                console.log(`Found referral ID: ${referralId}. Calling RPC...`);
                
                const { data, error } = await supabase.rpc('apply_referral_bonus', {
                    referrer_id: referralId
                });

                if (error) {
                    console.error("Error applying referral bonus:", error);
                } else {
                    console.log("Referral RPC response:", data);
                }

                // Clean up the referral ID from storage
                localStorage.removeItem('dynasty_referral_id');
            }

            // Redirect to the home page regardless of outcome
            router.replace('/');
        }

        applyReferral();
    }, [router]);

    return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
            <h1>Applying referral bonus...</h1>
            <p>Please wait, you will be redirected shortly.</p>
        </div>
    );
}
