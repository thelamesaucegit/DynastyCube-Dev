// src/app/layout.tsx
import './globals.css';  // ← This line is crucial
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Dynasty Cube',
  description: 'A collaborative, living draft format',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}