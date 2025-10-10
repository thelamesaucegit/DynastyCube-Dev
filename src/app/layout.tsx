// src/app/layout.tsx
import "./globals.css";
import { Metadata } from "next";
import { AuthProvider } from "../contexts/AuthContext";

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
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
