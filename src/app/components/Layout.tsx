// src/app/components/Layout.tsx
"use client";

import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="container">{children}</div>
  );
};

export default Layout;
