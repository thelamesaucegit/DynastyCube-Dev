// src/app/components/history/MarkdownEditor.tsx
// =============================================================================
// MARKDOWN EDITOR
// =============================================================================
// Write/Preview toggle editor with a formatting toolbar.
// Renders previews using HistoryEntryRenderer so what you see in preview is
// exactly what appears in the history page.
//
// TO ADD A NEW TOOLBAR BUTTON:
//   Add an entry to TOOLBAR_ACTIONS following the existing pattern.
//   - block: true  → inserts at the start of the line (headings, lists, etc.)
//   - block: false → wraps selected text inline (bold, italic, spoiler, etc.)
//   prefix/suffix define what wraps or precedes the selected/placeholder text.
// =============================================================================

"use client";

import React, { useRef, useState } from "react";
import { HistoryEntryRenderer } from "./HistoryEntryRenderer";
import { Textarea } from "@/app/components/ui/textarea";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

interface ToolbarAction {
  label: string;
  title: string;
  prefix: string;
  suffix: string;
  block?: boolean;
  placeholder: string;
}

// =============================================================================
// TOOLBAR ACTIONS
// Order here is the display order in the toolbar.
// =============================================================================

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  // --- Text formatting ---
  { label: "B",   title: "Bold",            prefix: "**",  suffix: "**",  placeholder: "bold text"      },
  { label: "I",   title: "Italic",          prefix: "*",   suffix: "*",   placeholder: "italic text"    },
  { label: "S",   title: "Strikethrough",   prefix: "~~",  suffix: "~~",  placeholder: "strikethrough"  },
  // --- Headings ---
  { label: "H1",  title: "Heading 1",       prefix: "# ",  suffix: "",    block: true, placeholder: "Heading" },
  { label: "H2",  title: "Heading 2",       prefix: "## ", suffix: "",    block: true, placeholder: "Heading" },
  { label: "H3",  title: "Heading 3",       prefix: "### ",suffix: "",    block: true, placeholder: "Heading" },
  // --- Lists ---
  { label: "•",   title: "Bullet List",     prefix: "- ",  suffix: "",    block: true, placeholder: "List item"  },
  { label: "1.",  title: "Numbered List",   prefix: "1. ", suffix: "",    block: true, placeholder: "List item"  },
  // --- Block elements ---
  { label: ">",   title: "Quote",           prefix: "> ",  suffix: "",    block: true, placeholder: "Quote"      },
  { label: "</>", title: "Inline Code",     prefix: "`",   suffix: "`",   placeholder: "code"           },
  { label: "---", title: "Horizontal Rule", prefix: "\n---\n", suffix: "", placeholder: ""              },
  // --- Spoiler ---
  // Uses Discord-style ||spoiler|| syntax, parsed by the remarkSpoiler plugin
  // in HistoryEntryRenderer. Renders as a click-to-reveal block in the history page.
  { label: "👁",  title: "Spoiler",         prefix: "||",  suffix: "||",  placeholder: "spoiler text"   },
];

const LINK_ACTION = { label: "Link", title: "Insert Link" };


// =============================================================================
// COMPONENT
// =============================================================================

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Write in markdown...",
  disabled = false,
  minHeight = "120px",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ---------------------------------------------------------------------------
  // Toolbar insertion logic
  // Handles both block-level (line prefix) and inline (wrap) insertions,
  // preserving selection and placing the cursor intelligently after insert.
  // ---------------------------------------------------------------------------

  const insertMarkdown = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before   = value.substring(0, start);
    const after    = value.substring(end);

    let insertion: string;
    let cursorOffset: number;

    if (action.block) {
      const needsNewline = before.length > 0 && !before.endsWith("\n");
      const prefix = (needsNewline ? "\n" : "") + action.prefix;
      const text   = selected || action.placeholder;
      insertion    = prefix + text + action.suffix;
      cursorOffset = prefix.length + (selected ? selected.length : 0);
    } else {
      const text   = selected || action.placeholder;
      insertion    = action.prefix + text + action.suffix;
      cursorOffset = action.prefix.length + text.length + action.suffix.length;
    }

    onChange(before + insertion + after);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      if (selected) {
        const pos = start + cursorOffset;
        textarea.setSelectionRange(pos, pos);
      } else {
        const extraOffset =
          action.block && before.length > 0 && !before.endsWith("\n") ? 1 : 0;
        const selectStart = start + extraOffset + action.prefix.length;
        const selectEnd   = selectStart + action.placeholder.length;
        textarea.setSelectionRange(selectStart, selectEnd);
      }
    });
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start    = textarea.selectionStart;
    const end      = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before   = value.substring(0, start);
    const after    = value.substring(end);

    const text      = selected || "link text";
    const insertion = `[${text}](url)`;
    onChange(before + insertion + after);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const urlStart = start + text.length + 3; // after "[text]("
      textarea.setSelectionRange(urlStart, urlStart + 3); // select "url"
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0">

      {/* Write / Preview toggle */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors
              ${!showPreview
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors
              ${showPreview
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
          >
            Preview
          </button>
        </div>

        {/* Toolbar — only shown in Write mode */}
        {!showPreview && (
          <div className="flex flex-wrap gap-1 p-1.5 bg-muted border border-border rounded-md">
            {TOOLBAR_ACTIONS.map((action) => (
              <button
                key={action.title}
                type="button"
                title={action.title}
                onClick={() => insertMarkdown(action)}
                disabled={disabled}
                className="
                  px-2 py-1 bg-background border border-border rounded
                  text-xs font-bold font-mono text-muted-foreground
                  hover:bg-accent hover:text-foreground
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors min-w-7 text-center
                "
              >
                {action.label}
              </button>
            ))}

            {/* Link button — uses custom insertion logic */}
            <button
              type="button"
              title={LINK_ACTION.title}
              onClick={insertLink}
              disabled={disabled}
              className="
                px-2 py-1 bg-background border border-border rounded
                text-xs font-bold font-mono text-muted-foreground
                hover:bg-accent hover:text-foreground
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {LINK_ACTION.label}
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      {showPreview ? (
        <div
          className="border border-border rounded-md p-3 bg-background"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <HistoryEntryRenderer content={value} />
          ) : (
            <span className="text-muted-foreground italic text-sm">
              Nothing to preview
            </span>
          )}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ minHeight }}
          className="resize-y"
        />
      )}
    </div>
  );
};
