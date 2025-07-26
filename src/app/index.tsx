// page.tsx
'use client'; // Add this if using Next.js 13+ app directory
import './global.css'
import React from 'react';
import { useMobileNavigation } from '@/hooks/useMobileNavigation'; 

export default function Page() {
  const { isMenuOpen, toggleMenu, menuRef, toggleRef } = useMobileNavigation();

  return (
    <>
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
            <li><a href="#" className="nav-link" role="menuitem">Home</a></li>
            <li><a href="#" className="nav-link" role="menuitem">My Account</a></li>
            <li><a href="#" className="nav-link" role="menuitem">Teams</a></li>
			<li><a href="#" className="nav-link" role="menuitem">Pools</a></li>
			<li><a href="#" className="nav-link" role="menuitem">Schedule</a></li>
			<li><a href="#" className="nav-link" role="menuitem">Vote</a></li>
			<li><a href="#" className="nav-link" role="menuitem">Discord</a></li>
            <li>
              <a 
                href="https://cubecobra.com/cube/overview/TheDynastyCube" 
                className="nav-link" 
                role="menuitem"
              >
                CubeCobra
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <div className="container">
        <h1>Welcome to The Dynasty Cube</h1>
        <p className="subtitle">A collaborative, living draft format</p>
        <p className="construction-notice">This site is under construction!</p>
        <p>
          <a href="https://cubecobra.com/cube/overview/TheDynastyCube">
            Head to our CubeCobra page for details about The League while this website is being built.
          </a>
        </p>
      </div>
    </>
  );
}