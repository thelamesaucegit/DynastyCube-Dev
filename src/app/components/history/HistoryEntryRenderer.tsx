// =============================================================================
// HISTORY ENTRY RENDERER
// =============================================================================
// Renders history entry content as styled markdown.
//
// SUPPORTED SYNTAX:
//   Standard markdown via remark-gfm (bold, italic, tables, lists, etc.)
//   Spoiler text via ||spoiler text|| — click to reveal, click again to hide
//
// TO ADD A NEW CUSTOM SYNTAX:
//   1. Add a remark plugin below following the remarkSpoiler pattern
//   2. Add it to the remarkPlugins array in the ReactMarkdown call
//   3. If it produces a custom hast node, add a handler to the components prop
// =============================================================================

"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Text, Parent } from "mdast";

// =============================================================================
// REMARK SPOILER PLUGIN
// Transforms ||spoiler text|| inline syntax into hast <span class="spoiler">
// nodes during the markdown → HTML conversion pipeline.
//
// Uses unist-util-visit (already a transitive dependency of remark-gfm —
// no new package installation required).
//
// HOW IT WORKS:
//   1. Visits every 'text' node in the mdast tree
//   2. Splits on the /\|\|(.+?)\|\|/ pattern
//   3. Replaces the original text node with an array of text nodes and
//      custom 'spoiler' nodes
//   4. The 'data.hName' / 'data.hProperties' fields tell rehype how to
//      render the custom node as HTML — here as <span class="spoiler">
// =============================================================================

function remarkSpoiler() {
  return (tree: Root) => {
    visit(
      tree,
      "text",
      (node: Text, index: number | null, parent: Parent | null) => {
        // Skip if no parent slot available or no spoiler markers present
        if (!parent || index === null || !node.value.includes("||")) return;

        const regex = /\|\|(.+?)\|\|/g;
const newNodes: (Text | { type: "spoiler"; data: { hName: string; hProperties: { className: string } }; children: Text[] })[] = [];        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let foundAny = false;

        while ((match = regex.exec(node.value)) !== null) {
          foundAny = true;

          // Text before this match
          if (match.index > lastIndex) {
            newNodes.push({
              type: "text",
              value: node.value.slice(lastIndex, match.index),
            });
          }

          // Spoiler node — data.hName/hProperties tell rehype how to render
          newNodes.push({
            type: "spoiler",
            data: {
              hName: "span",
              hProperties: { className: "spoiler" },
            },
            children: [{ type: "text", value: match[1] }],
          });

          lastIndex = regex.lastIndex;
        }

        if (!foundAny) return;

        // Remaining text after last match
        if (lastIndex < node.value.length) {
          newNodes.push({
            type: "text",
            value: node.value.slice(lastIndex),
          });
        }

        // Replace the original text node with the split array
        parent.children.splice(index, 1, ...newNodes);
      }
    );
  };
}


// =============================================================================
// SPOILER SPAN COMPONENT
// Rendered by ReactMarkdown whenever it encounters a <span class="spoiler">.
// Clicking toggles between the hidden (solid block) and revealed states.
// =============================================================================

function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setRevealed((v) => !v)}
      onKeyDown={(e) => e.key === "Enter" && setRevealed((v) => !v)}
      title={revealed ? "Click to hide" : "Click to reveal spoiler"}
      className={`
        inline cursor-pointer rounded px-0.5 transition-colors select-none
        ${revealed
          ? "bg-muted text-foreground"
          : "bg-foreground text-foreground hover:bg-foreground/80"
        }
      `}
    >
      {children}
    </span>
  );
}


// =============================================================================
// ENTRY RENDERER
// =============================================================================

interface HistoryEntryRendererProps {
  content: string;
}

export const HistoryEntryRenderer: React.FC<HistoryEntryRendererProps> = ({
  content,
}) => {
  return (
    <div className="
      text-sm leading-7 text-foreground/80
      [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-2
      [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1
      [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-foreground
      [&_p]:mb-3
      [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:list-disc
      [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:list-decimal
      [&_li]:mb-1
      [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80
      [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4
      [&_blockquote]:my-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic
      [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
      [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_strong]:font-bold [&_strong]:text-foreground
      [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
      [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2
      [&_th]:text-left [&_th]:bg-muted [&_th]:font-semibold
      [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSpoiler]}
        components={{
          /*
           * Intercept <span> elements so we can detect spoiler spans produced
           * by the remarkSpoiler plugin and render them as SpoilerSpan instead
           * of a plain span.
           *
           * TO ADD ANOTHER CUSTOM INLINE ELEMENT:
           *   Add a new className check here following the spoiler pattern.
           */
          span: ({ node, className, children, ...props }) => {
            if (className === "spoiler") {
              return <SpoilerSpan>{children}</SpoilerSpan>;
            }
            return (
              <span className={className} {...props}>
                {children}
              </span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
