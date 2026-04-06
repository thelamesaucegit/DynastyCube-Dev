// src/app/components/LoginForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('✅ Found existing session, redirecting...');
        router.push('/account');
      }
    };
    
    handleAuthCallback();
  }, [supabase.auth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: authError } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = async () => {
    setDiscordLoading(true);
    setError('');

    try {
      console.log('🔄 Starting Discord OAuth...');
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      console.log('🔄 OAuth redirect data:', data);

      if (oauthError) {
        console.error('❌ OAuth error:', oauthError);
        setError(oauthError.message);
        setDiscordLoading(false);
      }
    } catch (err) {
      console.error('❌ Discord login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Discord');
      setDiscordLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-title">
        {isSignUp ? 'Join Dynasty Cube' : 'Welcome Back'}
      </h2>

      <button
        type="button"
        onClick={handleDiscordLogin}
        disabled={discordLoading}
        className="discord-login-button"
      >
        {discordLoading && <span className="loading-spinner"></span>}
        <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9460 2.4189-2.1568 2.4189Z"/>
        </svg>
        {discordLoading ? 'Redirecting to Discord...' : 'Continue with Discord'}
      </button>

      <div className="divider">
        <span>or</span>
      </div>
      
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-input"
            placeholder="Enter your password"
            minLength={6}
          />
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="submit-button"
        >
          {loading && <span className="loading-spinner"></span>}
          {loading 
            ? 'Processing...' 
            : (isSignUp ? 'Create Account' : 'Sign In')
          }
        </button>
      </form>

      <div className="form-toggle">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="toggle-button"
        >
          {isSignUp 
            ? 'Already have an account? Sign In' 
            : "Don&apos;t have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};

export default LoginForm;