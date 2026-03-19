// src/components/history/HistoryAdminForms.tsx
// =============================================================================
// HISTORY ADMIN FORM PRIMITIVES
// =============================================================================
// Self-contained form components used by the inline edit mode on the history
// page. Each form manages its own loading/error state and calls server actions
// directly — no lifting state to the parent needed.
//
// EXPORTS:
//   InlineEraForm      — create or edit an Era
//   InlineSeasonForm   — create or edit a Season within an Era
//   InlineEntryForm    — add a new entry OR edit an existing entry in a slot
//   AdminHiddenToggle  — toggle is_hidden on any entity (era/season/section/entry)
//   AdminDeleteButton  — confirm-then-delete for sections and entries
// =============================================================================

"use client";

import React, { useState } from "react";
import { Loader2, Eye, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  adminCreateEra,
  adminUpdateEra,
  adminCreateSeason,
  adminUpdateSeason,
  adminUpsertSlotSection,
  adminToggleSectionHidden,
  adminToggleEntryHidden,
  adminDeleteSection,
  adminDeleteEntry,
  appendHistoryEntry,
  adminUpdateEntryContent,
} from "@/app/actions/historyActions";
import { CROSS_TEAM_SURFACEABLE_SLOTS } from "@/config/historySlotSchema";
import type { HistoryEraRow, HistorySeasonRow, TeamBasic } from "@/types/history";


// =============================================================================
// SHARED PRIMITIVES
// =============================================================================

/** Simple labelled text input */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

/** Simple labelled textarea */
function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-ring resize-y"
      />
    </div>
  );
}

/** Error message display */
function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

/** Inline form wrapper with consistent padding/border */
function FormWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 space-y-3">
      {children}
    </div>
  );
}

/** Standard form action row (Save + Cancel) */
function FormActions({
  onCancel,
  loading,
  saveLabel = "Save",
}: {
  onCancel: () => void;
  loading: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button type="submit" size="sm" disabled={loading}>
        {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        {saveLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={loading}
      >
        Cancel
      </Button>
    </div>
  );
}


// =============================================================================
// ERA FORM
// Used for both creating a new era and editing an existing one.
// Pass `era` to populate the form for editing; omit it for creation.
// =============================================================================

interface InlineEraFormProps {
  /** When provided, the form edits this era. When omitted, it creates a new one. */
  era?: HistoryEraRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InlineEraForm({ era, onSuccess, onCancel }: InlineEraFormProps) {
  const isEdit = !!era;
  const [name, setName] = useState(era?.name ?? "");
  const [description, setDescription] = useState(era?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    era?.display_order?.toString() ?? "0"
  );
  const [isHidden, setIsHidden] = useState(era?.is_hidden ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const result = isEdit
      ? await adminUpdateEra(era!.id, {
          name: name.trim(),
          description: description.trim() || null,
          display_order: parseInt(displayOrder) || 0,
          is_hidden: isHidden,
        })
      : await adminCreateEra({
          name: name.trim(),
          description: description.trim() || undefined,
          isHidden,
        });

    setLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? "An error occurred");
    }
  }

  return (
    <FormWrapper>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isEdit ? "Edit Era" : "Create Era"}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Era Name"
          value={name}
          onChange={setName}
          placeholder="e.g. The First Era"
          required
        />
        <Field
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Short description shown under the era header"
        />
        <Field
          label="Display Order"
          value={displayOrder}
          onChange={setDisplayOrder}
          type="number"
          placeholder="0"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(e) => setIsHidden(e.target.checked)}
            className="rounded border-input"
          />
          Hide from non-admin users
        </label>
        {error && <FormError message={error} />}
        <FormActions
          onCancel={onCancel}
          loading={loading}
          saveLabel={isEdit ? "Save Changes" : "Create Era"}
        />
      </form>
    </FormWrapper>
  );
}


// =============================================================================
// SEASON FORM
// Used for both creating and editing a season within an era.
// =============================================================================

