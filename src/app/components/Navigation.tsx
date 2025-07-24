// src/app/components/Navigation.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useMobileNavigation } from '../hooks/useMobileNavigation';
import styles from './Navigation.module.css';

const Navigation: React.FC = () => {
  const { isMenuOpen, toggleMenu, menuRef, toggleRef } = useMobileNavigation();

  return (
    <nav className={styles.nav}>
      <div className={styles.navContainer}>
        <button 
          ref={toggleRef}
          className={styles.menuToggle}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
        >
          Menu
        </button>
        <ul 
          ref={menuRef}
          className={`${styles.navMenu} ${isMenuOpen ? styles.active : ''}`}
          role="menu"
        >
          <li>
            <Link href="/" className={styles.navLink} role="menuitem">
              Home
            </Link>
          </li>
          <li>
            <Link href="/about" className={styles.navLink} role="menuitem">
              About
            </Link>
          </li>
          <li>
            <Link href="/rules" className={styles.navLink} role="menuitem">
              Rules
            </Link>
          </li>
          <li>
            <a 
              href="https://cubecobra.com/cube/overview/TheDynastyCube" 
              className={styles.navLink}
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