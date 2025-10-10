// src/app/components/Layout.tsx
"use client";

import React from "react";
import Navigation from "@/components/Navigation";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Navigation />
      <div className="container">{children}</div>
    </>
  );
};

export default Layout;
