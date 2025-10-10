// src/app/components/Navigation.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useMobileNavigation } from "@/hooks/useMobileNavigation";
import { useAuth } from "@/contexts/AuthContext";
// import { supabase } from "@/lib/supabase";

const Navigation: React.FC = () => {
  const { isMenuOpen, toggleMenu, menuRef, toggleRef, closeMenu } =
    useMobileNavigation();
  const { user, loading, signInWithDiscord, signOut } = useAuth();

  const handleSignInWithDiscord = async () => {
    await signInWithDiscord();
    closeMenu();
  };

  const handleSignOut = async () => {
    await signOut();
    closeMenu();
  };

  const handleLinkClick = () => {
    closeMenu();
  };

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
          className={`nav-menu ${isMenuOpen ? "active" : ""}`}
          role="menu"
        >
          <li>
            <Link
              href="/"
              className="nav-link"
              role="menuitem"
              onClick={handleLinkClick}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              href="/account"
              className="nav-link"
              role="menuitem"
              onClick={handleLinkClick}
            >
              My Account
            </Link>
          </li>
          <li>
            <Link
              href="/teams"
              className="nav-link"
              role="menuitem"
              onClick={handleLinkClick}
            >
              Teams
            </Link>
          </li>
          <li>
            <Link
              href="/pools"
              className="nav-link"
              role="menuitem"
              onClick={handleLinkClick}
            >
              Pools
            </Link>
          </li>
          <li>
            <Link
              href="/schedule"
              className="nav-link"
              role="menuitem"
              onClick={handleLinkClick}
            >
              Schedule
            </Link>
          </li>

          {/* Conditionally show Vote button only when logged in */}
          {user && (
            <li>
              <Link
                href="/vote"
                className="nav-link"
                role="menuitem"
                onClick={handleLinkClick}
              >
                Vote
              </Link>
            </li>
          )}

          <li>
            <Link
              href="https://discord.gg/8qyEHDeJqg"
              className="nav-link"
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              Discord
            </Link>
          </li>

          {/* Auth section */}
          <li className="nav-auth-section">
            {loading ? (
              <span className="nav-link nav-auth-loading">Loading...</span>
            ) : user ? (
              <div className="nav-auth-user">
                <span className="nav-user-info">
                  {user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    user.email?.split("@")[0] ||
                    "User"}
                </span>
                <button
                  onClick={handleSignOut}
                  className="nav-link nav-auth-button"
                  role="menuitem"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignInWithDiscord}
                className="nav-link nav-auth-button nav-discord-signin"
                role="menuitem"
              >
                Sign in
              </button>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
