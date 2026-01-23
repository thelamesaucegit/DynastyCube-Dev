// src/app/layout.tsx
import "./globals.css";
import { Metadata } from "next";
import Providers from "./components/Providers";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
