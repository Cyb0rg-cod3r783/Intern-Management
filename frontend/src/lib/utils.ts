import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Guard against rendering user-supplied strings (evidence links, handover doc
 * links, etc.) as an <a href> when they contain a dangerous scheme such as
 * `javascript:` or `data:`. Only http(s) links are allowed through — anything
 * else resolves to "#" so a click is inert instead of executing script in the
 * viewer's session (the backend also validates this, this is defense in depth).
 */
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "#";
}
