import { logger } from './logger.service'
import { db } from '../db'
import crypto from 'crypto'

export type DecisionDomain =
  | 'email_comms'
  | 'code_style'
  | 'spending_threshold'
  | 'scheduling'
  | 'delegation_routing'
  | 'destructive_actions'
  | 'task_prioritization'

export type SignalSource =
  | 'permission_approval'
  | 'permission_rejection'
  | 'diff_edit'
  | 'option_choice'
  | 'explicit_preference'
  | 'communication_style'

export interface DecisionEvidence {
  id: string
  timestamp: string
  source: SignalSource
  summary: string
  supportsRule: boolean
  diff?: {
    proposed: string
    accepted: string
    additionsCount?: number
    deletionsCount?: number
  }
  diffDetails?: {
    originalProposed?: string
    userEdited?: string
    diffRatio?: number
  }
  choice?: {
    optionsPresented: string[]
    selectedOption: string
  }
  chosenOption?: string
  optionsPresented?: string[]
  context?: string
  weight: number
}

export interface DecisionPattern {
  id: string
  tenantId: string
  domain: DecisionDomain
  title: string
  rule: Record<string, any>
  naturalLanguageSummary: string
  confidenceScore: number // 0.0 to 1.0
  evidenceCount: number
  consistencyRatio: number // positive / total
  status: 'cold_start' | 'learning' | 'confident_automated' | 'user_pinned'
  evidenceLog: DecisionEvidence[]
  lastObservedAt: string
  createdAt: string
  updatedAt: string
  userOverride?: {
    isPinned: boolean
    userEditedRule?: string
    userSetConfidence?: number
  }
}

export interface AutonomyGateResult {
  allowAutoExecute: boolean
  decisionCode:
    | 'AUTO_EXECUTE_HIGH_CONFIDENCE'
    | 'ASK_USER_COLD_START'
    | 'ASK_USER_LOW_CONFIDENCE'
    | 'ASK_USER_HIGH_STAKES'
    | 'USER_OVERRIDE_PINNED'
  confidenceScore: number
  patternTitle?: string
  rationale: string
  evidenceSummary: string
}

export class DecisionPatternLearningService {
  private inMemoryPatterns: Map<string, DecisionPattern[]> = new Map() // tenantId -> patterns

  constructor() {
    this.initDefaultPatterns()
  }

  private initDefaultPatterns() {
    // Seed default baseline structures lazily per tenant
  }

  /**
   * Returns all learned decision patterns for a tenant
   */
  public async getPatterns(tenantId: string, domain?: DecisionDomain): Promise<DecisionPattern[]> {
    let list = this.inMemoryPatterns.get(tenantId)
    if (!list) {
      list = await this.loadFromDb(tenantId)
      this.inMemoryPatterns.set(tenantId, list)
    }

    if (domain) {
      return list.filter(p => p.domain === domain)
    }
    return list
  }

  /**
   * Retrieves single pattern by ID
   */
  public async getPatternById(tenantId: string, patternId: string): Promise<DecisionPattern | null> {
    const list = await this.getPatterns(tenantId)
    return list.find(p => p.id === patternId) || null
  }

