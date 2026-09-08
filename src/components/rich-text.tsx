import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

interface RichTextProps {
  text: string;
  className?: string;
}

export function RichText({ text, className = "" }: RichTextProps) {
  const html = useMemo(() => {
    if (!text) return "";
    try {
      const rawHtml = marked.parse(text, {
        gfm: true,
        breaks: true,
        async: false,
      }) as string;
      return DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target", "rel"],
      });
    } catch {
      return text;
    }
  }, [text]);

  if (!text) return null;

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