interface InlineSeasonFormProps {
  /** The era this season belongs to */
  eraId: string;
  /** When provided, the form edits this season. When omitted, it creates a new one. */
  season?: HistorySeasonRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InlineSeasonForm({
  eraId,
  season,
  onSuccess,
  onCancel,
}: InlineSeasonFormProps) {
  const isEdit = !!season;
  const [name, setName] = useState(season?.name ?? "");
  const [description, setDescription] = useState(season?.description ?? "");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    season?.spreadsheet_url ?? ""
  );
  const [displayOrder, setDisplayOrder] = useState(
    season?.display_order?.toString() ?? "0"
  );
  const [isHidden, setIsHidden] = useState(season?.is_hidden ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const result = isEdit
      ? await adminUpdateSeason(season!.id, {
          name: name.trim(),
          description: description.trim() || null,
          spreadsheet_url: spreadsheetUrl.trim() || null,
          display_order: parseInt(displayOrder) || 0,
          is_hidden: isHidden,
        })
      : await adminCreateSeason({
          eraId,
          name: name.trim(),
          description: description.trim() || undefined,
          spreadsheetUrl: spreadsheetUrl.trim() || undefined,
          isHidden,
        });

    setLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? "An error occurred");
    }
  }

  return (
    <FormWrapper>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isEdit ? "Edit Season" : "Add Season"}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Season Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Season 1"
          required
        />
        <Field
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Short description shown in the season header"
        />
        <Field
          label="Draft Spreadsheet URL (optional)"
          value={spreadsheetUrl}
          onChange={setSpreadsheetUrl}
          placeholder="https://docs.google.com/spreadsheets/..."
          type="url"
        />
        <Field
          label="Display Order"
          value={displayOrder}
          onChange={setDisplayOrder}
          type="number"
          placeholder="0"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(e) => setIsHidden(e.target.checked)}
            className="rounded border-input"
          />
          Hide from non-admin users
        </label>
        {error && <FormError message={error} />}
        <FormActions
          onCancel={onCancel}
          loading={loading}
          saveLabel={isEdit ? "Save Changes" : "Add Season"}
        />
      </form>
    </FormWrapper>
  );
}


// =============================================================================
// ENTRY FORM
// Handles two scenarios:
//   1. Adding a new entry to a slot (entryId is undefined)
//   2. Editing an existing entry (entryId is provided)
//
// When sectionId is null (the slot has no DB record yet), this form will
// first call adminUpsertSlotSection to create the section, then add the entry.
// =============================================================================

interface InlineEntryFormProps {
  /** null if this slot has no DB section record yet */
  sectionId: string | null;
  /** Provided when editing an existing entry */
  entryId?: string;
  /** Pre-populates the textarea when editing */
  initialContent?: string;
  slotType: string;
  slotTitle: string;
  ownerType: "team" | "league";
  /** null for league-owned sections */
  ownerId: string | null;
  eraId: string;
  seasonId: string;
  /** Current referenced team IDs on this slot section (for cross-team surfacing) */
  referencedTeamIds: string[];
  /** All visible teams — used for the referenced-teams selector on cross-team slots */
  allTeams: TeamBasic[];
  onSuccess: (newSectionId?: string) => void;
  onCancel: () => void;
}

