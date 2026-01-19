// src/app/components/Footer.tsx
"use client";

import React from "react";

export default function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          {/* Acknowledgements */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Acknowledgements</strong>
            </p>
            <p className="mb-1">
              Magic: The Gathering and all associated card names, mana symbols, and images are property of{" "}
              <a
                href="https://company.wizards.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Wizards of the Coast LLC
              </a>
              .
            </p>
            <p className="mb-1">
              Card data and images provided by{" "}
              <a
                href="https://scryfall.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Scryfall
              </a>
              .
            </p>
            <p className="mb-1">
              Additional card data is sourced from{" "}
              <a
                href="https://cubecobra.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Cube Cobra
              </a>
              .
            </p>
            <p>
              Inspired by{" "}
              <a
                href="https://en.wikipedia.org/wiki/Blaseball"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Blaseball
              </a>
              .
            </p>
          </div>

          {/* Disclaimer */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-500 max-w-2xl">
            <p>
              This website is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC.
              Dynasty Cube is a fan-made project and is not intended for commercial use.
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-500">
            <p>&copy; {new Date().getFullYear()} Dynasty Cube. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
