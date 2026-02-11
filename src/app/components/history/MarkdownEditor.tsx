// src/app/components/history/MarkdownEditor.tsx
"use client";

import React, { useRef, useState } from "react";
import { HistoryEntryRenderer } from "./HistoryEntryRenderer";

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
      // Block-level: ensure we're on a new line
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

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        if (selected) {
          // If text was selected, place cursor after the insertion
          const pos = start + cursorOffset;
          textarea.setSelectionRange(pos, pos);
        } else {
          // If no selection, select the placeholder text
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
        // Select "url" for easy replacement
        const urlStart = start + text.length + 3; // [text](
        const urlEnd = urlStart + 3; // url
        textarea.setSelectionRange(urlStart, urlEnd);
      }
    });
  };

  return (
    <div className="md-editor">
      {/* Mode toggle + toolbar */}
      <div className="md-editor-header">
        <div className="history-preview-toggle">
          <button
            type="button"
            className={!showPreview ? "active" : ""}
            onClick={() => setShowPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={showPreview ? "active" : ""}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </button>
        </div>

        {!showPreview && (
          <div className="md-editor-toolbar">
            {TOOLBAR_ACTIONS.map((action) => (
              <button
                key={action.title}
                type="button"
                className="md-toolbar-btn"
                title={action.title}
                onClick={() => insertMarkdown(action)}
                disabled={disabled}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              className="md-toolbar-btn"
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
        <div className="history-preview-box" style={{ minHeight }}>
          {value.trim() ? (
            <HistoryEntryRenderer content={value} />
          ) : (
            <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
              Nothing to preview
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="history-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ minHeight }}
        />
      )}
    </div>
  );
};
