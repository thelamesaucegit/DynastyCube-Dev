// src/app/account/page.tsx
'use client';

import React from 'react';
import Layout from '@/components/Layout';
import LoginForm from '@/components/LoginForm';       
import AccountContent from '@/components/AccountContent';
import { useAuth } from '@/hooks/useAuth';

export default function AccountPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-300 py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="text-center text-gray-300 py-8">
        <div className="hero-section mb-8">
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="hero-subtitle">
            {user ? 'Manage your Dynasty Cube profile' : 'Sign in to access your account'}
          </p>
        </div>

        {user ? <AccountContent /> : <LoginForm />}
      </div>
    </Layout>
  );
}