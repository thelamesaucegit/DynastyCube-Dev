// src/app/components/history/HistoryEntryRenderer.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HistoryEntryRendererProps {
  content: string;
}

export const HistoryEntryRenderer: React.FC<HistoryEntryRendererProps> = ({
  content,
}) => {
  return (
    <div className="text-sm leading-7 text-foreground/80 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-foreground [&_p]:mb-3 [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:list-disc [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-muted [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};
