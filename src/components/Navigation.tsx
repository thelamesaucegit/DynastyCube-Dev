// components/Navigation.tsx
'use client';

import React from 'react';
import { useMobileNavigation } from '../hooks/useMobileNavigation';

const Navigation: React.FC = () => {
  const { isMenuOpen, toggleMenu, menuRef, toggleRef } = useMobileNavigation();

  return (
    <nav className="nav">
      <div className="nav-container">
        <button 
          ref={toggleRef}
          className="menu-toggle" 
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
        >
          Menu
        </button>
        <ul 
          ref={menuRef}
          className={`nav-menu ${isMenuOpen ? 'active' : ''}`}
          role="menu"
        >
          <li><a href="/" className="nav-link" role="menuitem">Home</a></li>
          <li><a href="/about" className="nav-link" role="menuitem">About</a></li>
          <li><a href="/rules" className="nav-link" role="menuitem">Rules</a></li>
          <li>
            <a 
              href="https://cubecobra.com/cube/overview/TheDynastyCube" 
              className="nav-link" 
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
            >
              CubeCobra
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;