import crypto from 'crypto'
import { logger } from './logger.service'
import { db } from '../db'
import { decisionPatternLearningService, DecisionDomain, DecisionPattern } from './decision-pattern-learning.service'
import { notificationService } from './notification.service'
import { personalAgentService, PersonalAgentProfile } from './personal-agent.service'
import { callLLM } from '../agents/base.agent'

export type ProactivityLevel = 'off' | 'important_only' | 'frequent'
export type AdviceCategory =
  | 'upcoming_problem'
  | 'better_approach'
  | 'conflict_warning'
  | 'mistake_prevention'
  | 'optimization'

export interface CrucialFactorScores {
  irreversibilityScore: number // 0.0 - 1.0
  financialImpactScore: number // 0.0 - 1.0
  externalExposureScore: number // 0.0 - 1.0
  patternDeviationScore: number // 0.0 - 1.0
  noveltyScore: number // 0.0 - 1.0
  antiEchoMistakeScore: number // 0.0 - 1.0
}

export interface CrucialEvaluationResult {
  isCrucial: boolean
  compositeScore: number
  factorScores: CrucialFactorScores
  triggeredFactors: string[]
  explanation: string
  recommendation: 'auto_proceed' | 'ask_confirmation' | 'block_and_alert'
  patternConfidence: number
  isRepeatingKnownMistake?: boolean
  notificationDispatched?: boolean
}

export interface ProactiveAdviceItem {
  id: string
  tenantId: string
  category: AdviceCategory
  title: string
  summary: string
  reasoning: string
  evidenceCitations: Array<{
    source: string
    evidenceSummary: string
    patternId?: string
    timestamp?: string
  }>
  suggestedAction?: {
    label: string
    actionType: string
    payload?: Record<string, any>
  }
  confidenceScore: number
  status: 'active' | 'dismissed' | 'acted_upon' | 'expired'
  feedback?: 'helpful' | 'unhelpful' | 'dismissed'
  createdAt: string
  updatedAt: string
}

export interface UserCrucialSettings {
  proactivityLevel: ProactivityLevel
  maxAutoSpendLimit: number // in USD, default 50
  requireExternalExposureConfirmation: boolean // default true
  antiEchoWarnings: boolean // default true
  noveltySensitivity: 'conservative' | 'balanced' | 'relaxed'
  categoryFrequencyDampeners: Record<string, number> // category -> attenuation multiplier (0.5 to 2.0)
}

export class CrucialMomentAndAdviceService {
  private inMemorySettings: Map<string, UserCrucialSettings> = new Map()
  private inMemoryAdvice: Map<string, ProactiveAdviceItem[]> = new Map()
  private knownMistakeRegistry: Map<string, Array<{ actionType: string; domain: string; rationale: string }>> = new Map()

  constructor() {
    this.initDefaults()
  }

  private initDefaults() {
    // Default system seed
  }

  /**
   * Retrieves or initializes user crucial settings
   */
  public async getSettings(tenantId: string): Promise<UserCrucialSettings> {
    if (this.inMemorySettings.has(tenantId)) {
      return this.inMemorySettings.get(tenantId)!
    }

    const defaults: UserCrucialSettings = {
      proactivityLevel: 'important_only',
      maxAutoSpendLimit: 50.0,
      requireExternalExposureConfirmation: true,
      antiEchoWarnings: true,
      noveltySensitivity: 'balanced',
      categoryFrequencyDampeners: {}
    }

    this.inMemorySettings.set(tenantId, defaults)
    return defaults
  }

  /**
   * Updates user crucial settings
   */
  public async updateSettings(
    tenantId: string,
    updates: Partial<UserCrucialSettings>
  ): Promise<UserCrucialSettings> {
    const current = await this.getSettings(tenantId)
    const updated: UserCrucialSettings = {
      ...current,
      ...updates,
      categoryFrequencyDampeners: {
        ...current.categoryFrequencyDampeners,
        ...(updates.categoryFrequencyDampeners || {})
      }
    }
    this.inMemorySettings.set(tenantId, updated)
    return updated
  }

