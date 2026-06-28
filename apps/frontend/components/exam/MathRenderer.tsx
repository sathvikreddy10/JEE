"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
}

export function renderMath(text: string): string {
  let result = text;

  // If the text contains LaTeX commands but no dollar delimiters, render the
  // whole thing as inline math. This makes keyboard-inserted LaTeX preview
  // correctly without forcing users to manually wrap every fragment in $...$.
  if (/\\[a-zA-Z]/.test(result) && !result.includes("$")) {
    try {
      return katex.renderToString(result, { displayMode: false, throwOnError: false });
    } catch {
      return result;
    }
  }

  // Display math: $$...$$
  result = result.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span style="color:var(--crimson)">$$${math}$$</span>`;
    }
  });

  // Inline math: $...$ (not preceded by $)
  result = result.replace(/(?<!\$)\$([^$\s][^$]*?)\$(?!\$)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span style="color:var(--crimson)">$${math}$</span>`;
    }
  });

  return result;
}

export function MathRenderer({ text, className = "" }: MathRendererProps) {
  const html = renderMath(text);

  return (
    <div
      className={`leading-[1.8] ${className}`}
      style={{ color: "var(--text-primary)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
