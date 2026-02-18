// src/app/components/history/MarkdownEditor.tsx
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

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "B", title: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
  { label: "I", title: "Italic", prefix: "*", suffix: "*", placeholder: "italic text" },
  { label: "S", title: "Strikethrough", prefix: "~~", suffix: "~~", placeholder: "strikethrough" },
  { label: "H1", title: "Heading 1", prefix: "# ", suffix: "", block: true, placeholder: "Heading" },
  { label: "H2", title: "Heading 2", prefix: "## ", suffix: "", block: true, placeholder: "Heading" },
  { label: "H3", title: "Heading 3", prefix: "### ", suffix: "", block: true, placeholder: "Heading" },
  { label: "\u2022", title: "Bullet List", prefix: "- ", suffix: "", block: true, placeholder: "List item" },
  { label: "1.", title: "Numbered List", prefix: "1. ", suffix: "", block: true, placeholder: "List item" },
  { label: ">", title: "Quote", prefix: "> ", suffix: "", block: true, placeholder: "Quote" },
  { label: "</>", title: "Inline Code", prefix: "`", suffix: "`", placeholder: "code" },
  { label: "---", title: "Horizontal Rule", prefix: "\n---\n", suffix: "", placeholder: "" },
];

const LINK_ACTION = { label: "Link", title: "Insert Link" };

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Write in markdown...",
  disabled = false,
  minHeight = "120px",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const insertMarkdown = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    let insertion: string;
    let cursorOffset: number;

    if (action.block) {
      const needsNewline = before.length > 0 && !before.endsWith("\n");
      const prefix = (needsNewline ? "\n" : "") + action.prefix;
      const text = selected || action.placeholder;
      insertion = prefix + text + action.suffix;
      cursorOffset = prefix.length + (selected ? selected.length : 0);
    } else {
      const text = selected || action.placeholder;
      insertion = action.prefix + text + action.suffix;
      cursorOffset = action.prefix.length + text.length + action.suffix.length;
    }

    const newValue = before + insertion + after;
    onChange(newValue);

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        if (selected) {
          const pos = start + cursorOffset;
          textarea.setSelectionRange(pos, pos);
        } else {
          const selectStart = start + (action.block ? ((before.length > 0 && !before.endsWith("\n")) ? 1 : 0) + action.prefix.length : action.prefix.length);
          const selectEnd = selectStart + action.placeholder.length;
          textarea.setSelectionRange(selectStart, selectEnd);
        }
      }
    });
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    const text = selected || "link text";
    const insertion = `[${text}](url)`;
    const newValue = before + insertion + after;
    onChange(newValue);

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const urlStart = start + text.length + 3;
        const urlEnd = urlStart + 3;
        textarea.setSelectionRange(urlStart, urlEnd);
      }
    });
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Mode toggle + toolbar */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            type="button"
            className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors ${
              !showPreview
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setShowPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-colors ${
              showPreview
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
        </div>

        {!showPreview && (
          <div className="flex flex-wrap gap-1 p-1.5 bg-muted border border-border rounded-md">
            {TOOLBAR_ACTIONS.map((action) => (
              <button
                key={action.title}
                type="button"
                className="px-2 py-1 bg-background border border-border rounded text-xs font-bold font-mono text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-7 text-center"
                title={action.title}
                onClick={() => insertMarkdown(action)}
                disabled={disabled}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              className="px-2 py-1 bg-background border border-border rounded text-xs font-bold font-mono text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={LINK_ACTION.title}
              onClick={insertLink}
              disabled={disabled}
            >
              {LINK_ACTION.label}
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      {showPreview ? (
        <div className="border border-border rounded-md p-3 bg-background" style={{ minHeight }}>
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
