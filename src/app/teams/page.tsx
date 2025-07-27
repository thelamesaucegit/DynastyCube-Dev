
// src/app/page.tsx
import React from 'react';
import Image from 'next/image';
import Layout from '@/components/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="hero-section">
        <h3>Teams</h3>
    
        
        <p className="hero-subtitle">A collaborative, living draft format</p>
      </div>

      
      
      <div className="content-divider"></div>
    </Layout>
  );
}
