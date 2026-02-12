import { useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu, X, Sparkles, User, LogOut, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function Header({ onNavigate, currentPage }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Mock user data - connect to your Supabase auth
  const user = {
    name: 'Alex Chen',
    email: 'alex@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    team: 'Planar Voyagers'
  };

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'cube', label: 'Cube' },
    { id: 'draft', label: 'Draft' },
    { id: 'matches', label: 'Matches' },
    { id: 'teams', label: 'Teams' },
    { id: 'decks', label: 'Decks' },
    { id: 'history', label: 'History' },
    { id: 'news', label: 'News' },
  ];

  const handleLogin = () => {
    // Connect to your Supabase OAuth
    console.log('Login with Discord/Google');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="relative">
              <Sparkles className="size-8 text-purple-500" />
              <div className="absolute inset-0 animate-pulse bg-purple-500/20 blur-lg" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Dynasty Cube
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  currentPage === item.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.team}</p>
                  </div>
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate('profile')}>
                  <User className="mr-2 size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate('settings')}>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogin}>
                  <LogOut className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleLogin} variant="default">
              Login
            </Button>
          )}

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-4 py-2 rounded-md text-left transition-colors ${
                      currentPage === item.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}