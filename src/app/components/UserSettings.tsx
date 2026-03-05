// src/app/components/UserSettings.tsx

"use client";

import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';

export function UserSettings() {
  const { useOldestArt, setUseOldestArt, isLoading } = useSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Settings</CardTitle>
        <CardDescription>Customize how card images are displayed across the site.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <Label htmlFor="art-toggle" className="flex flex-col space-y-1">
            <span>Use Oldest Card Art</span>
            <span className="font-normal leading-snug text-muted-foreground">
              Display the first-ever printing of a card instead of the default image.
            </span>
          </Label>
          {isLoading ? (
            <div className="h-6 w-11 bg-gray-200 rounded-full animate-pulse" />
          ) : (
            <Switch
              id="art-toggle"
              checked={useOldestArt}
              onCheckedChange={setUseOldestArt}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
