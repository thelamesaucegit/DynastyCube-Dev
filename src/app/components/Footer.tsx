// src/app/components/Footer.tsx
"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t py-8 mt-16">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="font-bold text-lg mb-2">Dynasty Cube</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A collaborative, living draft league where the multiverse itself shapes destiny.
            </p>
            <p className="text-xs text-muted-foreground">
              Not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Card data provided by{" "}
              <a
                href="https://scryfall.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline"
              >
                Scryfall
              </a>
              . Cube data from{" "}
              <a
                href="https://cubecobra.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline"
              >
                Cube Cobra
              </a>
              .
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pools" className="hover:text-foreground transition-colors">
                  Browse Cube
                </Link>
              </li>
              <li>
                <Link href="/schedule" className="hover:text-foreground transition-colors">
                  Match Schedule
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-foreground transition-colors">
                  Teams
                </Link>
              </li>
              <li>
                <Link href="/history" className="hover:text-foreground transition-colors">
                  League History
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://discord.gg/8qyEHDeJqg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Discord Server
                </a>
              </li>
              <li>
                <a
                  href="https://cubecobra.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Cube Cobra
                </a>
              </li>
              <li>
                <Link href="/glossary" className="hover:text-foreground transition-colors">
                  Glossary & FAQ
                </Link>
              </li>
              <li>
                <Link href="/vote" className="hover:text-foreground transition-colors">
                  Community Votes
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Dynasty Cube League. Inspired by Blaseball and powered by the community.</p>
        </div>
      </div>
    </footer>
  );
}
