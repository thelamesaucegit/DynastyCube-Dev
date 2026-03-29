// src/app/teams/[teamShort_name]/page.tsx
// TODO: Full team page implementation using short_name-based lookup (post-UUID migration).
// This route handles /teams/[short_name] URLs (e.g. /teams/ninja).
"use client";

import { use } from "react";

interface TeamShortNamePageProps {
  params: Promise<{ teamShort_name: string }>;
}

export default function TeamShortNamePage({ params }: TeamShortNamePageProps) {
  const { teamShort_name: _ } = use(params);
  return null;
}
