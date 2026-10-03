import crypto from 'crypto'
import { db } from '../db'
import { logger } from './logger.service'
import { agentRuntimeService, AgentTaskResult } from '../runtime/agent-runtime.service'
import { saveMemory, getMemoriesByEntity } from './memory.service'
import { callLLM } from '../agents/base.agent'
import { personalAgentStorageManager } from './storage/personal-agent-storage.manager'
import { personalAgentOrchestratorService } from './personal-agent-orchestrator.service'
import { decisionPatternLearningService } from './decision-pattern-learning.service'
import {
  StorageBackendConfig,
  StorageBackendType,
  StorageMetrics,
  PersonalAgentExportPackage,
  ConnectionTestResult
} from './storage/personal-agent-storage.types'

export interface PersonalAgentProfile {
  id: string
  tenantId: string
  name: string
  persona: {
    roleDescription: string
    tone: 'concise' | 'thoughtful' | 'direct' | 'warm' | 'technical'
    language: string
    avatar?: string
  }
  runningSummary: string
  systemPrompt: string
  onboardingCompleted: boolean
  onboardingAnswers: Record<string, any>
  preferredModel: string
  connectedIntegrations: Array<{ id: string; name: string; connectedAt: string }>
  byokProvider?: string
  byokModel?: string
  byokKeyConfigured?: boolean
  emailAlias?: string
  emailInEnabled?: boolean
  createdAt: string
  updatedAt: string
}

export interface PersonalAgentMessage {
  id: string
  personalAgentId: string
  tenantId: string
  role: 'user' | 'assistant' | 'system' | 'delegation_notice'
  content: string
  delegatedTaskId?: string
  delegatedAgentRole?: string
  delegationResult?: any
  metadata?: Record<string, any>
  createdAt: string
}

export interface PersonalAgentMemoryItem {
  id: string
  personalAgentId: string
  tenantId: string
  key: string
  value: string
  category: 'fact' | 'preference' | 'goal' | 'decision' | 'constraint'
  importance: number
  isUserCorrected: boolean
  createdAt: string
  updatedAt: string
}

export class PersonalAgentService {
  private inMemoryAgents: Map<string, PersonalAgentProfile> = new Map()
  private inMemoryMessages: Map<string, PersonalAgentMessage[]> = new Map() // agentId -> messages
  private inMemoryMemories: Map<string, PersonalAgentMemoryItem[]> = new Map() // agentId -> memories

