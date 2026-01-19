# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Dynasty Cube is a Next.js web application for managing a collaborative, living draft format (Magic: The Gathering cube). The application uses Discord OAuth for authentication via Supabase and is currently under active development.

## Development Commands

### Running the Development Server
```bash
npm run dev
```
Starts the Next.js development server with Turbopack on http://localhost:3000

### Building for Production
```bash
npm run build
```
Creates an optimized production build

### Starting Production Server
```bash
npm start
```
Runs the production build (must run `npm run build` first)

### Linting
```bash
npm run lint
```
Runs ESLint to check for code quality issues

### Installing Dependencies
```bash
npm install
```
Install all dependencies from package.json

## Architecture

### Tech Stack
- **Framework**: Next.js 15.4.3 (App Router)
- **React**: 19.1.0
- **TypeScript**: 5.8.3
- **Styling**: Tailwind CSS 4 + Custom CSS modules
- **Backend**: Supabase (PostgreSQL + Auth)
- **Authentication**: Discord OAuth via Supabase

### Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── components/              # React components
│   │   ├── auth/               # Authentication components
│   │   ├── Layout.tsx          # Main layout wrapper
│   │   ├── Navigation.tsx      # Navigation component
│   │   └── HomePage.tsx        # Home page component
│   ├── hooks/                  # Custom React hooks
│   │   └── useMobileNavigation.ts
│   ├── styles/                 # Organized CSS files
│   │   ├── components/        # Component-specific styles
│   │   ├── pages/             # Page-specific styles
│   │   └── utilities/         # Utility styles (dark-mode, reset, etc.)
│   ├── account/               # Account management page
│   ├── auth/                  # Authentication pages and callbacks
│   ├── teams/                 # Teams management
│   ├── vote/                  # Voting functionality
│   ├── debug/                 # Debug utilities
│   ├── layout.tsx             # Root layout with AuthProvider
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── lib/
│   └── supabase.ts            # Supabase client (singleton pattern)
└── contexts/
    └── AuthContext.tsx         # Global authentication state
```

### Import Path Aliases

The project uses TypeScript path aliases defined in `tsconfig.json`:

- `@/*` → `./src/*`
- `@/components/*` → `./src/app/components/*`
- `@/hooks/*` → `./src/app/hooks/*`
- `@/styles/*` → `./src/app/styles/*`
- `@/utils/*` → `./src/app/utils/*`

Always use these aliases for imports instead of relative paths.

### Authentication Flow

1. **Supabase Client**: Singleton pattern in `src/lib/supabase.ts`
   - `getSupabaseClient()` - For client-side operations
   - `createServerClient()` - For server-side operations

2. **AuthContext**: Global auth state management via React Context
   - Provides: `user`, `session`, `loading`, `signInWithDiscord()`, `signOut()`
   - Wraps the entire app in `src/app/layout.tsx`

3. **Protected Routes**: Use `ProtectedRoute` component from `src/app/components/auth/ProtectedRoute.tsx`

4. **Discord OAuth**: Redirects to `/auth/callback` after authentication

### Styling Approach

The project uses a hybrid approach:
- **Tailwind CSS 4**: Primary styling framework (configured in `postcss.config.mjs`)
- **Custom CSS Modules**: Component-specific styles (e.g., `Navigation.module.css`)
- **Organized CSS Files**: Structured in `src/app/styles/`
  - `components/` - Component styles
  - `pages/` - Page-specific styles
  - `utilities/` - Global utilities (dark-mode, reset, typography, responsive)

### Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Next.js Configuration

- **Image Optimization**: Configured for Discord CDN avatars (`cdn.discordapp.com/avatars/**`)
- **Turbopack**: Enabled for faster development builds
- Uses TypeScript for config (`next.config.ts`)

## Key Patterns

### Component Structure
- **Client Components**: Must have `"use client"` directive (most components, especially those using hooks/context)
- **Server Components**: Default in App Router (use for static content)
- **Layout Pattern**: Common `<Layout>` wrapper with Navigation for consistent page structure

### Supabase Usage
```typescript
import { supabase } from "@/lib/supabase";

// Client-side auth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "discord",
  options: { redirectTo: `${window.location.origin}/auth/callback` }
});
```

### Auth Context Usage
```typescript
import { useAuth } from "@/contexts/AuthContext";

const { user, session, loading, signInWithDiscord, signOut } = useAuth();
```

### Protected Page Pattern
Wrap pages that require authentication:
```typescript
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function SecurePage() {
  return (
    <ProtectedRoute>
      {/* Page content */}
    </ProtectedRoute>
  );
}
```

## Development Workflow

1. **Adding New Pages**: Create files in `src/app/[page-name]/page.tsx` using App Router conventions
2. **Adding Components**: Place in `src/app/components/` with corresponding styles in `src/app/styles/components/`
3. **Styling**: Prefer Tailwind classes; use custom CSS files for complex styling
4. **Authentication**: Use `useAuth()` hook for auth state; wrap protected pages with `<ProtectedRoute>`
5. **TypeScript**: Maintain strict type safety; define interfaces for all props and data structures

## Important Notes

- The app is currently under construction - expect incomplete features
- Uses Next.js 15 App Router (not Pages Router)
- All auth flows go through Supabase, not custom backend
- Discord is the only authentication provider
- Mobile navigation is handled via custom hook (`useMobileNavigation`)
- Image paths reference local public folder or Discord CDN
