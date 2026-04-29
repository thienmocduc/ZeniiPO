/**
 * Slack Incoming Webhook helper.
 *
 * Set SLACK_WEBHOOK_URL in env (one channel) — graceful no-op when missing
 * so dev / preview without keys still works. For multi-channel routing
 * (e.g. #ops vs #board vs #fundraise), add SLACK_WEBHOOK_URL_OPS etc and
 * route by `channel` arg.
 */

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? ''

export function isSlackConfigured(): boolean {
  return Boolean(WEBHOOK_URL)
}

export type SlackBlock =
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'divider' }
  | { type: 'context'; elements: Array<{ type: 'mrkdwn'; text: string }> }
  | { type: 'header'; text: { type: 'plain_text'; text: string } }

export type SlackMessage = {
  text: string // fallback for notifications + accessibility
  blocks?: SlackBlock[]
  username?: string
  icon_emoji?: string
}

export async function postSlack(msg: SlackMessage): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn('[notify/slack] SLACK_WEBHOOK_URL missing — skipping:', msg.text)
    return false
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: msg.username ?? 'Zeniipo',
        icon_emoji: msg.icon_emoji ?? ':rocket:',
        text: msg.text,
        blocks: msg.blocks,
      }),
    })
    if (!res.ok) {
      console.error('[notify/slack] HTTP', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[notify/slack] fetch failed:', err)
    return false
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zenicloud.io'

// ─── Pre-formatted notifications ──────────────────────────────

export async function notifyCascadeTriggered(input: {
  tenant_name: string
  actor_email: string
  valuation_usd: number
  venue: string
  target_year: number
  industry: string
  journey_id?: string | null
}) {
  const valM = input.valuation_usd >= 1_000_000_000
    ? `$${(input.valuation_usd / 1_000_000_000).toFixed(2)}B`
    : `$${(input.valuation_usd / 1_000_000).toFixed(1)}M`
  return postSlack({
    text: `🎯 Cascade event · ${input.tenant_name} · IPO ${input.target_year} ${input.venue.toUpperCase()} · ${valM}`,
    icon_emoji: ':dart:',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🎯 Chairman Cascade · ${input.tenant_name}` } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*By:* ${input.actor_email}\n*IPO target:* ${input.target_year} · ${input.venue.toUpperCase()}\n*Valuation:* ${valM}\n*Industry:* ${input.industry}`,
        },
      },
      ...(input.journey_id
        ? [{
          type: 'context' as const,
          elements: [{ type: 'mrkdwn' as const, text: `<${APP_URL}/ipo-execution|Open journey> · 4 CHR objectives auto-created · 20 readiness criteria seeded` }],
        }]
        : []),
    ],
  })
}

export async function notifyRoundClosed(input: {
  tenant_name: string
  round_name: string
  amount_usd: number
  pre_money_usd?: number | null
  post_money_usd?: number | null
}) {
  const fmt = (n: number) => n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(2)}B` : `$${(n / 1_000_000).toFixed(1)}M`
  return postSlack({
    text: `💰 Round closed · ${input.tenant_name} · ${input.round_name} · ${fmt(input.amount_usd)}`,
    icon_emoji: ':moneybag:',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `💰 Round Closed · ${input.tenant_name}` } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Round:* ${input.round_name}\n*Raised:* ${fmt(input.amount_usd)}` +
            (input.pre_money_usd ? `\n*Pre-money:* ${fmt(input.pre_money_usd)}` : '') +
            (input.post_money_usd ? `\n*Post-money:* ${fmt(input.post_money_usd)}` : ''),
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `<${APP_URL}/cap-table|Cap table snapshot auto-created>` }],
      },
    ],
  })
}

export async function notifyCouncilResult(input: {
  tenant_name: string
  actor_email: string
  overall_score: number
  recommendation: string
  idea_summary: string
}) {
  const recEmoji = input.recommendation === 'go' ? ':white_check_mark:'
    : input.recommendation === 'no_go' ? ':x:'
    : input.recommendation === 'pivot' ? ':twisted_rightwards_arrows:'
    : ':hourglass_flowing_sand:'
  return postSlack({
    text: `${recEmoji} Council · ${input.tenant_name} · ${input.recommendation.toUpperCase()} · ${input.overall_score}/100`,
    icon_emoji: ':classical_building:',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${recEmoji} Council of 9 · ${input.tenant_name}` } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*By:* ${input.actor_email}\n*Score:* ${input.overall_score}/100\n*Recommendation:* *${input.recommendation.toUpperCase()}*\n*Idea:* ${input.idea_summary.slice(0, 240)}${input.idea_summary.length > 240 ? '…' : ''}`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `<${APP_URL}/council|Open full validation>` }],
      },
    ],
  })
}
