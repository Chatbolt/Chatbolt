import { Router, Request, Response } from 'express'
import { personalAgentService } from '../services/personal-agent.service'
import { decisionPatternLearningService, DecisionDomain } from '../services/decision-pattern-learning.service'
import { crucialMomentAndAdviceService } from '../services/crucial-moment-and-advice.service'
import { personalAgentVoiceService } from '../services/personal-agent-voice.service'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'

const router = Router()

/**
 * Helper to extract tenantId from authenticated request or fallback
 */
function getTenantId(req: Request): string {
  return (req as any).user?.tenant_id || (req as any).user?.id || (req as any).tenant?.id || 'd34930ea-af1a-4094-9082-b47df3fb8075'
}

/**
 * GET /api/personal-agent
 * Returns the user's persistent personal assistant profile
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const profile = await personalAgentService.getOrCreatePersonalAgent(tenantId)
    res.json({ success: true, profile })
  } catch (err: any) {
    logger.error(`[PersonalAgent] Failed to fetch profile: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent
 * Updates personal assistant settings, name, or persona
 */
router.patch('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const profile = await personalAgentService.updatePersonalAgent(tenantId, req.body)
    res.json({ success: true, profile })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/onboarding
 * Completes the quick onboarding conversation flow
 */
router.post('/onboarding', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const profile = await personalAgentService.completeOnboarding(tenantId, req.body)
    res.json({ success: true, profile })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/messages
 * Retrieves the indefinite persistent conversation history
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)
    const limit = parseInt(req.query.limit as string) || 50
    const messages = await personalAgentService.getMessages(agent.id, limit)
    res.json({ success: true, messages })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/chat
 * Sends a message to the personal assistant (with memory injection & specialist delegation)
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { message } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message text is required' })
    }

    const result = await personalAgentService.chat(tenantId, message)
    res.json({
      success: true,
      ...result
    })
  } catch (err: any) {
    logger.error(`[PersonalAgent] Chat error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/memories
 * Inspects facts and preferences learned about the user
 */
router.get('/memories', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)
    const category = req.query.category as string
    const memories = await personalAgentService.getMemories(agent.id, category)
    res.json({ success: true, memories, total: memories.length })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/memories
 * Adds a new fact or preference explicitly
 */
router.post('/memories', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)
    const { key, value, category, importance } = req.body

    if (!key || !value) {
      return res.status(400).json({ success: false, error: 'Key and Value are required' })
    }

    const memory = await personalAgentService.addMemory({
      personalAgentId: agent.id,
      tenantId,
      key,
      value,
      category,
      importance
    })

    res.json({ success: true, memory })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent/memories/:id
 * User corrects or edits an existing memory
 */
router.patch('/memories/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const updated = await personalAgentService.updateMemory(id, tenantId, req.body)

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Memory item not found' })
    }

    res.json({ success: true, memory: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/personal-agent/memories/:id
 * Deletes a memory item
 */
router.delete('/memories/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const deleted = await personalAgentService.deleteMemory(id, tenantId)
    res.json({ success: deleted })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Data Sovereignty & Pluggable Storage Endpoints ────────────────

/**
 * GET /api/personal-agent/storage
 * Where is my data view: returns active backend, stats, physical path, and guarantees
 */
router.get('/storage', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const data = await personalAgentService.getSovereigntyOverview(tenantId)
    res.json({ success: true, ...data })
  } catch (err: any) {
    logger.error(`[PersonalAgent:Storage] Failed to load overview: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/storage/configure
 * Switch storage backend (hosted, local file, byo s3, self-hosted postgres)
 */
router.post('/storage/configure', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { config, migrateExistingData } = req.body
    const result = await personalAgentService.configureStorage(tenantId, config || {}, Boolean(migrateExistingData))
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/storage/test
 * Test connection to custom storage backend
 */
router.post('/storage/test', async (req: Request, res: Response) => {
  try {
    const result = await personalAgentService.testStorageConnection(req.body)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/storage/passphrase
 * Set or change user-controlled encryption passphrase
 */
router.post('/storage/passphrase', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { passphrase } = req.body
    if (!passphrase || typeof passphrase !== 'string' || passphrase.length < 6) {
      return res.status(400).json({ success: false, error: 'Passphrase must be at least 6 characters' })
    }
    const result = personalAgentService.setPassphrase(tenantId, passphrase)
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/storage/unlock
 * Unlock encryption with user passphrase
 */
router.post('/storage/unlock', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { passphrase } = req.body
    const valid = personalAgentService.unlockPassphrase(tenantId, passphrase || '')
    res.json({ success: valid, unlocked: valid })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/storage/export
 * One-click full data export package (memories, conversations, profile, checksum)
 */
router.get('/storage/export', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const exportBundle = await personalAgentService.exportAllData(tenantId)
    
    // Provide headers for direct browser file download
    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chatbolt-personal-data-${tenantId.slice(0, 8)}-${Date.now()}.json"`
    )
    res.json(exportBundle)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/storage/permanent-delete
 * One-click physical permanent wipe of all PersonalAgent data from active storage
 */
router.post('/storage/permanent-delete', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { confirm } = req.body

    if (confirm !== 'PERMANENT_DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Explicit confirmation string "PERMANENT_DELETE" required'
      })
    }

    const result = await personalAgentService.permanentHardDelete(tenantId)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Background Scheduling, Triggering & Proactive Outreach ───────

import { personalAgentSchedulerService } from '../services/personal-agent-scheduler.service'

/**
 * GET /api/personal-agent/background/digest
 * "What did my assistant do while I was away": Executive activity digest
 */
router.get('/background/digest', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const timeframe = (req.query.timeframe as '24h' | '7d' | 'all') || '24h'
    const digest = await personalAgentSchedulerService.getExecutiveDigest(tenantId, timeframe)
    res.json({ success: true, digest })
  } catch (err: any) {
    logger.error(`[PersonalAgent:Scheduler] Digest fetch error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/background/triggers
 * Lists all recurring routines, timers, and event watchers
 */
router.get('/background/triggers', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const triggers = await personalAgentSchedulerService.listTriggers(tenantId)
    res.json({ success: true, triggers })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/triggers
 * Creates a new recurring check, timer, or event watcher
 */
router.post('/background/triggers', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const trigger = await personalAgentSchedulerService.createTrigger(tenantId, req.body)
    res.json({ success: true, trigger })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent/background/triggers/:id/status
 * Pauses or resumes a trigger
 */
router.patch('/background/triggers/:id/status', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const { status } = req.body // 'active' | 'paused'
    const trigger = await personalAgentSchedulerService.toggleTriggerStatus(id, tenantId, status)
    if (!trigger) {
      return res.status(404).json({ success: false, error: 'Trigger not found' })
    }
    res.json({ success: true, trigger })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/personal-agent/background/triggers/:id
 * Deletes a scheduled trigger
 */
router.delete('/background/triggers/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const deleted = await personalAgentSchedulerService.deleteTrigger(id, tenantId)
    res.json({ success: deleted })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/triggers/:id/run
 * Forces immediate manual test execution of a trigger
 */
router.post('/background/triggers/:id/run', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const run = await personalAgentSchedulerService.runTriggerNow(id, tenantId)
    if (!run) {
      return res.status(404).json({ success: false, error: 'Trigger not found' })
    }
    res.json({ success: true, run })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/approvals/:id/approve
 * Human-in-the-loop: approves pending background action
 */
router.post('/background/approvals/:id/approve', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const { rationale } = req.body
    const result = await personalAgentSchedulerService.approvePendingAction(id, tenantId, rationale)
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/approvals/:id/reject
 * Human-in-the-loop: rejects pending background action
 */
router.post('/background/approvals/:id/reject', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { id } = req.params
    const { rationale } = req.body
    const result = await personalAgentSchedulerService.rejectPendingAction(id, tenantId, rationale)
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/simulate-event
 * Simulates an incoming integration webhook event (e.g. calendar invite, incoming email)
 */
router.post('/background/simulate-event', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { source, eventType, payload } = req.body
    const result = await personalAgentSchedulerService.handleIncomingIntegrationEvent(
      tenantId,
      source || 'google_calendar',
      eventType || 'meeting_upcoming',
      payload || { title: 'Strategy & Roadmap Review' }
    )
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/background/simulate-multiday
 * Simulates multi-day autonomous background executions for multi-day reliability verification
 */
router.post('/background/simulate-multiday', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const days = parseInt(req.body.days) || 3
    const result = await personalAgentSchedulerService.simulateMultiDayScenario(tenantId, days)
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/background/stream
 * Real-time SSE stream for live background updates & approvals
 */
router.get('/background/stream', (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write(`data: ${JSON.stringify({ type: 'connected', tenantId })}\n\n`)

  const unsubscribe = personalAgentSchedulerService.subscribeToEvents(evt => {
    if (evt.tenantId === tenantId) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`)
    }
  })

  req.on('close', () => {
    unsubscribe()
  })
})


// ── BYOK Fast-Track Provider & Setup Endpoints ───────────────────

import { personalAgentByokService, ByokProvider } from '../services/personal-agent-byok.service'
import { personalAgentChannelService } from '../services/personal-agent-channel.service'

/**
 * GET /api/personal-agent/byok/providers
 * Returns supported BYOK providers with Groq marked as recommended default
 */
router.get('/byok/providers', (req: Request, res: Response) => {
  const providers = personalAgentByokService.getProviders()
  res.json({ success: true, providers })
})

/**
 * POST /api/personal-agent/byok/validate
 * Fast validation ping for user API keys (Groq, OpenAI, Anthropic, etc.)
 */
router.post('/byok/validate', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body
    const result = await personalAgentByokService.validateKey(provider as ByokProvider, apiKey)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/byok/save
 * Securely saves validated BYOK config with $0 platform markup declaration
 */
router.post('/byok/save', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { provider, apiKey, model } = req.body
    if (!provider || !apiKey) {
      return res.status(400).json({ success: false, error: 'Provider and API Key required' })
    }
    const result = await personalAgentByokService.saveByokConfig(tenantId, provider, apiKey, model)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/byok/status
 * Returns current BYOK status and zero-cost guarantee
 */
router.get('/byok/status', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const status = await personalAgentByokService.getByokStatus(tenantId)
    res.json({ success: true, ...status })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Multi-Channel Endpoints: Chrome Extension & Email-In ──────────

/**
 * GET /api/personal-agent/channels
 * Returns status and access instructions for Dashboard, Chrome Extension, and Email-In
 */
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const overview = await personalAgentChannelService.getChannelsOverview(tenantId)
    res.json({ success: true, ...overview })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/email-in
 * Webhook endpoint for incoming email processing & routing to PersonalAgent
 */
router.post('/email-in', async (req: Request, res: Response) => {
  try {
    const { from, to, subject, text, html, body, attachments } = req.body

    if (!from || (!text && !body && !html && !subject)) {
      return res.status(400).json({
        success: false,
        error: 'Email payload requires at least a "from" address and subject/body text'
      })
    }

    const result = await personalAgentChannelService.processEmailIn({
      from,
      to: to || 'assistant@in.chatbolt.ai',
      subject: subject || 'No Subject',
      text,
      html,
      body,
      attachments
    })

    res.json(result)
  } catch (err: any) {
    logger.error(`[PersonalAgent:EmailIn] Error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/extension/action
 * Handles actions dispatched directly from the Chrome Extension
 */
router.post('/extension/action', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { action, prompt, pageUrl, pageTitle, pageContent, selectedText } = req.body

    const result = await personalAgentChannelService.processChromeExtensionAction({
      tenantId,
      action: action || 'chat',
      prompt,
      pageUrl,
      pageTitle,
      pageContent,
      selectedText
    })

    res.json(result)
  } catch (err: any) {
    logger.error(`[PersonalAgent:Extension] Error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Decision Pattern Learning & Autonomy Gating Endpoints ────────

import { decisionPatternLearningService, DecisionDomain } from '../services/decision-pattern-learning.service'

/**
 * GET /api/personal-agent/decision-patterns
 * Lists all learned decision patterns, confidence scores, and domain breakdowns
 */
router.get('/decision-patterns', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const domain = req.query.domain as DecisionDomain | undefined
    const patterns = await decisionPatternLearningService.getPatterns(tenantId, domain)
    
    // Calculate aggregate intelligence stats
    const totalDecisions = patterns.reduce((sum, p) => sum + p.evidenceCount, 0)
    const automatedCount = patterns.filter(p => p.status === 'confident_automated' || p.status === 'user_pinned').length
    const learningCount = patterns.filter(p => p.status === 'learning').length
    const coldStartCount = patterns.filter(p => p.status === 'cold_start').length

    res.json({
      success: true,
      patterns,
      stats: {
        totalPatterns: patterns.length,
        totalDecisionsObserved: totalDecisions,
        automatedPatternsCount: automatedCount,
        learningCount,
        coldStartCount
      }
    })
  } catch (err: any) {
    logger.error(`[PersonalAgent:DecisionPatterns] List error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/decision-patterns/:id/evidence
 * Retrieves transparent line-by-line evidence log for a pattern
 */
router.get('/decision-patterns/:id/evidence', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const pattern = await decisionPatternLearningService.getPatternById(tenantId, req.params.id)
    if (!pattern) {
      return res.status(404).json({ success: false, error: 'Decision pattern not found' })
    }
    res.json({
      success: true,
      patternId: pattern.id,
      title: pattern.title,
      domain: pattern.domain,
      confidenceScore: pattern.confidenceScore,
      evidenceLog: pattern.evidenceLog,
      totalEvidence: pattern.evidenceLog.length
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/decision-patterns/signals
 * Ingests a new decision signal (approval, diff edit, explicit rule, option choice)
 */
router.post('/decision-patterns/signals', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const {
      domain,
      source,
      summary,
      supportsRule,
      diff,
      choice,
      context,
      inferredRule,
      naturalLanguageRule,
      weight
    } = req.body

    if (!domain || !source || !summary) {
      return res.status(400).json({
        success: false,
        error: 'domain, source, and summary are required to record a decision signal'
      })
    }

    const result = await decisionPatternLearningService.recordSignal(tenantId, {
      domain,
      source,
      summary,
      supportsRule,
      diff,
      choice,
      context,
      inferredRule,
      naturalLanguageRule,
      weight
    })

    res.json({ success: true, ...result })
  } catch (err: any) {
    logger.error(`[PersonalAgent:DecisionPatterns] Record signal error: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/decision-patterns/gate
 * Evaluates whether a proposed action can be auto-executed or must ask the user
 */
router.post('/decision-patterns/gate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { domain, actionType, stakesLevel, proposedPayload, userConfiguredThreshold } = req.body

    if (!domain || !actionType) {
      return res.status(400).json({ success: false, error: 'domain and actionType are required' })
    }

    const gate = await decisionPatternLearningService.evaluateAutonomyGate(tenantId, {
      domain,
      actionType,
      stakesLevel: stakesLevel || 'medium',
      proposedPayload,
      userConfiguredThreshold
    })

    res.json({ success: true, gate })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/decision-patterns/context
 * Returns structured XML decision context for prompt injection
 */
router.get('/decision-patterns/context', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const domain = req.query.domain as DecisionDomain | undefined
    const contextXml = await decisionPatternLearningService.getStructuredDecisionContext(tenantId, domain)
    res.json({ success: true, contextXml })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent/decision-patterns/:id
 * User edits a learned rule, pins it, or overrides the confidence score
 */
router.patch('/decision-patterns/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { userEditedRule, userSetConfidence, isPinned, title } = req.body

    const updated = await decisionPatternLearningService.updateUserPattern(tenantId, req.params.id, {
      userEditedRule,
      userSetConfidence,
      isPinned,
      title
    })

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Decision pattern not found' })
    }

    res.json({ success: true, pattern: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/personal-agent/decision-patterns/:id
 * Forgets a decision pattern and deletes its historical evidence
 */
router.delete('/decision-patterns/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const deleted = await decisionPatternLearningService.deletePattern(tenantId, req.params.id)
    res.json({ success: deleted })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════
// CRUCIAL-MOMENT DETECTION & PROACTIVE TRACEABLE ADVICE (Prompt 31)
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/personal-agent/crucial/settings
 * Retrieves user's proactivity and crucial-moment threshold settings
 */
router.get('/crucial/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const settings = await crucialMomentAndAdviceService.getSettings(tenantId)
    res.json({ success: true, settings })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent/crucial/settings
 * Updates proactivity level, spend limits, or sensitivity thresholds
 */
router.patch('/crucial/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const updated = await crucialMomentAndAdviceService.updateSettings(tenantId, req.body)
    res.json({ success: true, settings: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/crucial/evaluate
 * Evaluates whether an action is a crucial moment requiring explicit user confirmation
 */
router.post('/crucial/evaluate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { actionType, domain, proposedPayload, contextDescription } = req.body

    const evaluation = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId,
      actionType,
      domain: domain || 'email_comms',
      proposedPayload,
      contextDescription
    })

    res.json({ success: true, evaluation })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/crucial/mistakes
 * Registers a user-flagged mistake to prevent uncritical pattern echoing (Safeguard 5b)
 */
router.post('/crucial/mistakes', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { actionType, domain, rationale } = req.body
    await crucialMomentAndAdviceService.flagMistake(tenantId, {
      actionType: actionType || 'custom_action',
      domain: domain || 'general',
      rationale: rationale || 'User flagged this action as an undesirable outcome'
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/advice
 * Lists active proactive advice items with cited evidence and honest reasoning
 */
router.get('/advice', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const advice = await crucialMomentAndAdviceService.getActiveAdvice(tenantId)
    res.json({ success: true, advice })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/advice/generate
 * Generates fresh proactive advice items based on current patterns & commitments
 */
router.post('/advice/generate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const advice = await crucialMomentAndAdviceService.generateProactiveAdvice(tenantId, req.body)
    res.json({ success: true, advice })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/advice/:id/feedback
 * Submits user feedback (helpful, unhelpful, dismissed) to throttle or tune frequency
 */
router.post('/advice/:id/feedback', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { feedback } = req.body
    const updated = await crucialMomentAndAdviceService.submitAdviceFeedback(
      tenantId,
      req.params.id,
      feedback || 'helpful'
    )
    res.json({ success: true, advice: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/advice/context
 * Returns structured XML advice context for LLM agent reasoning injection
 */
router.get('/advice/context', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const xmlContext = await crucialMomentAndAdviceService.getStructuredAdviceContext(tenantId)
    res.json({ success: true, xmlContext })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/voice/settings
 * Retrieves user voice input and output settings
 */
router.get('/voice/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const settings = await personalAgentVoiceService.getVoiceSettings(tenantId)
    res.json({ success: true, settings })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/personal-agent/voice/settings
 * Updates voice preferences (browser vs provider, spoken notifications, rates)
 */
router.patch('/voice/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const updated = await personalAgentVoiceService.updateVoiceSettings(tenantId, req.body)
    res.json({ success: true, settings: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/voice/transcribe
 * Optional provider-based audio transcription (Whisper) with browser fallback
 */
router.post('/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { durationSeconds, mimeType } = req.body
    const result = await personalAgentVoiceService.transcribeAudio(
      tenantId,
      undefined,
      mimeType || 'audio/webm',
      durationSeconds || 5
    )
    res.json({ success: true, result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/personal-agent/voice/synthesize
 * Optional provider-based high quality TTS synthesis with browser fallback
 */
router.post('/voice/synthesize', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const { text, voice } = req.body
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required for speech synthesis' })
    }
    const result = await personalAgentVoiceService.synthesizeSpeech(tenantId, text, voice)
    res.json({ success: true, result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/personal-agent/voice/usage
 * Returns transparent voice usage metrics, minutes, characters and costs
 */
router.get('/voice/usage', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)
    const usage = await personalAgentVoiceService.getVoiceUsageSummary(tenantId)
    res.json({ success: true, usage })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router


