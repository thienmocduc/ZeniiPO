/**
 * HTML sanitization. Loads DOMPurify + jsdom lazily (they're not needed
 * for simple string validation — use schemas.ts for that).
 * Keep this file imported ONLY by routes that actually need to sanitize
 * untrusted HTML input (e.g. rich-text form bodies).
 */
import { z } from 'zod'

// Re-export common schemas from schemas.ts for backwards compatibility.
export { safeString, safeEmail, safeSlug, safeUrl, safeUuid } from './schemas'

const ALLOWED_TAGS = [
  'b',
  'i',
  'em',
  'strong',
  'a',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
]

const ALLOWED_ATTR = ['href', 'target', 'rel']

/**
 * Sanitizes untrusted HTML input. Strips scripts, event handlers, disallowed tags/attrs.
 * Safe for server & client (isomorphic-dompurify).
 */
export function sanitizeHtml(dirty: string): string {
  // Lazy import — only load DOMPurify when actually called.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DOMPurify = require('isomorphic-dompurify') as { sanitize: typeof import('isomorphic-dompurify').sanitize }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  })
}

/** Rich-text body: ≤10k chars, then sanitized via DOMPurify. */
export const safeHtml = z.string().max(10000).transform(sanitizeHtml)