  /**
   * Retrieves or lazily creates a personal agent for a tenant
   */
  public async getOrCreatePersonalAgent(tenantId: string, defaultName = 'Aria'): Promise<PersonalAgentProfile> {
    // 1. Check in-memory cache
    for (const pa of this.inMemoryAgents.values()) {
      if (pa.tenantId === tenantId) return pa
    }

    // 2. Query Database
    try {
      const { rows } = await db.query(
        `SELECT * FROM personal_agents WHERE tenant_id = $1 LIMIT 1`,
        [tenantId]
      ).catch(() => ({ rows: [] }))

      if (rows && rows.length > 0) {
        const row = rows[0]
        const profile: PersonalAgentProfile = {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name || defaultName,
          persona: typeof row.persona === 'string' ? JSON.parse(row.persona) : row.persona || {
            roleDescription: 'Executive AI Partner & Workflow Orchestrator',
            tone: 'thoughtful',
            language: 'en',
            avatar: '✨'
          },
          runningSummary: row.running_summary || 'New workspace setup. Learning user preferences, active priorities, and workflow habits.',
          systemPrompt: row.system_prompt || `You are ${row.name || defaultName}, the user's dedicated personal assistant and orchestration companion. You know their context, remember their instructions, and orchestrate specialized workforce teams on their behalf.`,
          onboardingCompleted: Boolean(row.onboarding_completed),
          onboardingAnswers: typeof row.onboarding_answers === 'string' ? JSON.parse(row.onboarding_answers) : row.onboarding_answers || {},
          preferredModel: row.preferred_model || 'gpt-4o',
          connectedIntegrations: typeof row.connected_integrations === 'string' ? JSON.parse(row.connected_integrations) : row.connected_integrations || [],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString()
        }
        this.inMemoryAgents.set(profile.id, profile)
        return profile
      }
    } catch (err: any) {
      logger.warn(`[PersonalAgent] DB query fallback: ${err.message}`)
    }

    // 3. Create fresh personal agent identity
    const newId = `pa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()
    const defaultProfile: PersonalAgentProfile = {
      id: newId,
      tenantId,
      name: defaultName,
      persona: {
        roleDescription: 'Executive AI Partner & Workflow Orchestrator',
        tone: 'thoughtful',
        language: 'en',
        avatar: '✨'
      },
      runningSummary: 'New assistant initialized. Ready to learn user workflow, active projects, and communication preferences.',
      systemPrompt: `You are ${defaultName}, the user's dedicated personal AI companion and primary orchestration partner. You know the user's history, maintain persistent memories, and delegate deep tasks to specialized workforce agents.`,
      onboardingCompleted: false,
      onboardingAnswers: {},
      preferredModel: 'gpt-4o',
      connectedIntegrations: [],
      createdAt: now,
      updatedAt: now
    }

    this.inMemoryAgents.set(newId, defaultProfile)

    // Attempt DB insertion
    db.query(
      `INSERT INTO personal_agents (id, tenant_id, name, persona, running_summary, system_prompt, onboarding_completed, onboarding_answers, preferred_model, connected_integrations, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = NOW()`,
      [
        defaultProfile.id,
        defaultProfile.tenantId,
        defaultProfile.name,
        JSON.stringify(defaultProfile.persona),
        defaultProfile.runningSummary,
        defaultProfile.systemPrompt,
        defaultProfile.onboardingCompleted,
        JSON.stringify(defaultProfile.onboardingAnswers),
        defaultProfile.preferredModel,
        JSON.stringify(defaultProfile.connectedIntegrations),
        defaultProfile.createdAt,
        defaultProfile.updatedAt
      ]
    ).catch(() => {})

    return defaultProfile
  }

  /**
   * Updates personal assistant profile (name, persona, model)
   */
  public async updatePersonalAgent(tenantId: string, updates: Partial<PersonalAgentProfile>): Promise<PersonalAgentProfile> {
    const agent = await this.getOrCreatePersonalAgent(tenantId)

    if (updates.name) {
      agent.name = updates.name.trim()
      agent.systemPrompt = `You are ${agent.name}, the user's dedicated personal AI companion and primary orchestration partner.`
    }
    if (updates.persona) {
      agent.persona = { ...agent.persona, ...updates.persona }
    }
    if (updates.runningSummary) agent.runningSummary = updates.runningSummary
    if (updates.preferredModel) agent.preferredModel = updates.preferredModel
    if (updates.connectedIntegrations) agent.connectedIntegrations = updates.connectedIntegrations
    if (updates.byokProvider) agent.byokProvider = updates.byokProvider
    if (updates.byokModel) agent.byokModel = updates.byokModel
    if (updates.byokKeyConfigured !== undefined) agent.byokKeyConfigured = updates.byokKeyConfigured
    if (updates.onboardingAnswers) {
      agent.onboardingAnswers = { ...agent.onboardingAnswers, ...updates.onboardingAnswers }
    }
    if (updates.onboardingCompleted !== undefined) agent.onboardingCompleted = updates.onboardingCompleted
    if (updates.emailAlias) agent.emailAlias = updates.emailAlias
    if (updates.emailInEnabled !== undefined) agent.emailInEnabled = updates.emailInEnabled
    agent.updatedAt = new Date().toISOString()

    this.inMemoryAgents.set(agent.id, agent)

    await db.query(
      `UPDATE personal_agents 
       SET name = $1, persona = $2, running_summary = $3, system_prompt = $4, preferred_model = $5, connected_integrations = $6, onboarding_answers = $7, onboarding_completed = $8, updated_at = NOW()
       WHERE id = $9`,
      [
        agent.name,
        JSON.stringify(agent.persona),
        agent.runningSummary,
        agent.systemPrompt,
        agent.preferredModel,
        JSON.stringify(agent.connectedIntegrations),
        JSON.stringify(agent.onboardingAnswers),
        agent.onboardingCompleted,
        agent.id
      ]
    ).catch(() => {})

    return agent
  }

