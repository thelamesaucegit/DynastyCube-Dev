//src/app/components/admin/SeasonPauseControl.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, PauseCircle, PlayCircle, Clock } from "lucide-react";
import { shiftRemainingSchedule } from "@/app/actions/scheduleActions";
import { createClient } from "@supabase/supabase-js";

interface SeasonPauseControlProps {
  seasonId: string;
  seasonName: string;
}

export function SeasonPauseControl({ seasonId, seasonName }: SeasonPauseControlProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resumeDate, setResumeDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if the season is currently paused by seeing if any games are marked 'paused'
  useEffect(() => {
    const checkPauseStatus = async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { count } = await supabase
        .from('schedule')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', seasonId)
        .eq('status', 'paused');
        
      setIsPaused((count || 0) > 0);
      setLoading(false);
    };
    checkPauseStatus();
  }, [seasonId]);

  const handlePause = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    
    const result = await shiftRemainingSchedule(seasonId, 'pause');
    if (result.success) {
      setIsPaused(true);
      setSuccess(`Successfully paused! ${result.matchesShifted} scheduled matches have been halted.`);
    } else {
      setError(result.error || "Failed to pause season.");
    }
    setProcessing(false);
  };

  const handleResume = async () => {
    if (!resumeDate) {
      setError("You must provide a resume date/time!");
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    
    // Ensure the date is valid and converted to ISO
    const dateObj = new Date(resumeDate);
    if (isNaN(dateObj.getTime())) {
      setError("Invalid date format.");
      setProcessing(false);
      return;
    }

    const result = await shiftRemainingSchedule(seasonId, 'resume', dateObj.toISOString());
    if (result.success) {
      setIsPaused(false);
      setSuccess(`Season resumed! ${result.matchesShifted} matches shifted to begin on ${dateObj.toLocaleString()}.`);
      setResumeDate("");
    } else {
      setError(result.error || "Failed to resume season.");
    }
    setProcessing(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;
  }

  return (
    <Card className={`border-2 ${isPaused ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isPaused ? <PauseCircle className="h-5 w-5 text-amber-500" /> : <PlayCircle className="h-5 w-5 text-green-500" />}
            Schedule Control: {seasonName}
          </CardTitle>
          <Badge variant={isPaused ? "outline" : "default"} className={isPaused ? "text-amber-600 border-amber-500/50" : "bg-green-600"}>
            {isPaused ? "PAUSED" : "RUNNING"}
          </Badge>
        </div>
        <CardDescription>
          {isPaused 
            ? "The Match-Runner is halted. Unplayed games are frozen until you provide a resume date." 
            : "Pause the season to stop the Match-Runner. When you resume, all remaining games will be shifted forward while retaining their exact structural spacing."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-red-500 mb-4 p-3 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>}
        {success && <div className="text-sm text-green-500 mb-4 p-3 bg-green-500/10 rounded-md border border-green-500/20">{success}</div>}

        {!isPaused ? (
          <Button onClick={handlePause} disabled={processing} variant="destructive" className="w-full sm:w-auto">
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}
            Pause Entire Season Schedule
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Date & Time to Resume 1st Game
              </label>
              <input 
                type="datetime-local" 
                value={resumeDate}
                onChange={(e) => setResumeDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button onClick={handleResume} disabled={processing || !resumeDate} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Shift Schedule & Resume
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
