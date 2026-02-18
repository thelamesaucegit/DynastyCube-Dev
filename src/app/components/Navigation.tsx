// src/app/components/Navigation.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NotificationBell } from "./NotificationBell";
import { MessageDropdown } from "./MessageDropdown";
import { ReportButton } from "./ReportButton";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  Sparkles,
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Sun,
  Moon,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/pools", label: "Cube" },
  { href: "/teams", label: "Teams" },
  { href: "/schedule", label: "Matches" },
  { href: "/history", label: "History" },
  { href: "/news", label: "News" },
  { href: "/glossary", label: "Glossary" },
];

const authNavItems = [
  { href: "/vote", label: "Vote" },
];

const Navigation: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  const displayName =
    user?.user_metadata?.custom_claims?.global_name ||
    user?.user_metadata?.global_name ||
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const allNavItems = [
    ...navItems,
    ...(user ? authNavItems : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="relative">
              <Sparkles className="size-8 text-purple-500" />
              <div className="absolute inset-0 animate-pulse bg-purple-500/20 blur-lg" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Dynasty Cube
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {allNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user && isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                  isActive("/admin")
                    ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium"
                    : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                }`}
              >
                <Shield className="size-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Icon buttons for logged-in users */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              <ReportButton />
              <MessageDropdown />
              <NotificationBell />
            </div>
          )}

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-9"
          >
            {mounted ? (
              theme === "light" ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )
            ) : (
              <span className="size-4" />
            )}
          </Button>

          {/* User menu / Sign in */}
          {loading ? (
            <div className="size-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium">{displayName}</p>
                  </div>
                  <Avatar className="size-8">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <User className="mr-2 size-4" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages">
                    <Settings className="mr-2 size-4" />
                    Messages
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/auth/login">Sign In</Link>
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                {mobileMenuOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-2 mt-8">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-md text-left transition-colors ${
                      isActive(item.href)
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {user && isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2 rounded-md text-left transition-colors text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 flex items-center gap-2"
                  >
                    <Shield className="size-4" />
                    Admin
                  </Link>
                )}
                {user && (
                  <div className="flex items-center gap-2 px-4 py-2 border-t mt-2 pt-4">
                    <ReportButton />
                    <MessageDropdown />
                    <NotificationBell />
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
