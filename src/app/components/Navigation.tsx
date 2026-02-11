// src/app/components/Navigation.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useMobileNavigation } from "@/hooks/useMobileNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NotificationBell } from "./NotificationBell";
import { MessageDropdown } from "./MessageDropdown";
import { ReportButton } from "./ReportButton";

// Extracted class strings for maintainability
const STYLES = {
  nav: "fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-[1020]",
  container: "max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center",
  mobileMenuButton: "md:hidden bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer",
  navList: "md:flex flex-col md:flex-row list-none gap-2 m-0 p-0 items-center",
  navLink: "text-gray-700 dark:text-gray-300 no-underline font-medium text-sm px-3 py-2 rounded-md transition-colors hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700",
  adminLink: "text-orange-600 dark:text-orange-400 no-underline font-semibold text-sm px-3 py-2 rounded-md transition-colors hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-orange-400 dark:border-orange-600",
  themeToggle: "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 cursor-pointer h-9",
  authSection: "border-l border-gray-200 dark:border-gray-700 pl-4 ml-2 flex items-center gap-3",
  userName: "text-sm text-gray-700 dark:text-gray-300 font-medium max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap hidden sm:inline",
  signOutButton: "bg-transparent border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white cursor-pointer h-9",
  signInButton: "bg-[#5865f2] text-white border border-[#5865f2] px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-[#4752c4] hover:border-[#4752c4] inline-flex items-center cursor-pointer h-9",
  loading: "text-gray-500 dark:text-gray-400 italic text-sm",
  iconGroup: "flex items-center gap-1",
} as const;

const Navigation: React.FC = () => {
  const { isMenuOpen, toggleMenu, menuRef, toggleRef, closeMenu } =
    useMobileNavigation();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useIsAdmin();

  const handleSignOut = async () => {
    await signOut();
    closeMenu();
  };

  const handleLinkClick = () => {
    closeMenu();
  };

  return (
    <nav className={STYLES.nav}>
      <div className={STYLES.container}>
        <button
          ref={toggleRef}
          className={STYLES.mobileMenuButton}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
        >
          Menu
        </button>
        <ul
          ref={menuRef}
          className={`${isMenuOpen ? "flex" : "hidden"} ${STYLES.navList}`}
          role="menu"
        >
          <li>
            <Link
              href="/"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              href="/account"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              My Account
            </Link>
          </li>
          <li>
            <Link
              href="/teams"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              Teams
            </Link>
          </li>
          <li>
            <Link
              href="/pools"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              Pools
            </Link>
          </li>
          <li>
            <Link
              href="/schedule"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              Schedule
            </Link>
          </li>
          <li>
            <Link
              href="/history"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              History
            </Link>
          </li>
          <li>
            <Link
              href="/glossary"
              className={STYLES.navLink}
              role="menuitem"
              onClick={handleLinkClick}
            >
              Glossary
            </Link>
          </li>

          {/* Conditionally show Vote button only when logged in */}
          {user && (
            <li>
              <Link
                href="/vote"
                className={STYLES.navLink}
                role="menuitem"
                onClick={handleLinkClick}
              >
                Vote
              </Link>
            </li>
          )}

          {/* Conditionally show Admin button only for admin users */}
          {user && isAdmin && (
            <li>
              <Link
                href="/admin"
                className={STYLES.adminLink}
                role="menuitem"
                onClick={handleLinkClick}
              >
                🛠️ Admin
              </Link>
            </li>
          )}

          <li>
            <Link
              href="https://discord.gg/8qyEHDeJqg"
              className={STYLES.navLink}
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              Discord
            </Link>
          </li>

          {/* Icon Buttons Group - Only show when logged in */}
          {user && (
            <li className={STYLES.iconGroup}>
              <ReportButton />
              <MessageDropdown />
              <NotificationBell />
            </li>
          )}

          {/* Theme Toggle */}
          <li>
            <button
              onClick={toggleTheme}
              className={STYLES.themeToggle}
              role="menuitem"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              suppressHydrationWarning
            >
              <span suppressHydrationWarning>
                {theme === "light" ? "🌙" : "☀️"}
              </span>
              <span className="hidden sm:inline" suppressHydrationWarning>
                {theme === "light" ? "Dark" : "Light"}
              </span>
            </button>
          </li>

          {/* Auth section */}
          <li className={STYLES.authSection}>
            {loading ? (
              <span className={STYLES.loading}>Loading...</span>
            ) : user ? (
              <>
                <span className={STYLES.userName}>
                  {user.user_metadata?.custom_claims?.global_name ||
                    user.user_metadata?.global_name ||
                    user.user_metadata?.username ||
                    user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    user.email?.split("@")[0] ||
                    "User"}
                </span>
                <button
                  onClick={handleSignOut}
                  className={STYLES.signOutButton}
                  role="menuitem"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={handleLinkClick}
                className={STYLES.signInButton}
                role="menuitem"
              >
                Sign in
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
