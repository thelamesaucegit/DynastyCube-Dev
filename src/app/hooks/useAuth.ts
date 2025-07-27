// src/app/hooks/useAuth.ts
'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    console.log('🔍 useAuth: Starting auth check...');
    
    // Get initial session - try different method names
    const getSession = async () => {
      console.log('🔍 useAuth: Getting initial session...');
      
      try {
        // Try the current method first
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ useAuth: Error getting session:', error);
        } else {
          console.log('✅ useAuth: Initial session:', session ? 'Found' : 'Not found');
          console.log('👤 useAuth: User:', session?.user?.email || 'None');
        }
        
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('❌ useAuth: Session method failed:', err);
        // Fallback: try to get user directly
        try {
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
          if (!userError && currentUser) {
            setUser(currentUser);
            console.log('✅ useAuth: Got user via getUser()');
          }
        } catch (userErr) {
          console.error('❌ useAuth: getUser also failed:', userErr);
        }
      }
      
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 useAuth: Auth state change:', event);
        console.log('👤 useAuth: Session user:', session?.user?.email || 'None');
        
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_IN') {
          console.log('✅ useAuth: User signed in, refreshing router...');
          router.refresh();
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 useAuth: User signed out');
        }
      }
    );

    return () => {
      console.log('🧹 useAuth: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [supabase.auth, router]);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 useAuth: Attempting email sign in...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('🔐 useAuth: Sign in result:', error ? 'Error' : 'Success');
    return { data, error };
  };

  const signUp = async (email: string, password: string) => {
    console.log('📝 useAuth: Attempting email sign up...');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    console.log('📝 useAuth: Sign up result:', error ? 'Error' : 'Success');
    return { data, error };
  };

  const signOut = async () => {
    console.log('👋 useAuth: Attempting sign out...');
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      router.refresh();
    }
    console.log('👋 useAuth: Sign out result:', error ? 'Error' : 'Success');
    return { error };
  };

  console.log('🔍 useAuth: Current state - User:', user?.email || 'None', 'Loading:', loading);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
};