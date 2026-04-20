import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

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
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  })
}

/* ----- Reusable Zod schemas -------------------------------------------- */

/** Plain string: trimmed, ≤1000 chars. Use for short-ish user input. */
export const safeString = z.string().trim().max(1000)

/** Rich-text body: ≤10k chars, then sanitized via DOMPurify. */
export const safeHtml = z.string().max(10000).transform(sanitizeHtml)

/** Email: lower-cased, RFC-valid, ≤255 chars. */
export const safeEmail = z.string().email().max(255).toLowerCase()

/** Slug: lower-kebab alphanumeric, ≤50 chars. */
export const safeSlug = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'must be lowercase letters, digits, or hyphens')
  .max(50)

/** URL: well-formed, ≤2000 chars. */
export const safeUrl = z.string().url().max(2000)

/** UUID v1-v5. */
export const safeUuid = z.string().uuid()