export function InlineEntryForm({
  sectionId,
  entryId,
  initialContent = "",
  slotType,
  slotTitle,
  ownerType,
  ownerId,
  eraId,
  seasonId,
  referencedTeamIds,
  allTeams,
  onSuccess,
  onCancel,
}: InlineEntryFormProps) {
  const isEdit = !!entryId;
  const [content, setContent] = useState(initialContent);
  // Referenced teams — only relevant for cross-team surfaceable slots
  const [selectedRefTeams, setSelectedRefTeams] = useState<string[]>(
    referencedTeamIds
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Is this slot type one that can surface under referenced teams?
  const isCrossTeamSlot = CROSS_TEAM_SURFACEABLE_SLOTS.has(slotType as any);

  function toggleRefTeam(teamId: string) {
    setSelectedRefTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);

    try {
      let resolvedSectionId = sectionId;

      // If no section exists yet, create it first
      if (!resolvedSectionId) {
        const sectionResult = await adminUpsertSlotSection({
          ownerType,
          ownerId,
          eraId,
          seasonId,
          slotType,
          title: slotTitle,
          referencedTeamIds: selectedRefTeams,
          isHidden: false,
        });

        if (!sectionResult.success || !sectionResult.sectionId) {
          setError(sectionResult.error ?? "Failed to create slot section");
          setLoading(false);
          return;
        }
        resolvedSectionId = sectionResult.sectionId;
      } else if (isCrossTeamSlot) {
        // Section exists — update referenced teams on the section if they changed
        await adminUpsertSlotSection({
          ownerType,
          ownerId,
          eraId,
          seasonId,
          slotType,
          title: slotTitle,
          referencedTeamIds: selectedRefTeams,
        });
      }

      // Add or update the entry
      const entryResult = isEdit
        ? await adminUpdateEntryContent(entryId!, content.trim())
        : await appendHistoryEntry(resolvedSectionId!, content.trim());

      if (!entryResult.success) {
        setError(entryResult.error ?? "Failed to save entry");
        setLoading(false);
        return;
      }

      onSuccess(resolvedSectionId ?? undefined);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormWrapper>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isEdit ? `Edit — ${slotTitle}` : `Add Entry — ${slotTitle}`}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <TextArea
          label="Content"
          value={content}
          onChange={setContent}
          placeholder="Write the history entry here..."
          rows={5}
          required
        />

        {/*
          Referenced Teams selector — only shown for cross-team surfaceable slots
          (postseason rounds, championship). When a team is checked here, sections
          with that team's ID in referenced_team_ids will surface under that team's
          filtered view.
        */}
        {isCrossTeamSlot && allTeams.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Referenced Teams{" "}
              <span className="font-normal opacity-70">
                (check teams that appear in this matchup)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {allTeams
                .filter((t) => t.id !== ownerId) // exclude the owning team
                .map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer
                               px-2 py-1 rounded border border-input bg-background
                               hover:bg-muted transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRefTeams.includes(team.id)}
                      onChange={() => toggleRefTeam(team.id)}
                      className="rounded border-input"
                    />
                    {team.emoji} {team.name}
                  </label>
                ))}
            </div>
          </div>
        )}

        {error && <FormError message={error} />}
        <FormActions
          onCancel={onCancel}
          loading={loading}
          saveLabel={isEdit ? "Save Changes" : "Add Entry"}
        />
      </form>
    </FormWrapper>
  );
}


// =============================================================================
// ADMIN HIDDEN TOGGLE
// A compact button that toggles is_hidden on any history entity.
// Pass the appropriate toggle function via `onToggle`.
// =============================================================================

interface AdminHiddenToggleProps {
  isHidden: boolean;
  /**
   * Called with the new is_hidden value.
   * The parent is responsible for calling the correct server action.
   */
  onToggle: (newValue: boolean) => Promise<void>;
  size?: "sm" | "xs";
}

export function AdminHiddenToggle({
  isHidden,
  onToggle,
  size = "sm",
}: AdminHiddenToggleProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await onToggle(!isHidden);
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={isHidden ? "Show (currently hidden)" : "Hide from non-admins"}
      className={`
        flex items-center gap-1 rounded transition-colors
        ${size === "xs" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs"}
        ${
          isHidden
            ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }
      `}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isHidden ? (
        <EyeOff className="h-3 w-3" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      {isHidden ? "Hidden" : "Visible"}
    </button>
  );
}


// =============================================================================
// ADMIN DELETE BUTTON
// Two-step confirm-then-delete button for sections and entries.
// =============================================================================

interface AdminDeleteButtonProps {
  label?: string;
  onConfirm: () => Promise<void>;
}

export function AdminDeleteButton({
  label = "Delete",
  onConfirm,
}: AdminDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-destructive">Sure?</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="px-1.5 py-0.5 text-xs rounded bg-destructive text-destructive-foreground
                     hover:bg-destructive/90 transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-1.5 py-0.5 text-xs rounded hover:bg-muted transition-colors
                     text-muted-foreground"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded
                 text-muted-foreground hover:text-destructive hover:bg-destructive/10
                 transition-colors"
    >
      <Trash2 className="h-3 w-3" />
      {label}
    </button>
  );
}