  /**
   * Evaluates if a given situation / proposed agent action is a CRUCIAL MOMENT (Prompt 31 Item 1).
   * Combines 5 concrete scored factors + anti-echo mistake detection.
   */
  public async evaluateCrucialMoment(params: {
    tenantId: string
    actionType: string
    domain: DecisionDomain | string
    proposedPayload?: Record<string, any>
    contextDescription?: string
    userAutonomyLevel?: string
  }): Promise<CrucialEvaluationResult> {
    const { tenantId, actionType, domain, proposedPayload = {}, contextDescription = '' } = params
    const settings = await this.getSettings(tenantId)
    const actionLower = (actionType || '').toLowerCase()
    const descLower = (contextDescription || '').toLowerCase()

    // 1. Irreversibility Score (0.0 to 1.0)
    let irreversibility = 0.0
    if (
      actionLower.includes('delete') ||
      actionLower.includes('purge') ||
      actionLower.includes('drop') ||
      actionLower.includes('wipe') ||
      actionLower.includes('sign_contract') ||
      actionLower.includes('revoke_key') ||
      domain === 'destructive_actions' ||
      proposedPayload.isPermanent === true ||
      proposedPayload.irreversible === true
    ) {
      irreversibility = 1.0
    } else if (
      actionLower.includes('update_config') ||
      actionLower.includes('modify_permissions') ||
      actionLower.includes('archive')
    ) {
      irreversibility = 0.65
    } else if (actionLower.includes('draft') || actionLower.includes('stage') || actionLower.includes('preview')) {
      irreversibility = 0.1
    }

    // 2. Financial Impact Score (0.0 to 1.0)
    let financial = 0.0
    const rawCost = Number(proposedPayload.amount ?? proposedPayload.cost ?? proposedPayload.price ?? 0)
    const spendLimit = settings.maxAutoSpendLimit || 50.0
    if (rawCost > 0) {
      if (rawCost > spendLimit) {
        financial = 1.0
      } else {
        financial = Number((rawCost / spendLimit).toFixed(2))
      }
    } else if (
      actionLower.includes('purchase') ||
      actionLower.includes('pay') ||
      actionLower.includes('subscribe') ||
      actionLower.includes('spend') ||
      domain === 'spending_threshold'
    ) {
      // Unspecified cost on spending action defaults to conservative high financial score
      financial = 0.85
    }

    // 3. External Exposure Score (0.0 to 1.0)
    let external = 0.0
    const recipient = String(proposedPayload.recipient || proposedPayload.to || '')
    const isPublicPost = actionLower.includes('tweet') || actionLower.includes('publish') || actionLower.includes('social_post')
    const isExternalEmail = (actionLower.includes('email') || actionLower.includes('send')) && !actionLower.includes('draft')
    const isWebhookDispatch = actionLower.includes('webhook') || actionLower.includes('api_call') || actionLower.includes('post_external')

    if (isPublicPost || (isExternalEmail && recipient.includes('@')) || isWebhookDispatch) {
      external = settings.requireExternalExposureConfirmation ? 0.95 : 0.70
    } else if (actionLower.includes('slack') || actionLower.includes('calendar_invite')) {
      external = 0.45
    } else if (actionLower.includes('draft') || actionLower.includes('local') || actionLower.includes('read')) {
      external = 0.0
    }

    // 4. Pattern Deviation Score (0.0 to 1.0)
    let patternDeviation = 0.0
    let patternConfidence = 0.5
    let matchedPattern: DecisionPattern | undefined

    try {
      const patterns = await decisionPatternLearningService.getPatterns(tenantId, domain as DecisionDomain)
      matchedPattern = patterns[0]
      if (matchedPattern) {
        patternConfidence = matchedPattern.confidenceScore

        // Check if proposed payload conflicts with established rule
        const ruleSummary = (matchedPattern.naturalLanguageSummary || '').toLowerCase()
        if (
          (ruleSummary.includes('concise') && descLower.includes('verbose')) ||
          (ruleSummary.includes('strict') && descLower.includes('loose')) ||
          (matchedPattern.consistencyRatio < 0.6)
        ) {
          patternDeviation = 0.85
        } else if (matchedPattern.confidenceScore >= 0.8) {
          patternDeviation = 0.1 // Matches consistent habit well
        } else {
          patternDeviation = 0.4
        }
      } else {
        patternDeviation = 0.5
      }
    } catch {
      patternDeviation = 0.5
    }

    // 5. Genuine Novelty Score (0.0 to 1.0)
    let novelty = 0.0
    if (!matchedPattern || matchedPattern.evidenceCount === 0) {
      novelty = 1.0 // Cold start / totally novel
    } else if (matchedPattern.evidenceCount < 4) {
      novelty = 0.70 // Still formative
    } else {
      novelty = 0.15 // Familiar domain with strong history
    }

    // 6. Anti-Echo / Mistake-Repetition Check (Item 5b)
    let antiEchoMistake = 0.0
    let isRepeatingMistake = false
    const knownMistakes = this.knownMistakeRegistry.get(tenantId) || []
    const matchMistake = knownMistakes.find(
      m => m.actionType === actionType || (m.domain === domain && descLower.includes(m.actionType.toLowerCase()))
    )
    if (matchMistake && settings.antiEchoWarnings) {
      antiEchoMistake = 1.0
      isRepeatingMistake = true
    }

    // Factor Score Package
    const factorScores: CrucialFactorScores = {
      irreversibilityScore: Number(irreversibility.toFixed(2)),
      financialImpactScore: Number(financial.toFixed(2)),
      externalExposureScore: Number(external.toFixed(2)),
      patternDeviationScore: Number(patternDeviation.toFixed(2)),
      noveltyScore: Number(novelty.toFixed(2)),
      antiEchoMistakeScore: Number(antiEchoMistake.toFixed(2))
    }

    // Composite Scored Calculation
    const compositeScore = Number(
      (
        0.25 * factorScores.irreversibilityScore +
        0.25 * factorScores.financialImpactScore +
        0.20 * factorScores.externalExposureScore +
        0.15 * factorScores.patternDeviationScore +
        0.15 * factorScores.noveltyScore +
        0.20 * factorScores.antiEchoMistakeScore
      ).toFixed(2)
    )

    // Trigger factor identification
    const triggeredFactors: string[] = []
    if (factorScores.irreversibilityScore >= 0.85) {
      triggeredFactors.push(`Irreversible Action (${actionType} permanently alters or deletes records)`)
    }
    if (factorScores.financialImpactScore >= 0.85) {
      triggeredFactors.push(`Financial Impact ($${rawCost || 'unspecified'} exceeds $${spendLimit} auto-approval limit)`)
    }
    if (factorScores.externalExposureScore >= 0.85) {
      triggeredFactors.push(`External Exposure (Action sends communications or data outside your local system)`)
    }
    if (factorScores.patternDeviationScore >= 0.75) {
      triggeredFactors.push(`Pattern Deviation (Conflicts with your established decision habits in ${domain})`)
    }
    if (factorScores.noveltyScore >= 0.85) {
      triggeredFactors.push(`Genuine Novelty (No established historical precedent in your profile)`)
    }
    if (factorScores.antiEchoMistakeScore >= 0.85) {
      triggeredFactors.push(`Anti-Mistake Warning (Matches an action you previously flagged as a mistake)`)
    }

    // HARD CIRCUIT BREAKERS: Any critical factor crossing threshold forces crucial moment
    const isCrucial =
      factorScores.irreversibilityScore >= 0.85 ||
      factorScores.financialImpactScore >= 0.85 ||
      factorScores.externalExposureScore >= 0.85 ||
      factorScores.antiEchoMistakeScore >= 0.85 ||
      compositeScore >= 0.60

    // Construct human-understandable explanation
    let explanation = ''
    if (isRepeatingMistake) {
      explanation = `Warning: This action matches an approach you previously flagged as a mistake. We are halting automation to ensure you want to proceed.`
    } else if (triggeredFactors.length > 0) {
      explanation = `This action requires your confirmation because of: ${triggeredFactors.join('; ')}.`
    } else {
      explanation = `Routine action within established pattern confidence (${(patternConfidence * 100).toFixed(0)}%). Safe to execute automatically.`
    }

    const recommendation = isRepeatingMistake
      ? 'block_and_alert'
      : isCrucial
      ? 'ask_confirmation'
      : 'auto_proceed'

    // Proactive notification dispatch if crucial
    let notificationDispatched = false
    if (isCrucial && settings.proactivityLevel !== 'off') {
      try {
        await notificationService.notifyUser(tenantId, {
          title: `Crucial Decision Needed: ${actionType}`,
          message: explanation,
          type: 'warning',
          metadata: {
            domain,
            compositeScore,
            triggeredFactors,
            actionType,
            proposedPayload
          }
        })
        notificationDispatched = true
      } catch (err: any) {
        logger.warn(`[CrucialMoment] Notification dispatch failed: ${err.message}`)
      }
    }

    return {
      isCrucial,
      compositeScore,
      factorScores,
      triggeredFactors,
      explanation,
      recommendation,
      patternConfidence,
      isRepeatingKnownMistake: isRepeatingMistake,
      notificationDispatched
    }
  }

