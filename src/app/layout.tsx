// src/app/layout.tsx

import "./globals.css";
import { Metadata } from "next";
import Providers from "./components/Providers";
import { SettingsProvider } from '@/contexts/SettingsContext'; 
import { Toaster } from "@/app/components/ui/sonner"; 

export const metadata: Metadata = {
  title: "The Dynasty Cube",
  description: "A collaborative, living draft format",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/logo/logo.jpg" sizes="any" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // THE FIX: Intercept referral links on the very first page load!
                const urlParams = new URLSearchParams(window.location.search);
                const refId = urlParams.get('ref');
                if (refId) {
                  localStorage.setItem('dynasty_referral_id', refId);
                }

                const theme = localStorage.getItem('theme') ||
                  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}

              // Handle chunk load errors (deployment mismatch) - auto refresh once
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('Loading chunk') ||
                    (e.target && e.target.tagName === 'SCRIPT')) {
                  const reloaded = sessionStorage.getItem('chunk_reload');
                  if (!reloaded) {
                    sessionStorage.setItem('chunk_reload', 'true');
                    window.location.reload();
                  }
                }
              }, true);

              // Clear reload flag on successful load
              window.addEventListener('load', function() {
                sessionStorage.removeItem('chunk_reload');
              });
            `,
          }}
        />
      </head>
      <body>
        <SettingsProvider>
          <Providers>{children}</Providers>
        </SettingsProvider>
         <Toaster /> 
                 <div id="report-portal-root" className="relative z-[99999]" />
      </body>
    </html>
  );
}
