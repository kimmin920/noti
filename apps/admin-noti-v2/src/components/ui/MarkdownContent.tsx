"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

export function MarkdownContent({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <div className={className ? `markdown-content ${className}` : "markdown-content"}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