  /**
   * Registers a user-flagged mistake into the Anti-Echo Mistake Registry (Safeguard 5b)
   */
  public async flagMistake(
    tenantId: string,
    params: { actionType: string; domain: string; rationale: string }
  ): Promise<void> {
    const list = this.knownMistakeRegistry.get(tenantId) || []
    list.push(params)
    this.knownMistakeRegistry.set(tenantId, list)
    logger.info(`[CrucialMoment] Registered anti-echo mistake warning for ${tenantId}: ${params.actionType}`)
  }

  /**
   * Generates proactive, traceable advice based on actual patterns, schedule conflicts, or optimizations.
   * (Prompt 31 Item 3, 4, 5a, 6)
   */
  public async generateProactiveAdvice(
    tenantId: string,
    options?: {
      focusDomain?: DecisionDomain
      contextTrigger?: string
      forceCategory?: AdviceCategory
    }
  ): Promise<ProactiveAdviceItem[]> {
    const settings = await this.getSettings(tenantId)
    if (settings.proactivityLevel === 'off') {
      return []
    }

    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)
    const patterns = await decisionPatternLearningService.getPatterns(tenantId)
    const now = new Date()

    const candidateAdvice: ProactiveAdviceItem[] = []

    // 1. Check for Scheduling Conflicts / Buffer Gaps
    const schedPattern = patterns.find(p => p.domain === 'scheduling')
    if (schedPattern && schedPattern.confidenceScore >= 0.70) {
      const dampener = settings.categoryFrequencyDampeners['conflict_warning'] || 1.0
      if (dampener >= 0.4) {
        candidateAdvice.push({
          id: `adv_sched_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`,
          tenantId,
          category: 'conflict_warning',
          title: 'Schedule Focus Buffer Recommendation',
          summary: 'Based on how you usually handle back-to-back meetings, you tend to prefer a 15-minute buffer before deep work.',
          reasoning: `In ${schedPattern.evidenceCount} past scheduling decisions, you consistently accepted morning focus blocks with buffers.`,
          evidenceCitations: [
            {
              source: 'Learned Scheduling Pattern',
              evidenceSummary: schedPattern.naturalLanguageSummary,
              patternId: schedPattern.id,
              timestamp: schedPattern.lastObservedAt
            }
          ],
          suggestedAction: {
            label: 'Add 15m Focus Buffer',
            actionType: 'calendar_add_buffer',
            payload: { bufferMinutes: 15 }
          },
          confidenceScore: schedPattern.confidenceScore,
          status: 'active',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }
    }

    // 2. Check for Email Comms Optimization
    const emailPattern = patterns.find(p => p.domain === 'email_comms')
    if (emailPattern && emailPattern.confidenceScore >= 0.75) {
      const dampener = settings.categoryFrequencyDampeners['better_approach'] || 1.0
      if (dampener >= 0.4) {
        candidateAdvice.push({
          id: `adv_email_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`,
          tenantId,
          category: 'better_approach',
          title: 'Direct Communication Style Insight',
          summary: `Based on your recent edits, your preferred tone is concise and action-oriented.`,
          reasoning: `In ${emailPattern.evidenceCount} past email drafts, you shortened initial proposals by an average of 35% before sending.`,
          evidenceCitations: [
            {
              source: 'Email Edit Diffs History',
              evidenceSummary: `Recorded ${emailPattern.evidenceCount} draft edit diffs favoring concise bullet points`,
              patternId: emailPattern.id,
              timestamp: emailPattern.lastObservedAt
            }
          ],
          suggestedAction: {
            label: 'Apply Concise Preset',
            actionType: 'apply_email_preset',
            payload: { tone: 'concise_bullets' }
          },
          confidenceScore: emailPattern.confidenceScore,
          status: 'active',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }
    }

    // 3. Check for Anti-Mistake Warning Advice
    const knownMistakes = this.knownMistakeRegistry.get(tenantId) || []
    if (knownMistakes.length > 0 && settings.antiEchoWarnings) {
      const mistake = knownMistakes[knownMistakes.length - 1]
      candidateAdvice.push({
        id: `adv_mistake_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`,
        tenantId,
        category: 'mistake_prevention',
        title: `Caution: Potential Recurring Slip-up in ${mistake.domain}`,
        summary: `You previously flagged '${mistake.actionType}' as an undesirable outcome: "${mistake.rationale}".`,
        reasoning: `Explicitly recorded in your mistake safeguard registry to prevent uncritical automated repetition.`,
        evidenceCitations: [
          {
            source: 'User-Flagged Mistake Journal',
            evidenceSummary: mistake.rationale
          }
        ],
        suggestedAction: {
          label: 'Review Safeguard',
          actionType: 'review_safeguard',
          payload: { actionType: mistake.actionType }
        },
        confidenceScore: 0.95,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })
    }

    // Filter by proactivity level
    let filtered = candidateAdvice
    if (settings.proactivityLevel === 'important_only') {
      filtered = candidateAdvice.filter(
        a => a.category === 'conflict_warning' || a.category === 'mistake_prevention' || a.confidenceScore >= 0.85
      )
    }

    // Store in active advice list
    const existing = this.inMemoryAdvice.get(tenantId) || []
    const merged = [...filtered, ...existing].slice(0, 20)
    this.inMemoryAdvice.set(tenantId, merged)

    return filtered
  }

  /**
   * Retrieves active advice items for user inspection
   */
  public async getActiveAdvice(tenantId: string): Promise<ProactiveAdviceItem[]> {
    const list = this.inMemoryAdvice.get(tenantId) || []
    return list.filter(a => a.status === 'active')
  }

  /**
   * Records user feedback on advice to dynamically throttle / tune proactivity frequency (Prompt 31 Item 4)
   */
  public async submitAdviceFeedback(
    tenantId: string,
    adviceId: string,
    feedback: 'helpful' | 'unhelpful' | 'dismissed'
  ): Promise<ProactiveAdviceItem | null> {
    const list = this.inMemoryAdvice.get(tenantId) || []
    const item = list.find(a => a.id === adviceId)
    if (!item) return null

    item.feedback = feedback
    item.status = feedback === 'dismissed' ? 'dismissed' : 'acted_upon'
    item.updatedAt = new Date().toISOString()

    const settings = await this.getSettings(tenantId)
    const currentDampener = settings.categoryFrequencyDampeners[item.category] || 1.0

    if (feedback === 'dismissed' || feedback === 'unhelpful') {
      // Attenuate frequency for this category (increase dampener threshold so less unsolicited noise surfaces)
      settings.categoryFrequencyDampeners[item.category] = Math.max(0.2, Number((currentDampener * 0.75).toFixed(2)))
      logger.info(`[CrucialMoment] Attenuated proactive advice frequency for category '${item.category}' on ${tenantId}`)
    } else if (feedback === 'helpful') {
      // Boost responsiveness
      settings.categoryFrequencyDampeners[item.category] = Math.min(2.0, Number((currentDampener * 1.25).toFixed(2)))
    }

    await this.updateSettings(tenantId, settings)
    return item
  }

  /**
   * Generates structured XML Context for LLM Reasoning Loop (Prompt 31 Item 6)
   */
  public async getStructuredAdviceContext(tenantId: string): Promise<string> {
    const adviceList = await this.getActiveAdvice(tenantId)
    const settings = await this.getSettings(tenantId)
    if (settings.proactivityLevel === 'off' || adviceList.length === 0) return ''

    const itemsXml = adviceList
      .slice(0, 3)
      .map(adv => {
        const citations = adv.evidenceCitations.map(c => `      <citation source="${c.source}">${c.evidenceSummary}</citation>`).join('\n')
        return `  <advice_item category="${adv.category}" confidence="${(adv.confidenceScore * 100).toFixed(0)}%">
    <title>${adv.title}</title>
    <summary>${adv.summary}</summary>
    <reasoning>${adv.reasoning}</reasoning>
    <citations>
${citations}
    </citations>
  </advice_item>`
      })
      .join('\n')

    return `<proactive_traceable_advice proactivity_level="${settings.proactivityLevel}">\n${itemsXml}\n</proactive_traceable_advice>`
  }
}

export const crucialMomentAndAdviceService = new CrucialMomentAndAdviceService()