  /**
   * Records a behavioral signal from approval history, diff edits, explicit chats, or option choices.
   */
  public async recordSignal(
    arg1: string | {
      tenantId: string
      domain: DecisionDomain
      source?: SignalSource
      signalSource?: SignalSource
      summary?: string
      contextSummary?: string
      userDecision?: 'approved' | 'rejected' | 'edited' | 'chosen'
      supportsRule?: boolean
      diff?: { proposed: string; accepted: string }
      diffDetails?: { originalProposed?: string; userEdited?: string; diffRatio?: number }
      choice?: { optionsPresented: string[]; selectedOption: string }
      chosenOption?: string
      optionsPresented?: string[]
      context?: string
      inferredRule?: Record<string, any>
      naturalLanguageRule?: string
      weight?: number
      timestamp?: string
    },
    arg2?: {
      domain: DecisionDomain
      source?: SignalSource
      signalSource?: SignalSource
      summary?: string
      contextSummary?: string
      userDecision?: 'approved' | 'rejected' | 'edited' | 'chosen'
      supportsRule?: boolean
      diff?: { proposed: string; accepted: string }
      diffDetails?: { originalProposed?: string; userEdited?: string; diffRatio?: number }
      choice?: { optionsPresented: string[]; selectedOption: string }
      chosenOption?: string
      optionsPresented?: string[]
      context?: string
      inferredRule?: Record<string, any>
      naturalLanguageRule?: string
      weight?: number
      timestamp?: string
    }
  ): Promise<DecisionPattern & { pattern: DecisionPattern; gateStatus: string }> {
    const tenantId = typeof arg1 === 'string' ? arg1 : arg1.tenantId
    const rawParams = typeof arg1 === 'string' ? arg2 || {} : arg1

    const domain = (rawParams.domain || 'email_comms') as DecisionDomain
    const source = (rawParams.source || rawParams.signalSource || 'permission_decision') as SignalSource
    const summary = rawParams.summary || rawParams.contextSummary || 'Observed decision'
    
    let supportsRule = true
    if (rawParams.supportsRule !== undefined) {
      supportsRule = rawParams.supportsRule
    } else if (rawParams.userDecision) {
      supportsRule = rawParams.userDecision !== 'rejected'
    }

    const now = rawParams.timestamp || new Date().toISOString()
    const weight = rawParams.weight || 1.0

    // Compute diff stats if provided
    let diffPayload: DecisionEvidence['diff'] = undefined
    if (rawParams.diff) {
      const pLen = rawParams.diff.proposed.length
      const aLen = rawParams.diff.accepted.length
      diffPayload = {
        proposed: rawParams.diff.proposed,
        accepted: rawParams.diff.accepted,
        additionsCount: Math.max(0, aLen - pLen),
        deletionsCount: Math.max(0, pLen - aLen)
      }
    } else if (rawParams.diffDetails) {
      const prop = rawParams.diffDetails.originalProposed || ''
      const acc = rawParams.diffDetails.userEdited || ''
      diffPayload = {
        proposed: prop,
        accepted: acc,
        additionsCount: Math.max(0, acc.length - prop.length),
        deletionsCount: Math.max(0, prop.length - acc.length)
      }
    }

    let choicePayload: DecisionEvidence['choice'] = undefined
    if (rawParams.choice) {
      choicePayload = rawParams.choice
    } else if (rawParams.chosenOption) {
      choicePayload = {
        optionsPresented: rawParams.optionsPresented || [],
        selectedOption: rawParams.chosenOption
      }
    }

    const diffDetails = diffPayload
      ? {
          originalProposed: diffPayload.proposed,
          userEdited: diffPayload.accepted,
          diffRatio: 0.5
        }
      : (rawParams.diffDetails ? {
          originalProposed: rawParams.diffDetails.originalProposed || '',
          userEdited: rawParams.diffDetails.userEdited || '',
          diffRatio: rawParams.diffDetails.diffRatio || 0.5
        } : undefined)

    const chosenOption = choicePayload?.selectedOption || rawParams.chosenOption

    const evidenceItem: DecisionEvidence = {
      id: `ev_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
      timestamp: now,
      source,
      summary,
      supportsRule,
      diff: diffPayload,
      diffDetails,
      choice: choicePayload,
      chosenOption,
      optionsPresented: choicePayload?.optionsPresented || rawParams.optionsPresented,
      context: rawParams.context,
      weight
    }

    const patterns = await this.getPatterns(tenantId)

    // Find matching pattern in this domain
    let pattern = patterns.find(p => p.domain === domain)

    if (!pattern) {
      // Create new pattern
      const newId = `pat_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`
      const naturalTitle = rawParams.naturalLanguageRule || this.synthesizeTitle(domain, summary)

      pattern = {
        id: newId,
        tenantId,
        domain,
        title: naturalTitle,
        rule: rawParams.inferredRule || { default: true },
        naturalLanguageSummary: naturalTitle,
        confidenceScore: 0.5,
        evidenceCount: 1,
        consistencyRatio: supportsRule ? 1.0 : 0.0,
        status: 'cold_start',
        evidenceLog: [evidenceItem],
        lastObservedAt: now,
        createdAt: now,
        updatedAt: now
      }
      patterns.push(pattern)
    } else {
      // Append evidence
      pattern.evidenceLog.unshift(evidenceItem)
      // Cap log length to 100 entries
      if (pattern.evidenceLog.length > 100) {
        pattern.evidenceLog = pattern.evidenceLog.slice(0, 100)
      }
      pattern.evidenceCount = pattern.evidenceLog.length
      pattern.lastObservedAt = now
      pattern.updatedAt = now

      if (rawParams.inferredRule) {
        pattern.rule = { ...pattern.rule, ...rawParams.inferredRule }
      }
      if (rawParams.naturalLanguageRule && !pattern.userOverride?.isPinned) {
        pattern.naturalLanguageSummary = rawParams.naturalLanguageRule
        pattern.title = rawParams.naturalLanguageRule
      }
    }

    // Recalculate explainable confidence and consistency
    this.recalculatePatternConfidence(pattern)

    this.inMemoryPatterns.set(tenantId, patterns)
    await this.saveToDb(pattern)

    const gate = await this.evaluateAutonomyGate(tenantId, {
      domain: pattern.domain,
      actionType: 'routine_decision',
      stakesLevel: 'low'
    })

    const result = Object.assign(pattern, {
      pattern,
      gateStatus: gate.decisionCode
    })

    return result

    logger.info(
      `[DecisionPatternLearning] Ingested signal for '${params.domain}' (${params.source}). New confidence: ${(pattern.confidenceScore * 100).toFixed(1)}% [${pattern.status}]`
    )

    return { pattern, gateStatus: pattern.status }
  }

  /**
   * Explainable Confidence & Consistency Algorithm:
   * 1. Sample Size Weighting: 1 - exp(-k * N) to prevent day-1 overconfidence.
   * 2. Consistency Ratio: positive / total evidence.
   * 3. Recency Decay: Recent contradictory choices apply higher drag than old history.
   * 4. User Pinning Override: If user explicitly sets rule or pins it, confidence stays fixed.
   */
  public recalculatePatternConfidence(pattern: DecisionPattern): void {
    if (pattern.userOverride?.isPinned && pattern.userOverride.userSetConfidence !== undefined) {
      pattern.confidenceScore = pattern.userOverride.userSetConfidence
      pattern.status = 'user_pinned'
      return
    }

    const total = pattern.evidenceLog.length
    if (total === 0) {
      pattern.confidenceScore = 0.0
      pattern.consistencyRatio = 0.0
      pattern.status = 'cold_start'
      return
    }

    // Count weighted positive & negative
    let positiveWeight = 0
    let totalWeight = 0
    const nowMs = Date.now()

    // Inspect recent window (last 5 decisions) for outlier detection
    const recentWindow = pattern.evidenceLog.slice(0, 5)
    let recentContradictions = 0

    pattern.evidenceLog.forEach((ev, idx) => {
      // Exponential time decay (half life: 90 days)
      const ageDays = Math.max(0, (nowMs - new Date(ev.timestamp).getTime()) / (1000 * 60 * 60 * 24))
      const timeDecay = Math.pow(0.5, ageDays / 90)
      const effectiveWeight = ev.weight * timeDecay

      totalWeight += effectiveWeight
      if (ev.supportsRule) {
        positiveWeight += effectiveWeight
      } else if (idx < 5) {
        recentContradictions++
      }
    })

    const consistency = totalWeight > 0 ? positiveWeight / totalWeight : 0.5
    pattern.consistencyRatio = Number(consistency.toFixed(3))

    // Sample size asymptotic ramp (requires at least 5 observations to hit >= 0.85 confidence)
    const sampleWeight = 1 - Math.exp(-0.4 * total)

    // Raw calculated score
    let score = consistency * sampleWeight

    // Cold start floor: If under 4 samples, keep below automation threshold (0.75)
    if (total < 4) {
      score = Math.min(score, 0.65)
      pattern.status = 'cold_start'
    } else if (score >= 0.80 && recentContradictions <= 1) {
      pattern.status = 'confident_automated'
    } else {
      pattern.status = 'learning'
    }

    // Contradiction drag: If user recently made 3 contrary choices in a row,
    // don't flip the entire long-term model, but lower confidence safely to trigger confirmation
    if (recentContradictions >= 2) {
      score = Math.min(score, 0.74)
      pattern.status = 'learning'
    }

    pattern.confidenceScore = Number(Math.max(0.1, Math.min(0.99, score)).toFixed(2))
  }

  /**
   * Autonomy Gate Evaluator: Decides whether to auto-execute or ask user confirmation.
   */
  public async evaluateAutonomyGate(
    tenantId: string,
    params: {
      domain: DecisionDomain
      actionType: string
      stakesLevel: 'low' | 'medium' | 'high'
      proposedPayload?: any
      userConfiguredThreshold?: number
    }
  ): Promise<AutonomyGateResult> {
    const threshold = params.userConfiguredThreshold ?? 0.80
    const patterns = await this.getPatterns(tenantId, params.domain)
    const pattern = patterns[0]

    // 1. High-Stakes Circuit Breaker (Always Ask)
    if (params.stakesLevel === 'high' || params.domain === 'destructive_actions') {
      return {
        allowAutoExecute: false,
        decisionCode: 'ASK_USER_HIGH_STAKES',
        confidenceScore: pattern ? pattern.confidenceScore : 0.0,
        patternTitle: pattern?.title,
        rationale: `This action (${params.actionType}) is marked high-stakes. Autonomy policy requires user confirmation regardless of confidence score.`,
        evidenceSummary: pattern ? `Based on ${pattern.evidenceCount} historical observations` : 'No history'
      }
    }

    // 2. User Pinned Rule (User explicitly asserted/pinned rule, overrides cold start)
    if (pattern && (pattern.status === 'user_pinned' || pattern.userOverride?.isPinned)) {
      return {
        allowAutoExecute: true,
        decisionCode: 'USER_OVERRIDE_PINNED',
        confidenceScore: pattern.confidenceScore,
        patternTitle: pattern.title,
        rationale: `Automated via your pinned explicit preference: "${pattern.title}".`,
        evidenceSummary: `Explicitly customized & pinned by user`
      }
    }

    // 3. Cold Start Protection
    if (!pattern || pattern.status === 'cold_start' || pattern.evidenceCount < 4) {
      const obsCount = pattern?.evidenceCount || 0
      return {
        allowAutoExecute: false,
        decisionCode: 'ASK_USER_COLD_START',
        confidenceScore: pattern?.confidenceScore || 0.3,
        patternTitle: pattern?.title,
        rationale: `Still learning your preferences in ${params.domain} (${obsCount} observation${obsCount === 1 ? '' : 's'} recorded). Asking for confirmation.`,
        evidenceSummary: `Needs at least 4 consistent decisions to automate (currently ${obsCount})`
      }
    }

    // 4. High Confidence vs Low Confidence Match
    if (pattern.confidenceScore >= threshold) {
      return {
        allowAutoExecute: true,
        decisionCode: 'AUTO_EXECUTE_HIGH_CONFIDENCE',
        confidenceScore: pattern.confidenceScore,
        patternTitle: pattern.title,
        rationale: `Automated with ${(pattern.confidenceScore * 100).toFixed(0)}% confidence based on ${pattern.evidenceCount} consistent past decisions.`,
        evidenceSummary: `Supported by ${pattern.evidenceCount} decisions (${(pattern.consistencyRatio * 100).toFixed(0)}% consistency)`
      }
    }

    return {
      allowAutoExecute: false,
      decisionCode: 'ASK_USER_LOW_CONFIDENCE',
      confidenceScore: pattern.confidenceScore,
      patternTitle: pattern.title,
      rationale: `Confidence is ${(pattern.confidenceScore * 100).toFixed(0)}% (below ${threshold * 100}% automation threshold). Asking for your choice.`,
      evidenceSummary: `${pattern.evidenceCount} past decisions recorded with mixed recent outcomes`
    }
  }

  /**
   * Structured Context Generator for Agent Reasoning (Agent-Brain / ReAct Loop):
   * Generates targeted, concise XML/Markdown context for the active domain rather than dumping all memory.
   */
  public async getStructuredDecisionContext(
    tenantId: string,
    domain?: DecisionDomain
  ): Promise<string> {
    const patterns = await this.getPatterns(tenantId, domain)
    if (!patterns || patterns.length === 0) return ''

    const relevant = patterns.filter(p => p.confidenceScore >= 0.60)
    if (relevant.length === 0) return ''

    const items = relevant
      .map(p => {
        return `  <pattern domain="${p.domain}" confidence="${(p.confidenceScore * 100).toFixed(0)}%" evidence_count="${p.evidenceCount}" status="${p.status}">
    ${p.naturalLanguageSummary}
  </pattern>`
      })
      .join('\n')

    return `<user_decision_patterns>\n${items}\n</user_decision_patterns>`
  }

  /**
   * User Edit / Pinning Interface (Prompt 30 Item 6)
   */
  public async updateUserPattern(
    tenantId: string,
    patternId: string,
    updates: {
      userEditedRule?: string
      userSetConfidence?: number
      isPinned?: boolean
      title?: string
    }
  ): Promise<DecisionPattern | null> {
    const patterns = await this.getPatterns(tenantId)
    const p = patterns.find(item => item.id === patternId)
    if (!p) return null

    if (!p.userOverride) p.userOverride = { isPinned: false }
    if (updates.isPinned !== undefined) p.userOverride.isPinned = updates.isPinned
    if (updates.userEditedRule !== undefined) {
      p.userOverride.userEditedRule = updates.userEditedRule
      p.naturalLanguageSummary = updates.userEditedRule
      p.title = updates.userEditedRule
    }
    if (updates.userSetConfidence !== undefined) {
      p.userOverride.userSetConfidence = updates.userSetConfidence
      p.confidenceScore = updates.userSetConfidence
    }
    if (updates.title) p.title = updates.title

    p.status = p.userOverride.isPinned ? 'user_pinned' : p.status
    p.updatedAt = new Date().toISOString()

    this.recalculatePatternConfidence(p)
    await this.saveToDb(p)
    return p
  }

  /**
   * Deletes a learned pattern and its associated historical evidence
   */
  public async deletePattern(tenantId: string, patternId: string): Promise<boolean> {
    const patterns = await this.getPatterns(tenantId)
    const idx = patterns.findIndex(p => p.id === patternId)
    if (idx >= 0) {
      patterns.splice(idx, 1)
      this.inMemoryPatterns.set(tenantId, patterns)
      await db.query(
        `DELETE FROM personal_agent_decision_patterns WHERE id = $1 AND tenant_id = $2`,
        [patternId, tenantId]
      ).catch(() => {})
      return true
    }
    return false
  }

  /**
   * Hard wipe all decision patterns for a tenant (Data Sovereignty)
   */
  public async wipeAllTenantPatterns(tenantId: string): Promise<number> {
    const patterns = await this.getPatterns(tenantId)
    const count = patterns.length
    this.inMemoryPatterns.delete(tenantId)

    await db.query(
      `DELETE FROM personal_agent_decision_patterns WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => {})

    return count
  }

