/**
 * Pure zod schemas — no DOMPurify/jsdom runtime deps.
 * Import these instead of sanitize.ts when you only need validation
 * (sanitize.ts loads jsdom at module init which breaks on Vercel node runtime
 * for API routes that don't actually need HTML sanitization).
 */
import { z } from 'zod'

/** Plain string: trimmed, ≤1000 chars. Use for short-ish user input. */
export const safeString = z.string().trim().max(1000)

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
