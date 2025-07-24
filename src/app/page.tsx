// src/app/page.tsx
import React from 'react';
import Image from 'next/image';
import Layout from './components/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="hero-section">
        <h1>Welcome to The Dynasty Cube</h1>
        <div className="logo-container">
          <Image
            src="/images/logo/logo.jpg"
            alt="Dynasty Cube"
            width={400}
            height={400}
            className="hero-logo"
          />
        </div>
        
        {/* <div className="logo-divider"></div> */}
        
        <p className="hero-subtitle">A collaborative, living draft format</p>
      </div>
      
      <p className="construction-notice">This site is under construction!</p>
      <p>
        <a href="https://cubecobra.com/cube/overview/TheDynastyCube">
          Head to our CubeCobra page for details about The League while this website is being built.
        </a>
      </p>
      
      <div className="content-divider"></div>
    </Layout>
  );
}