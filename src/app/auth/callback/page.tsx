// src/app/auth/callback/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthError } from '@supabase/supabase-js';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('🔄 Callback: Processing auth callback...');
      setStatus('Processing authentication...');

      try {
        const supabase = createClient();
        
        // Try multiple approaches to get session
        let session = null;
        let sessionError: AuthError | null = null;

        try {
          // Method 1: getSession
          const result = await supabase.auth.getSession();
          session = result.data.session;
          sessionError = result.error;
        } catch (getSessionErr) {
          console.log('getSession failed, trying getUser...', getSessionErr);
          try {
            // Method 2: getUser
            const userResult = await supabase.auth.getUser();
            if (userResult.data.user && !userResult.error) {
              // Create a mock session object
              session = { user: userResult.data.user };
            }
            sessionError = userResult.error;
          } catch (getUserErr) {
            console.error('Both getSession and getUser failed:', getUserErr);
            sessionError = getUserErr instanceof Error 
              ? { message: getUserErr.message } as AuthError
              : { message: 'Unknown authentication error' } as AuthError;
          }
        }
        
        if (sessionError) {
          console.error('❌ Callback: Auth error:', sessionError);
          setStatus(`Authentication failed: ${sessionError.message}`);
          setTimeout(() => router.push('/auth/auth-code-error'), 2000);
          return;
        }

        if (session?.user) {
          console.log('✅ Callback: Authentication successful!');
          console.log('👤 User:', session.user.email);
          setStatus('Success! Redirecting to your account...');
          
          setTimeout(() => {
            router.push('/account');
          }, 1000);
        } else {
          console.log('⚠️ Callback: No session found');
          setStatus('No session found. Redirecting...');
          setTimeout(() => router.push('/account'), 2000);
        }
      } catch (processingErr) {
        console.error('❌ Callback: Processing error:', processingErr);
        const errorMessage = processingErr instanceof Error 
          ? processingErr.message 
          : 'Unknown processing error';
        setStatus(`Error: ${errorMessage}`);
        setTimeout(() => router.push('/auth/auth-code-error'), 2000);
      }
    };

    setTimeout(handleAuthCallback, 500);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
        <p className="text-gray-300 text-lg mb-2">Authentication</p>
        <p className="text-gray-500 text-sm">{status}</p>
      </div>
    </div>
  );
}