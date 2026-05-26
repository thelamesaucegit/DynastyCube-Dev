//src/app/components/Navigation.tsx

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "./ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Sun,
  Moon,
  Shield,
  Group, 
  LayoutGrid,
  Cable,
  Sparkles,
  Palmtree, 
  CheckSquare,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { getDraftSessions, type DraftSession } from "@/app/actions/draftSessionActions";
import { getUserTeam } from "@/app/actions/teamActions";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  const pathname = usePathname();
  const [userTeam, setUserTeam] = useState<{ short_name: string; emoji: string; name: string } | null>(null);
  
  // Track expanded state of mobile menu sections
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});

  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      const { sessions } = await getDraftSessions();
      setDraftSessions(sessions);
      
      if (user?.email) {
          const { team } = await getUserTeam(user.email);
          if (team) {
              setUserTeam({ short_name: team.short_name, emoji: team.emoji, name: team.name });
          }
      }
    }
    loadData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  const toggleMobileSection = (section: string) => {
    setMobileExpanded(prev => ({ ...prev, [section]: !prev[section] }));
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

  const isDropdownActive = (paths: string[]) => paths.some(path => pathname.startsWith(path));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80 shrink-0"
          >
            <Image
              src="/images/logo/logo.jpg"
              alt="Dynasty Cube Logo"
              width={32}
              height={32}
              className="size-8 rounded-md"
            />
            <span className="font-bold text-xl text-foreground hidden sm:inline-block">
              Dynasty Cube
            </span>
          </Link>

          {/* FLOATING MOBILE EMOJI */}
          {userTeam && (
             <Link href={`/teams/${userTeam.short_name}`} className="md:hidden text-2xl hover:scale-110 transition-transform">
                {userTeam.emoji}
             </Link>
          )}

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={`${navigationMenuTriggerStyle()} bg-transparent ${isActive("/") ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}
                    >
                      Home
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {/* Drafts Dropdown */}
                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`${navigationMenuTriggerStyle()} bg-transparent ${isActive("/draft") ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}>
                      Draft
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {draftSessions.length > 0 ? (
                        draftSessions.map((session) => (
                          <DropdownMenuItem key={session.id} asChild>
                            <Link href={`/draft/${session.id}/live`}>
                              {session.name || `Draft from ${new Date(session.created_at).toLocaleDateString()}`}
                            </Link>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuLabel className="text-muted-foreground font-normal px-2">No active drafts.</DropdownMenuLabel>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>
                
                {/* Pools Dropdown */}
                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`${navigationMenuTriggerStyle()} bg-transparent ${isDropdownActive(['/pools']) ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}>
                      Pools
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem asChild>
                        <Link href="/pools/draft" className="flex items-center gap-2">
                          <LayoutGrid className="size-4" /> Draft Pool
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/pools/resort" className="flex items-center gap-2">
                          <Palmtree className="size-4" /> The Resort Pool
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/pools/wire" className="flex items-center gap-2">
                          <Cable className="size-4" /> THE WIRE
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/pools/chamber" className="flex items-center gap-2">
                          <Group className="size-4" /> The Chamber
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/pools/free-agents" className="flex items-center gap-2">
                          <Sparkles className="size-4" /> Free Agents
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>

                {/* Teams Link */}
                <NavigationMenuItem>
                  <Link href="/teams" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={`${navigationMenuTriggerStyle()} bg-transparent ${isActive("/teams") ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}
                    >
                      Teams
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {/* USER'S TEAM EMOJI LINK */}
                {userTeam && (
                  <NavigationMenuItem>
                    <Link href={`/teams/${userTeam.short_name}`} legacyBehavior passHref>
                      <NavigationMenuLink
                        title={userTeam.name}
                        className={`${navigationMenuTriggerStyle()} bg-transparent px-2 text-xl hover:scale-110 transition-transform ${isActive(`/teams/${userTeam.short_name}`) ? "bg-accent/50 rounded-md" : ""}`}
                      >
                        {userTeam.emoji}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                )}
                
                {/* Schedule Link */}
                <NavigationMenuItem>
                  <Link href="/schedule" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={`${navigationMenuTriggerStyle()} bg-transparent ${isActive("/schedule") ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}
                    >
                      Schedule
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                
                {user && (
                  <NavigationMenuItem>
                    <Link href="/vote" legacyBehavior passHref>
                      <NavigationMenuLink className={`${navigationMenuTriggerStyle()} bg-transparent ${isActive("/vote") ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}>
                        Vote
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                )}

                {/* Info Dropdown */}
                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`${navigationMenuTriggerStyle()} bg-transparent ${isDropdownActive(["/about", "/history", "/news", "/glossary"]) ? "bg-accent/50 text-accent-foreground font-medium" : ""}`}>
                      Info
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                       <DropdownMenuItem asChild><Link href="/about">About</Link></DropdownMenuItem>
                       <DropdownMenuItem asChild><Link href="/history">History</Link></DropdownMenuItem>
                       <DropdownMenuItem asChild><Link href="/news">News</Link></DropdownMenuItem>
                       <DropdownMenuItem asChild><Link href="/glossary">Glossary</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>

                {/* Admin Dropdown */}
                {user && isAdmin && (
                  <NavigationMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger className={`${navigationMenuTriggerStyle()} bg-transparent ${isDropdownActive(["/admin"]) ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium" : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"}`}>
                        <Shield className="size-3.5 mr-1.5" />
                        Admin
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                         <DropdownMenuItem asChild>
                           <Link href="/admin" className="flex items-center gap-2">
                             <LayoutGrid className="size-4" /> Dashboard
                           </Link>
                         </DropdownMenuItem>
                         <DropdownMenuItem asChild>
                           <Link href="/admin/tasks" className="flex items-center gap-2">
                             <CheckSquare className="size-4" /> Task Board
                           </Link>
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>
          </nav>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <div className="hidden md:flex items-center gap-1">
              <ReportButton />
              <MessageDropdown />
              <NotificationBell />
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="size-9">
            {mounted ? (
              theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />
            ) : (
              <span className="size-4" />
            )}
          </Button>

          {loading ? (
            <div className="size-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity outline-none">
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
                <DropdownMenuItem asChild><Link href="/account" className="cursor-pointer"><User className="mr-2 size-4" />My Account</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/messages" className="cursor-pointer"><Settings className="mr-2 size-4" />Messages</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
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
              <Button variant="ghost" size="icon" className="size-9">
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <nav className="flex flex-col gap-1 mt-8">
                
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={`px-4 py-2.5 rounded-md text-left transition-colors ${isActive("/") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                  Home
                </Link>
                
                {/* DRAFTS */}
                <button 
                  onClick={() => toggleMobileSection('drafts')}
                  className="flex items-center justify-between w-full pt-4 pb-2 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors outline-none"
                >
                  <span>Drafts ({draftSessions.length})</span>
                  {mobileExpanded['drafts'] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {mobileExpanded['drafts'] && (
                  <div className="flex flex-col gap-1 mb-2">
                    {draftSessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/draft/${session.id}/live`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive(`/draft/${session.id}`) ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}
                      >
                        {session.name || `Draft from ${new Date(session.created_at).toLocaleDateString()}`}
                      </Link>
                    ))}
                  </div>
                )}
                
                {/* POOLS */}
                <button 
                  onClick={() => toggleMobileSection('pools')}
                  className="flex items-center justify-between w-full pt-4 pb-2 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors outline-none"
                >
                  <span>Pools</span>
                  {mobileExpanded['pools'] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {mobileExpanded['pools'] && (
                  <div className="flex flex-col gap-1 mb-2">
                    <Link href="/pools/draft" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/pools/draft") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      Draft Pool
                    </Link>
                    <Link href="/pools/resort" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/pools/resort") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      The Resort Pool
                    </Link>
                    <Link href="/pools/wire" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/pools/wire") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      The Wire
                    </Link>
                    <Link href="/pools/chamber" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/pools/chamber") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      The Chamber
                    </Link>
                    <Link href="/pools/free-agents" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/pools/free-agents") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      Free Agents
                    </Link>
                  </div>
                )}

                {/* LEAGUE */}
                <button 
                  onClick={() => toggleMobileSection('league')}
                  className="flex items-center justify-between w-full pt-4 pb-2 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors outline-none"
                >
                  <span>League</span>
                  {mobileExpanded['league'] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {mobileExpanded['league'] && (
                  <div className="flex flex-col gap-1 mb-2">
                    <Link href="/teams" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/teams") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      Teams
                    </Link>
                    <Link href="/schedule" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/schedule") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      Schedule
                    </Link>
                    {user && (
                      <Link href="/vote" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/vote") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                        Vote
                      </Link>
                    )}
                  </div>
                )}
                
                {/* INFO */}
                <button 
                  onClick={() => toggleMobileSection('info')}
                  className="flex items-center justify-between w-full pt-4 pb-2 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors outline-none"
                >
                  <span>Info</span>
                  {mobileExpanded['info'] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {mobileExpanded['info'] && (
                  <div className="flex flex-col gap-1 mb-2">
                    <Link href="/about" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/about") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      About
                    </Link>
                    <Link href="/history" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/history") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      History
                    </Link>
                    <Link href="/news" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/news") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      News
                    </Link>
                    <Link href="/glossary" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors ${isActive("/glossary") ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                      Glossary
                    </Link>
                  </div>
                )}

                {/* ADMIN */}
                {user && isAdmin && (
                  <>
                    <button 
                      onClick={() => toggleMobileSection('admin')}
                      className="flex items-center justify-between w-full pt-4 pb-2 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors outline-none"
                    >
                      <span className="text-orange-600 dark:text-orange-400">Admin</span>
                      {mobileExpanded['admin'] ? <ChevronDown className="size-3 text-orange-600 dark:text-orange-400" /> : <ChevronRight className="size-3 text-orange-600 dark:text-orange-400" />}
                    </button>
                    {mobileExpanded['admin'] && (
                      <div className="flex flex-col gap-1 mb-2">
                        <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors flex items-center gap-2 ${isActive("/admin") && !isActive("/admin/tasks") ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium" : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"}`}>
                          <LayoutGrid className="size-4" />
                          Dashboard
                        </Link>
                        <Link href="/admin/tasks" onClick={() => setMobileMenuOpen(false)} className={`mx-2 px-4 py-2 rounded-md text-left transition-colors flex items-center gap-2 ${isActive("/admin/tasks") ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium" : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"}`}>
                          <CheckSquare className="size-4" />
                          Task Board
                        </Link>
                      </div>
                    )}
                  </>
                )}

                {/* Bottom Buttons */}
                {user && (
                  <div className="flex items-center gap-3 px-4 py-2 border-t mt-4 pt-6">
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
}
