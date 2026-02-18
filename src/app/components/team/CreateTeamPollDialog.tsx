"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { createTeamPoll } from "@/app/actions/voteActions";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";

interface CreateTeamPollDialogProps {
  teamId: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPollCreated: () => void;
}

export function CreateTeamPollDialog({
  teamId,
  userId,
  open,
  onOpenChange,
  onPollCreated,
}: CreateTeamPollDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState(() => {
    // Default to 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeEnd, setShowResultsBeforeEnd] = useState(true);
  const [options, setOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setEndsAt(d.toISOString().slice(0, 16));
    setAllowMultiple(false);
    setShowResultsBeforeEnd(true);
    setOptions(["", ""]);
    setError(null);
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    const validOptions = options.filter((o) => o.trim().length > 0);
    if (validOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    if (new Date(endsAt) <= new Date()) {
      setError("End date must be in the future");
      return;
    }

    setSubmitting(true);

    const result = await createTeamPoll(
      teamId,
      trimmedTitle,
      description.trim() || null,
      new Date(endsAt).toISOString(),
      allowMultiple,
      showResultsBeforeEnd,
      validOptions.map((o) => o.trim()),
      userId
    );

    if (result.success) {
      resetForm();
      onOpenChange(false);
      onPollCreated();
    } else {
      setError(result.error || "Failed to create poll");
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Team Poll</DialogTitle>
          <DialogDescription>
            Create a new poll for your team members to vote on.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="poll-title">Title *</Label>
            <Input
              id="poll-title"
              placeholder="What should we vote on?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="poll-description">Description</Label>
            <Textarea
              id="poll-description"
              placeholder="Add more context for voters (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="poll-ends-at">Voting Ends</Label>
            <Input
              id="poll-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>Options *</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    maxLength={200}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive size-8 p-0"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="mt-2"
              >
                <Plus className="size-4 mr-1" />
                Add Option
              </Button>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-multiple" className="cursor-pointer">
                  Allow multiple selections
                </Label>
                <p className="text-xs text-muted-foreground">
                  Let voters pick more than one option
                </p>
              </div>
              <Switch
                id="allow-multiple"
                checked={allowMultiple}
                onCheckedChange={setAllowMultiple}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-results" className="cursor-pointer">
                  Show results before voting ends
                </Label>
                <p className="text-xs text-muted-foreground">
                  Voters can see current results after voting
                </p>
              </div>
              <Switch
                id="show-results"
                checked={showResultsBeforeEnd}
                onCheckedChange={setShowResultsBeforeEnd}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Poll"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
