// src/app/components/Navigation.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useMobileNavigation } from '@/hooks/useMobileNavigation'; 

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
          <li>
            <Link href="/" className="nav-link" role="menuitem">
              Home
            </Link>
          </li>
          <li>
            <Link href="" className="nav-link" role="menuitem">
              My Account
            </Link>
          </li>
          <li>
            <Link href="" className="nav-link" role="menuitem">
              Teams
            </Link>
          </li>
          <li>
            <Link href="" className="nav-link" role="menuitem">
              Pools
            </Link>
          </li>
          <li>
            <Link href="" className="nav-link" role="menuitem">
              Schedule
            </Link>
          </li>
          <li>
            <Link href="" className="nav-link" role="menuitem">
              Vote
            </Link>
          </li>
          <li>
            <a 
              href="https://cubecobra.com/cube/overview/TheDynastyCube" 
              className="nav-link"
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;