  /**
   * Completes the initial onboarding flow
   */
  public async completeOnboarding(
    tenantId: string,
    data: {
      name: string
      userRole?: string
      primaryGoals?: string[]
      preferredTone?: 'concise' | 'thoughtful' | 'direct' | 'warm' | 'technical'
      initialIntegrations?: string[]
      initialNote?: string
    }
  ): Promise<PersonalAgentProfile> {
    const agent = await this.getOrCreatePersonalAgent(tenantId, data.name || 'Aria')
    agent.name = (data.name || agent.name).trim()
    agent.onboardingCompleted = true
    agent.onboardingAnswers = data
    if (data.preferredTone) agent.persona.tone = data.preferredTone

    const summaryParts = [
      `User Role/Context: ${data.userRole || 'Software Engineering / Product'}`,
      `Primary Goals: ${(data.primaryGoals || ['Automate repetitive workflows', 'Orchestrate agents']).join(', ')}`,
      `Communication Preference: ${data.preferredTone || 'thoughtful and concise'}`
    ]
    if (data.initialNote) summaryParts.push(`Personal Note: ${data.initialNote}`)
    agent.runningSummary = summaryParts.join(' | ')
    agent.updatedAt = new Date().toISOString()

    this.inMemoryAgents.set(agent.id, agent)

    // Save initial core facts in inspectable memory
    if (data.userRole) {
      await this.addMemory({
        personalAgentId: agent.id,
        tenantId,
        key: 'user_profession',
        value: data.userRole,
        category: 'fact',
        importance: 8
      })
    }

    if (data.primaryGoals && data.primaryGoals.length > 0) {
      await this.addMemory({
        personalAgentId: agent.id,
        tenantId,
        key: 'primary_goals',
        value: data.primaryGoals.join('; '),
        category: 'goal',
        importance: 9
      })
    }

    if (data.preferredTone) {
      await this.addMemory({
        personalAgentId: agent.id,
        tenantId,
        key: 'tone_preference',
        value: data.preferredTone,
        category: 'preference',
        importance: 7
      })
    }

    // Add initial greeting message
    const welcomeContent = `Hello! I'm **${agent.name}**, your personal AI orchestrator. I've noted down your focus as *${data.userRole || 'Engineering/Product'}* and I'm ready to coordinate our specialized agent roster for research, code, tasks, and workflow automation. What should we tackle first?`
    
    await this.recordMessage({
      personalAgentId: agent.id,
      tenantId,
      role: 'assistant',
      content: welcomeContent
    })

    // DB update
    await db.query(
      `UPDATE personal_agents
       SET name = $1, onboarding_completed = true, onboarding_answers = $2, running_summary = $3, persona = $4, updated_at = NOW()
       WHERE id = $5`,
      [agent.name, JSON.stringify(agent.onboardingAnswers), agent.runningSummary, JSON.stringify(agent.persona), agent.id]
    ).catch(() => {})

    return agent
  }

