// src/app/auth/auth-code-error/page.tsx
import Layout from '@/components/Layout';
import Link from 'next/link';

export default function AuthCodeError() {
  return (
    <Layout>
      <div className="text-center text-gray-300 py-12">
        <div className="max-w-md mx-auto bg-red-900/20 border border-red-500/30 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Authentication Error</h1>
          <p className="text-gray-300 mb-6">
            Sorry, we couldn&apos;t complete your sign-in. This might be due to:
          </p>
          <ul className="text-left text-sm text-gray-400 mb-6 space-y-2">
            <li>• The authorization code expired</li>
            <li>• Network connectivity issues</li>
            <li>• Discord service temporarily unavailable</li>
          </ul>
          <Link 
            href="/account" 
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    </Layout>
  );
}