  private synthesizeTitle(domain: DecisionDomain, summary: string): string {
    if (domain === 'email_comms') return `Email Drafting Style: ${summary.slice(0, 45)}`
    if (domain === 'code_style') return `Code Engineering Preference: ${summary.slice(0, 45)}`
    if (domain === 'spending_threshold') return `Spending Approval Rule: ${summary.slice(0, 45)}`
    if (domain === 'scheduling') return `Calendar & Meeting Routine: ${summary.slice(0, 45)}`
    if (domain === 'delegation_routing') return `Specialist Delegation Habit: ${summary.slice(0, 45)}`
    return `Learned Pattern: ${summary.slice(0, 45)}`
  }

  private async loadFromDb(tenantId: string): Promise<DecisionPattern[]> {
    try {
      const { rows } = await db.query(
        `SELECT * FROM personal_agent_decision_patterns WHERE tenant_id = $1 ORDER BY confidence_score DESC`,
        [tenantId]
      ).catch(() => ({ rows: [] }))

      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenant_id,
          domain: r.domain,
          title: r.title,
          rule: typeof r.rule === 'string' ? JSON.parse(r.rule) : r.rule || {},
          naturalLanguageSummary: r.natural_language_summary || r.title,
          confidenceScore: Number(r.confidence_score) || 0.5,
          evidenceCount: Number(r.evidence_count) || 0,
          consistencyRatio: Number(r.consistency_ratio) || 1.0,
          status: r.status || 'learning',
          evidenceLog: typeof r.evidence_log === 'string' ? JSON.parse(r.evidence_log) : r.evidence_log || [],
          lastObservedAt: r.last_observed_at || r.created_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          userOverride: typeof r.user_override === 'string' ? JSON.parse(r.user_override) : r.user_override
        }))
      }
    } catch (err: any) {
      logger.warn(`[DecisionPatternLearning] DB load fallback: ${err.message}`)
    }
    return []
  }

  private async saveToDb(pattern: DecisionPattern): Promise<void> {
    try {
      await db.query(
        `INSERT INTO personal_agent_decision_patterns 
         (id, tenant_id, domain, title, rule, natural_language_summary, confidence_score, evidence_count, consistency_ratio, status, evidence_log, user_override, last_observed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           rule = EXCLUDED.rule,
           natural_language_summary = EXCLUDED.natural_language_summary,
           confidence_score = EXCLUDED.confidence_score,
           evidence_count = EXCLUDED.evidence_count,
           consistency_ratio = EXCLUDED.consistency_ratio,
           status = EXCLUDED.status,
           evidence_log = EXCLUDED.evidence_log,
           user_override = EXCLUDED.user_override,
           last_observed_at = EXCLUDED.last_observed_at,
           updated_at = NOW()`,
        [
          pattern.id,
          pattern.tenantId,
          pattern.domain,
          pattern.title,
          JSON.stringify(pattern.rule),
          pattern.naturalLanguageSummary,
          pattern.confidenceScore,
          pattern.evidenceCount,
          pattern.consistencyRatio,
          pattern.status,
          JSON.stringify(pattern.evidenceLog),
          JSON.stringify(pattern.userOverride || {}),
          pattern.lastObservedAt,
          pattern.createdAt,
          pattern.updatedAt
        ]
      ).catch(() => {})
    } catch (err: any) {
      logger.warn(`[DecisionPatternLearning] DB save warning: ${err.message}`)
    }
  }
}

export const decisionPatternLearningService = new DecisionPatternLearningService()