  /**
   * Sends a user message to the Personal Assistant:
   * 1. Injects running summary & inspectable memories into context.
   * 2. Determines whether task requires delegation to specialist roster.
   * 3. Dispatches delegation if needed and summarizes receipt back to user.
   * 4. Updates running summary & extracts new learned facts into persistent memory.
   */
  public async chat(
    tenantId: string,
    userContent: string,
    options?: { stream?: boolean }
  ): Promise<{
    assistantMessage: PersonalAgentMessage
    delegatedTask?: { taskId: string; role: string; output: string }
    learnedMemories: PersonalAgentMemoryItem[]
  }> {
    const agent = await this.getOrCreatePersonalAgent(tenantId)

    // 1. Record user message
    const userMsg = await this.recordMessage({
      personalAgentId: agent.id,
      tenantId,
      role: 'user',
      content: userContent
    })

    // 2. Fetch recent conversation history & memories
    const history = await this.getMessages(agent.id, 12)
    const memories = await this.getMemories(agent.id)
    const memoryContext = memories.map(m => `• [${m.category.toUpperCase()}] ${m.key}: ${m.value}`).join('\n')

    // 3. Routing & Orchestration Intent Analysis:
    // PersonalAgent is the single point of contact & executive orchestrator.
    // Real work is routed to specialists via AgentBus & Handoff protocols behind the scenes,
    // and synthesized into ONE unified, coherent response.
    const historyPrompt = history.slice(0, -1).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    
    const orchResult = await personalAgentOrchestratorService.executePersonalRequest({
      tenantId,
      agent,
      userPrompt: userContent,
      memories,
      historyContext: historyPrompt
    })

    let assistantResponseText = ''
    let delegatedMetadata: Record<string, any> = {}

    if (orchResult.isDelegated) {
      assistantResponseText = orchResult.unifiedResponse
      delegatedMetadata = {
        delegated: true,
        isMultiStep: orchResult.isMultiStep,
        specialistsInvolved: orchResult.specialistsInvolved,
        handoffsCount: orchResult.handoffs.length,
        handoffs: orchResult.handoffs,
        stepOutputs: orchResult.stepOutputs.map(s => ({ role: s.role, taskId: s.taskId, summary: s.summary })),
        totalDurationMs: orchResult.totalDurationMs
      }

      // Record delegation notice in history for transparency
      await this.recordMessage({
        personalAgentId: agent.id,
        tenantId,
        role: 'delegation_notice',
        content: orchResult.isMultiStep
          ? `Coordinated ${orchResult.specialistsInvolved.length} specialists (${orchResult.specialistsInvolved.join(' → ')}) to complete your request.`
          : `Routed task to **${orchResult.specialistsInvolved[0]?.toUpperCase()}** specialist behind the scenes.`,
        delegatedAgentRole: orchResult.specialistsInvolved.join(', '),
        metadata: { isMultiStep: orchResult.isMultiStep, specialists: orchResult.specialistsInvolved }
      })
    } else {
      // Direct conversational response with memory context
      const systemPrompt = `You are ${agent.name}, the user's named personal AI companion and executive workflow orchestrator.
Tone: ${agent.persona.tone || 'thoughtful'}.
Running User Context:
${agent.runningSummary}

Persistent Known Facts & Preferences:
${memoryContext || 'None recorded yet.'}

Guidelines:
1. Act as a trusted, warm, highly intelligent personal assistant.
2. Address the user naturally and refer to past context when relevant.
3. If the user expresses a clear preference, habit, or instruction, acknowledge it.`

      const fullUserPrompt = `${historyPrompt}\n\nUSER: ${userContent}\n\n${agent.name.toUpperCase()}:`

      try {
        const llmPromise = callLLM(
          agent.preferredModel || 'gpt-4o',
          systemPrompt,
          fullUserPrompt,
          800
        )
        const timeoutPromise = new Promise<{ content?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('LLM timeout')), 1500)
        )
        const llmRes = await Promise.race([llmPromise, timeoutPromise])
        assistantResponseText = llmRes.content || `I'm on it! Let me know if you'd like me to coordinate any specialist tasks.`
      } catch (e: any) {
        assistantResponseText = `I've noted that down! How else can I assist your workflow today?`
      }
    }

    // 4. Record Unified Assistant Message
    const assistantMsg = await this.recordMessage({
      personalAgentId: agent.id,
      tenantId,
      role: 'assistant',
      content: assistantResponseText,
      delegatedTaskId: orchResult.stepOutputs[0]?.taskId,
      delegatedAgentRole: orchResult.specialistsInvolved[0],
      delegationResult: orchResult.stepOutputs,
      metadata: delegatedMetadata
    })

    // 5. Background Knowledge & Preference Extraction (inspectable memories)
    const learnedMemories = await this.extractAndLearnFacts(agent, userContent, assistantResponseText)

    return {
      success: true,
      userMessage: userMsg,
      message: assistantMsg,
      assistantMessage: assistantMsg,
      delegatedSpecialists: orchResult.specialistsInvolved,
      delegatedTask: orchResult.stepOutputs[0] ? {
        taskId: orchResult.stepOutputs[0].taskId,
        role: orchResult.specialistsInvolved[0] || 'specialist',
        output: assistantResponseText
      } : undefined,
      learnedMemories
    }
  }

  /**
   * Classifies if user request should be delegated to a specialist agent
   */
  private detectSpecialistIntent(content: string): { role: string; type: string } | null {
    const lower = content.toLowerCase()
    if (lower.includes('write code') || lower.includes('create function') || lower.includes('fix bug') || lower.includes('implement api') || lower.includes('refactor') || lower.includes('typescript') || lower.includes('python script')) {
      return { role: 'software_engineer', type: 'code_execution' }
    }
    if (lower.includes('deep research') || lower.includes('analyze competitors') || lower.includes('market analysis') || lower.includes('find papers') || lower.includes('look up')) {
      return { role: 'research_analyst', type: 'deep_research' }
    }
    if (lower.includes('create workflow') || lower.includes('schedule task') || lower.includes('cron') || lower.includes('automate')) {
      return { role: 'automation_specialist', type: 'automation' }
    }
    if (lower.includes('ui design') || lower.includes('landing page mockup') || lower.includes('color palette') || lower.includes('css')) {
      return { role: 'designer', type: 'design' }
    }
    return null
  }

  /**
   * Learns new facts from conversation and saves them as inspectable memories
   */
  private async extractAndLearnFacts(
    agent: PersonalAgentProfile,
    userMessage: string,
    assistantReply: string
  ): Promise<PersonalAgentMemoryItem[]> {
    const learned: PersonalAgentMemoryItem[] = []
    const lower = userMessage.toLowerCase()

    // Deterministic preference heuristic extraction (fast & transparent)
    if (lower.includes('i prefer ') || lower.includes('always use ') || lower.includes('never use ') || lower.includes('my favorite ') || lower.includes('i work at ') || lower.includes('my role is ')) {
      let key = 'user_preference'
      let category: 'preference' | 'fact' | 'goal' = 'preference'

      if (lower.includes('i work at ') || lower.includes('my role is ')) {
        key = 'user_work_context'
        category = 'fact'
      } else if (lower.includes('goal is ') || lower.includes('want to achieve ')) {
        key = 'active_goal'
        category = 'goal'
      }

      const item = await this.addMemory({
        personalAgentId: agent.id,
        tenantId: agent.tenantId,
        key: `${key}_${Date.now().toString().slice(-4)}`,
        value: userMessage.slice(0, 140),
        category,
        importance: 7
      })
      learned.push(item)

      // Update running summary
      agent.runningSummary = `${agent.runningSummary} | Learned: ${userMessage.slice(0, 80)}`
      this.inMemoryAgents.set(agent.id, agent)
      db.query(`UPDATE personal_agents SET running_summary = $1 WHERE id = $2`, [agent.runningSummary, agent.id]).catch(() => {})
    }

    return learned
  }

  // ── Message Persistence ──────────────────────────────────────────

  public async recordMessage(msg: {
    personalAgentId: string
    tenantId: string
    role: 'user' | 'assistant' | 'system' | 'delegation_notice'
    content: string
    delegatedTaskId?: string
    delegatedAgentRole?: string
    delegationResult?: any
    metadata?: Record<string, any>
  }): Promise<PersonalAgentMessage> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()

    const item: PersonalAgentMessage = {
      id,
      personalAgentId: msg.personalAgentId,
      tenantId: msg.tenantId,
      role: msg.role,
      content: msg.content,
      delegatedTaskId: msg.delegatedTaskId,
      delegatedAgentRole: msg.delegatedAgentRole,
      delegationResult: msg.delegationResult,
      metadata: msg.metadata,
      createdAt: now
    }

    let list = this.inMemoryMessages.get(msg.personalAgentId)
    if (!list) {
      list = []
      this.inMemoryMessages.set(msg.personalAgentId, list)
    }
    list.push(item)

    // DB insert
    db.query(
      `INSERT INTO personal_agent_messages (id, personal_agent_id, tenant_id, role, content, delegated_task_id, delegated_agent_role, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [item.id, item.personalAgentId, item.tenantId, item.role, item.content, item.delegatedTaskId || null, item.delegatedAgentRole || null, JSON.stringify(item.metadata || {}), item.createdAt]
    ).catch(() => {})

    return item
  }

  public async getMessages(personalAgentId: string, limit = 50): Promise<PersonalAgentMessage[]> {
    // 1. Check in-memory
    const memList = this.inMemoryMessages.get(personalAgentId)
    if (memList && memList.length > 0) {
      return memList.slice(-limit)
    }

    // 2. Query DB
    try {
      const { rows } = await db.query(
        `SELECT * FROM personal_agent_messages WHERE personal_agent_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [personalAgentId, limit]
      ).catch(() => ({ rows: [] }))

      const messages: PersonalAgentMessage[] = rows.map((r: any) => ({
        id: r.id,
        personalAgentId: r.personal_agent_id,
        tenantId: r.tenant_id,
        role: r.role,
        content: r.content,
        delegatedTaskId: r.delegated_task_id,
        delegatedAgentRole: r.delegated_agent_role,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {},
        createdAt: r.created_at
      }))

      this.inMemoryMessages.set(personalAgentId, messages)
      return messages
    } catch {
      return []
    }
  }

  // ── Inspectable & Correctable Memory APIs ─────────────────────────

  public async getMemories(personalAgentId: string, category?: string): Promise<PersonalAgentMemoryItem[]> {
    let list = this.inMemoryMemories.get(personalAgentId)

    if (!list || list.length === 0) {
      const { rows } = await db.query(
        `SELECT * FROM personal_agent_memories WHERE personal_agent_id = $1 ORDER BY importance DESC, created_at DESC`,
        [personalAgentId]
      ).catch(() => ({ rows: [] }))

      list = rows.map((r: any) => ({
        id: r.id,
        personalAgentId: r.personal_agent_id,
        tenantId: r.tenant_id,
        key: r.key,
        value: r.value,
        category: r.category,
        importance: r.importance,
        isUserCorrected: Boolean(r.is_user_corrected),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
      this.inMemoryMemories.set(personalAgentId, list)
    }

    if (category && category !== 'all') {
      return list.filter(m => m.category === category)
    }
    return list
  }

  public async addMemory(params: {
    personalAgentId: string
    tenantId: string
    key: string
    value: string
    category?: 'fact' | 'preference' | 'goal' | 'decision' | 'constraint'
    importance?: number
  }): Promise<PersonalAgentMemoryItem> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()

    const item: PersonalAgentMemoryItem = {
      id,
      personalAgentId: params.personalAgentId,
      tenantId: params.tenantId,
      key: params.key.trim(),
      value: params.value.trim(),
      category: params.category || 'fact',
      importance: params.importance || 5,
      isUserCorrected: false,
      createdAt: now,
      updatedAt: now
    }

    let list = this.inMemoryMemories.get(params.personalAgentId)
    if (!list) {
      list = []
      this.inMemoryMemories.set(params.personalAgentId, list)
    }
    list.unshift(item)

    // DB insert
    db.query(
      `INSERT INTO personal_agent_memories (id, personal_agent_id, tenant_id, key, value, category, importance, is_user_corrected, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [item.id, item.personalAgentId, item.tenantId, item.key, item.value, item.category, item.importance, item.isUserCorrected, item.createdAt, item.updatedAt]
    ).catch(() => {})

    return item
  }

  public async updateMemory(
    memoryId: string,
    tenantId: string,
    updates: { value?: string; key?: string; category?: any; importance?: number }
  ): Promise<PersonalAgentMemoryItem | null> {
    for (const [agentId, list] of this.inMemoryMemories.entries()) {
      const idx = list.findIndex(m => m.id === memoryId && m.tenantId === tenantId)
      if (idx >= 0) {
        const m = list[idx]
        if (updates.value !== undefined) m.value = updates.value
        if (updates.key !== undefined) m.key = updates.key
        if (updates.category !== undefined) m.category = updates.category
        if (updates.importance !== undefined) m.importance = updates.importance
        m.isUserCorrected = true
        m.updatedAt = new Date().toISOString()

        await db.query(
          `UPDATE personal_agent_memories 
           SET value = $1, key = $2, category = $3, importance = $4, is_user_corrected = true, updated_at = NOW()
           WHERE id = $5 AND tenant_id = $6`,
          [m.value, m.key, m.category, m.importance, m.id, tenantId]
        ).catch(() => {})

        return m
      }
    }
    return null
  }

  public async deleteMemory(memoryId: string, tenantId: string): Promise<boolean> {
    for (const [agentId, list] of this.inMemoryMemories.entries()) {
      const idx = list.findIndex(m => m.id === memoryId && m.tenantId === tenantId)
      if (idx >= 0) {
        list.splice(idx, 1)
        await db.query(
          `DELETE FROM personal_agent_memories WHERE id = $1 AND tenant_id = $2`,
          [memoryId, tenantId]
        ).catch(() => {})
        return true
      }
    }
    return false
  }

  // ── Data Sovereignty & Pluggable Storage Methods ──────────────────

  public async getSovereigntyOverview(tenantId: string) {
    const agent = await this.getOrCreatePersonalAgent(tenantId)
    return personalAgentStorageManager.getSovereigntyOverview(tenantId, agent.id)
  }

  public async configureStorage(
    tenantId: string,
    config: Partial<StorageBackendConfig>,
    migrateExistingData = false
  ) {
    const agent = await this.getOrCreatePersonalAgent(tenantId)
    return personalAgentStorageManager.configureTenantStorage(
      tenantId,
      config,
      migrateExistingData,
      agent.id
    )
  }

  public testStorageConnection(config: StorageBackendConfig) {
    const adapter = personalAgentStorageManager.getAdapter(config.backendType)
    return adapter.testConnection(config)
  }

  public setPassphrase(tenantId: string, passphrase: string) {
    return personalAgentStorageManager.setTenantPassphrase(tenantId, passphrase)
  }

  public unlockPassphrase(tenantId: string, passphrase: string) {
    return personalAgentStorageManager.unlockWithPassphrase(tenantId, passphrase)
  }

  public async exportAllData(tenantId: string): Promise<PersonalAgentExportPackage> {
    const agent = await this.getOrCreatePersonalAgent(tenantId)
    const exportBundle = await personalAgentStorageManager.exportAllTenantData(tenantId, agent.id)
    
    // Attach learned decision patterns to user sovereign archive
    const patterns = await decisionPatternLearningService.getPatterns(tenantId)
    ;(exportBundle as any).decisionPatterns = patterns

    return exportBundle
  }

  public async permanentHardDelete(tenantId: string) {
    const agent = await this.getOrCreatePersonalAgent(tenantId)
    const result = await personalAgentStorageManager.permanentHardDeleteTenantData(tenantId, agent.id)

    // Clear service in-memory maps
    this.inMemoryAgents.delete(agent.id)
    this.inMemoryMessages.delete(agent.id)
    this.inMemoryMemories.delete(agent.id)

    // Wipe all learned decision patterns & evidence
    const patternsWiped = await decisionPatternLearningService.wipeAllTenantPatterns(tenantId)
    ;(result as any).deletedDecisionPatterns = patternsWiped

    return result
  }
}

export const personalAgentService = new PersonalAgentService()
