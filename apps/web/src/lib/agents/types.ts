/**
 * Shared types for the 108 Agent Legion + Council of 9 Validator.
 */

export type AgentRunMode = 'fast' | 'standard' | 'deep'

export type AgentRunInput = {
  prompt: string
  context?: Record<string, unknown>
  mode?: AgentRunMode
}

export type AgentRunOutput = {
  text: string
  score?: number
  structured?: unknown
  tokens: {
    input: number
    output: number
  }
  cost_usd: number
  duration_ms: number
}

export type CouncilVote = {
  agent: string
  vote: 'green' | 'amber' | 'red'
  score: number
  reasoning: string
}

export type CouncilResult = {
  overall_score: number
  recommendation: 'go' | 'revise' | 'no_go'
  votes: CouncilVote[]
  summary: string
}

/**
 * Catalog row shape — matches `agent_catalog` in migration 004_seed_content.sql.
 */
export type AgentCatalogRow = {
  agent_code: string
  name: string
  pantheon: 'greek' | 'roman' | 'vedic' | 'norse' | 'egyptian' | 'other'
  department: string
  role_description: string | null
  is_chief: boolean
  display_order: number | null
}
