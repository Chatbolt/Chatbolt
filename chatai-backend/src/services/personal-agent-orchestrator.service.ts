import crypto from 'crypto'
import { logger } from './logger.service'
import { agentRuntimeService, AgentTaskResult } from '../runtime/agent-runtime.service'
import { agentBus } from '../runtime/agent-bus.service'
import { agentCollaborationService, AgentHandoffPayload } from './agent-collaboration.service'
import { observabilityService } from './observability.service'
import { callLLM } from '../agents/base.agent'
import { PersonalAgentProfile, PersonalAgentMemoryItem } from './personal-agent.service'
import { decisionPatternLearningService } from './decision-pattern-learning.service'
import { crucialMomentAndAdviceService } from './crucial-moment-and-advice.service'

/**
 * Specialist definition tailored for personal / everyday assistant tasks
 */
export interface PersonalSpecialistProfile {
  role: string
  displayName: string
  category: 'code' | 'research' | 'writing' | 'data' | 'productivity' | 'planning'
  systemPrompt: string
  toolAccessList: string[]
  suitableKeywords: string[]
}

/**
 * Single step in a multi-step personal execution graph
 */
export interface PersonalDAGNode {
  stepIndex: number
  nodeKey: string
  targetRole: string
  taskDescription: string
  dependsOn?: string[]
}

/**
 * Delegation result containing unified answer + audit trail
 */
export interface PersonalOrchestrationResult {
  isDelegated: boolean
  isMultiStep: boolean
  specialistsInvolved: string[]
  unifiedResponse: string
  handoffs: AgentHandoffPayload[]
  stepOutputs: Array<{ role: string; taskId: string; summary: string; output: string }>
  totalDurationMs: number
}

export class PersonalAgentOrchestratorService {
  /**
   * Catalog of 44 agents adapted for everyday personal workflows
   */
  public readonly SPECIALIST_CATALOG: Record<string, PersonalSpecialistProfile> = {
    code: {
      role: 'code',
      displayName: 'Code & Technical Specialist',
      category: 'code',
      systemPrompt: `You are the specialized Code & Technical specialist assisting the Personal Assistant.
Your focus:
- Write clean, error-free, modern code (TypeScript, Python, Go, SQL, Bash).
- Debug user scripts and explain technical fixes clearly.
- Provide targeted diffs and copy-paste ready implementations.
- Always output clean code blocks with proper syntax highlighting.`,
      toolAccessList: ['apply_file_diff', 'semantic_code_search', 'node_sandbox', 'python_sandbox'],
      suitableKeywords: ['code', 'script', 'python', 'typescript', 'javascript', 'bug', 'fix', 'error', 'function', 'sql', 'regex', 'terminal', 'git', 'endpoint', 'api']
    },
    researcher: {
      role: 'researcher',
      displayName: 'Deep Research & Web Intelligence Specialist',
      category: 'research',
      systemPrompt: `You are the specialized Deep Research & Fact-Finding specialist assisting the Personal Assistant.
Your focus:
- Synthesize objective, high-signal information on products, travel, technical topics, news, and history.
- Compare options with structured pros/cons and key criteria.
- Provide clear citations, verified facts, and actionable summaries.`,
      toolAccessList: ['web_search', 'fetch_page_content', 'extract_citations'],
      suitableKeywords: ['research', 'find', 'search', 'compare', 'difference', 'best', 'top', 'history', 'news', 'facts', 'hotel', 'flight', 'restaurant', 'attractions']
    },
    writer: {
      role: 'writer',
      displayName: 'Editorial & Communications Specialist',
      category: 'writing',
      systemPrompt: `You are the specialized Writer & Communications specialist assisting the Personal Assistant.
Your focus:
- Draft compelling, polished emails, documents, itineraries, announcements, and summaries.
- Adapt tone to match user style (direct, warm, concise, or professional).
- Organize content with clean formatting, headings, and bullet points.`,
      toolAccessList: ['grammar_check', 'sentiment_check', 'seo_keyword_density'],
      suitableKeywords: ['draft', 'write', 'email', 'letter', 'itinerary', 'article', 'post', 'essay', 'summarize', 'rewrite', 'copy', 'message', 'text']
    },
    data_processor: {
      role: 'data_processor',
      displayName: 'Data & Financial Analyst',
      category: 'data',
      systemPrompt: `You are the specialized Data & Calculation specialist assisting the Personal Assistant.
Your focus:
- Perform financial calculations, budget allocations, currency conversions, and data comparisons.
- Format raw data into clean tables, JSON, or CSV structures.
- Compute accurate sums, averages, and statistical breakdowns.`,
      toolAccessList: ['spreadsheet_calc', 'json_transform', 'csv_parser'],
      suitableKeywords: ['calculate', 'budget', 'cost', 'math', 'sum', 'convert', 'currency', 'price', 'table', 'csv', 'spreadsheet', 'data', 'finance', 'breakdown']
    },
    calendar: {
      role: 'calendar',
      displayName: 'Calendar & Scheduling Specialist',
      category: 'productivity',
      systemPrompt: `You are the specialized Calendar & Time Orchestration specialist assisting the Personal Assistant.
Your focus:
- Coordinate meeting slots, time zone conversions, and daily schedule optimization.
- Detect schedule conflicts and draft pre-meeting reminders.`,
      toolAccessList: ['calendar_query', 'timezone_calc', 'schedule_event'],
      suitableKeywords: ['calendar', 'meeting', 'schedule', 'appointment', 'agenda', 'timezone', 'reminder', 'time slot', 'reschedule']
    },
    planner: {
      role: 'planner',
      displayName: 'Strategy & Workflow Planner',
      category: 'planning',
      systemPrompt: `You are the specialized Strategic Planner assisting the Personal Assistant.
Your focus:
- Decompose complex multi-step personal goals into clear, phased checklists.
- Estimate realistic timeframes and identify dependencies.`,
      toolAccessList: ['task_decompose', 'dependency_graph'],
      suitableKeywords: ['plan', 'roadmap', 'checklist', 'milestones', 'strategy', 'organize', 'steps', 'workflow', 'trip']
    }
  }

  /**
   * Determines whether a user request requires specialist delegation or a multi-step task graph
   */
  public analyzeIntent(userPrompt: string): {
    requiresDelegation: boolean
    isMultiStep: boolean
    matchedRoles: string[]
    plan: PersonalDAGNode[]
  } {
    const prompt = (userPrompt || '').toLowerCase()

    // 1. Detect code domain explicitly
    const isCodePrompt = (
      prompt.includes('python') ||
      prompt.includes('typescript') ||
      prompt.includes('javascript') ||
      prompt.includes('function') ||
      prompt.includes('script') ||
      prompt.includes('sql') ||
      prompt.includes('regex') ||
      prompt.includes('bug') ||
      prompt.includes('endpoint') ||
      prompt.includes('git')
    )

    // 2. Score matched specialist roles
    const matchedRoles: string[] = []
    
    if (isCodePrompt) {
      matchedRoles.push('code')
    }

    if (
      prompt.includes('research') ||
      prompt.includes('find') ||
      prompt.includes('search') ||
      prompt.includes('compare') ||
      prompt.includes('best') ||
      prompt.includes('attraction') ||
      prompt.includes('hotel') ||
      prompt.includes('flight')
    ) {
      matchedRoles.push('researcher')
    }

    if (
      prompt.includes('budget') ||
      prompt.includes('calculate') ||
      prompt.includes('math') ||
      prompt.includes('sum') ||
      prompt.includes('convert') ||
      prompt.includes('currency') ||
      prompt.includes('cost') ||
      prompt.includes('table') ||
      prompt.includes('csv')
    ) {
      matchedRoles.push('data_processor')
    }

    if (
      prompt.includes('itinerary') ||
      prompt.includes('draft') ||
      prompt.includes('essay') ||
      prompt.includes('article') ||
      prompt.includes('newsletter') ||
      (prompt.includes('write') && !isCodePrompt) ||
      (prompt.includes('email') && !prompt.includes('regex'))
    ) {
      matchedRoles.push('writer')
    }

    if (
      prompt.includes('calendar') ||
      prompt.includes('schedule') ||
      prompt.includes('appointment') ||
      prompt.includes('timezone')
    ) {
      matchedRoles.push('calendar')
    }

    if (
      prompt.includes('roadmap') ||
      prompt.includes('plan a trip') ||
      prompt.includes('plan a') ||
      prompt.includes('strategy')
    ) {
      matchedRoles.push('planner')
    }

    if (matchedRoles.length === 0) {
      return { requiresDelegation: false, isMultiStep: false, matchedRoles: [], plan: [] }
    }

    // 3. Check for compound multi-step indicators
    const isCompound =
      (prompt.includes(' and ') || prompt.includes(' then ') || prompt.includes(' also ') || prompt.includes(' as well as ')) &&
      matchedRoles.length >= 2

    // 4. Construct Personal DAG if multi-step
    if (isCompound && matchedRoles.length > 1) {
      const plan: PersonalDAGNode[] = []
      let stepIndex = 1

      // Phase 1: Research / Planning
      if (matchedRoles.includes('researcher') || matchedRoles.includes('planner')) {
        const role = matchedRoles.includes('researcher') ? 'researcher' : 'planner'
        plan.push({
          stepIndex: stepIndex++,
          nodeKey: 'discovery',
          targetRole: role,
          taskDescription: `Gather core information, facts, and structure for: "${userPrompt}"`
        })
      }

      // Phase 2: Data / Calculation / Code
      if (matchedRoles.includes('data_processor')) {
        plan.push({
          stepIndex: stepIndex++,
          nodeKey: 'calculation',
          targetRole: 'data_processor',
          taskDescription: `Calculate numbers, budget breakdowns, or data tables based on previous findings for: "${userPrompt}"`,
          dependsOn: plan.length > 0 ? ['discovery'] : undefined
        })
      }

      if (matchedRoles.includes('code') && !isCodePrompt) {
        plan.push({
          stepIndex: stepIndex++,
          nodeKey: 'implementation',
          targetRole: 'code',
          taskDescription: `Implement code, scripts, or technical queries for: "${userPrompt}"`,
          dependsOn: plan.length > 0 ? [plan[plan.length - 1].nodeKey] : undefined
        })
      }

      // Phase 3: Writing & Synthesis
      if (matchedRoles.includes('writer')) {
        plan.push({
          stepIndex: stepIndex++,
          nodeKey: 'synthesis',
          targetRole: 'writer',
          taskDescription: `Draft the final comprehensive document, email, or formatted guide incorporating all prior findings for: "${userPrompt}"`,
          dependsOn: plan.map(p => p.nodeKey)
        })
      }

      if (plan.length > 1) {
        return {
          requiresDelegation: true,
          isMultiStep: true,
          matchedRoles: Array.from(new Set(plan.map(p => p.targetRole))),
          plan
        }
      }
    }

    // Single specialist task
    const primaryRole = matchedRoles[0]
    return {
      requiresDelegation: true,
      isMultiStep: false,
      matchedRoles: [primaryRole],
      plan: [
        {
          stepIndex: 1,
          nodeKey: 'execution',
          targetRole: primaryRole,
          taskDescription: userPrompt
        }
      ]
    }
  }

  /**
   * Executes the personal delegation workflow with Handoff Packets & Unified Output Synthesis
   */
  public async executePersonalRequest(params: {
    tenantId: string
    agent: PersonalAgentProfile
    userPrompt: string
    memories: PersonalAgentMemoryItem[]
    historyContext: string
  }): Promise<PersonalOrchestrationResult> {
    const { tenantId, agent, userPrompt, memories, historyContext } = params
    const startTime = Date.now()

    const analysis = this.analyzeIntent(userPrompt)
    if (!analysis.requiresDelegation) {
      return {
        isDelegated: false,
        isMultiStep: false,
        specialistsInvolved: [],
        unifiedResponse: '',
        handoffs: [],
        stepOutputs: [],
        totalDurationMs: 0
      }
    }

    const runId = `personal_run_${crypto.randomUUID()}`
    const handoffs: AgentHandoffPayload[] = []
    const stepOutputs: Array<{ role: string; taskId: string; summary: string; output: string }> = []
    let previousHandoffContext = ''

    logger.info(`[PersonalOrchestrator] Disagreeing request into ${analysis.plan.length} specialist step(s) (MultiStep: ${analysis.isMultiStep})`)

    // Start OpenTelemetry Root Run
    observabilityService.startRun({
      runId,
      tenantId,
      agentId: agent.id,
      agentRole: 'personal_assistant',
      missionGoal: userPrompt,
      metadata: { isMultiStep: analysis.isMultiStep, specialistPlan: analysis.plan.map(p => p.targetRole) }
    })

    // Execute each node in the personal DAG
    for (const node of analysis.plan) {
      const specialistConfig = this.SPECIALIST_CATALOG[node.targetRole] || this.SPECIALIST_CATALOG.researcher
      const stepStartTime = Date.now()

      // Register worker with runtime
      const specialistInstance = agentRuntimeService.registerAgent({
        id: `spec_${node.targetRole}_${tenantId.slice(0, 8)}`,
        name: specialistConfig.displayName,
        role: node.targetRole,
        tenantId,
        assignedModel: agent.preferredModel || 'gpt-4o',
        systemPrompt: specialistConfig.systemPrompt,
        toolAccessList: specialistConfig.toolAccessList
      })

      // Fetch structured learned decision patterns and active proactive advice for the tenant
      const [decisionContext, adviceContext] = await Promise.all([
        decisionPatternLearningService.getStructuredDecisionContext(tenantId),
        crucialMomentAndAdviceService.getStructuredAdviceContext(tenantId)
      ])

      // Construct enriched prompt with user context + upstream handoff context + learned decision patterns + advice
      let enrichedTask = node.taskDescription
      if (previousHandoffContext) {
        enrichedTask += `\n\n### Upstream Context from Prior Specialist:\n${previousHandoffContext}`
      }
      if (decisionContext) {
        enrichedTask += `\n\n### Learned User Decision Patterns & Habits:\n${decisionContext}`
      }
      if (adviceContext) {
        enrichedTask += `\n\n### Active Proactive Advice & Insights:\n${adviceContext}`
      }

      // Execute through bounded concurrency worker pool
      const taskResult: AgentTaskResult = await agentRuntimeService.executeTask(
        specialistInstance.id,
        enrichedTask,
        {
          runId,
          userTone: agent.persona.tone,
          userSummary: agent.runningSummary
        }
      )

      stepOutputs.push({
        role: node.targetRole,
        taskId: taskResult.taskId,
        summary: `Executed ${node.nodeKey} by ${specialistConfig.displayName}`,
        output: taskResult.output
      })

      // Generate structured Handoff Packet
      const handoffPayload: AgentHandoffPayload = {
        handoffId: `handoff_${crypto.randomUUID()}`,
        runId,
        teamId: 'personal_team',
        fromRole: node.targetRole,
        toRole: 'personal_assistant',
        summaryOfWorkDone: `Completed ${node.nodeKey} for user request`,
        keyContextForReceiver: {
          nodeKey: node.nodeKey,
          durationMs: Date.now() - stepStartTime,
          outputPreview: taskResult.output.slice(0, 150)
        },
        artifactsProduced: [
          {
            name: `${node.nodeKey}_deliverable.txt`,
            type: 'text',
            preview: taskResult.output.slice(0, 100)
          }
        ],
        timestamp: new Date().toISOString()
      }

      // Record Handoff in collaboration service and AgentBus
      await agentCollaborationService.performHandoff(handoffPayload)
      handoffs.push(handoffPayload)

      // Feed downstream
      previousHandoffContext = `[Output from ${node.targetRole}]:\n${taskResult.output}`
    }

    // Synthesize Unified Coherent Response
    const unifiedResponse = await this.synthesizeUnifiedResponse({
      agent,
      userPrompt,
      memories,
      stepOutputs,
      isMultiStep: analysis.isMultiStep
    })

    const totalDurationMs = Date.now() - startTime

    return {
      isDelegated: true,
      isMultiStep: analysis.isMultiStep,
      specialistsInvolved: analysis.matchedRoles,
      unifiedResponse,
      handoffs,
      stepOutputs,
      totalDurationMs
    }
  }

  /**
   * Synthesizes all specialist deliverables into a single, cohesive, polished response
   * in the PersonalAgent's natural persona and tone.
   */
  private async synthesizeUnifiedResponse(params: {
    agent: PersonalAgentProfile
    userPrompt: string
    memories: PersonalAgentMemoryItem[]
    stepOutputs: Array<{ role: string; taskId: string; summary: string; output: string }>
    isMultiStep: boolean
  }): Promise<string> {
    const { agent, userPrompt, memories, stepOutputs, isMultiStep } = params

    // If single output with clean text, do lightweight synthesis
    if (!isMultiStep && stepOutputs.length === 1) {
      const single = stepOutputs[0].output
      // If output is already well-formatted and complete, wrap naturally with agent persona
      return single
    }

    // Multi-step compound synthesis: call LLM to weave specialist findings into one unified assistant response
    const combinedSpecialistData = stepOutputs
      .map(s => `=== SPECIALIST DELIVERABLE: [${s.role.toUpperCase()}] ===\n${s.output}`)
      .join('\n\n')

    const memorySnippet = memories.slice(0, 5).map(m => `${m.key}: ${m.value}`).join(', ')
    const [decisionContext, adviceContext] = await Promise.all([
      decisionPatternLearningService.getStructuredDecisionContext(agent.tenantId),
      crucialMomentAndAdviceService.getStructuredAdviceContext(agent.tenantId)
    ])

    const systemPrompt = `You are ${agent.name}, the user's trusted, highly capable personal AI assistant and executive companion.
Your tone is ${agent.persona.tone || 'thoughtful'} and clear.
Known User Context: ${agent.runningSummary} ${memorySnippet ? `(Preferences: ${memorySnippet})` : ''}
${decisionContext ? `\nLearned User Patterns & Style:\n${decisionContext}` : ''}
${adviceContext ? `\nActive Proactive Advice & Warnings:\n${adviceContext}` : ''}

CRITICAL REQUIREMENT (Unified Persona):
- The user asked you a complex request. Behind the scenes, your specialized internal components researched, calculated, and drafted the pieces.
- Now, write ONE unified, beautifully structured, cohesive response directly from YOU (${agent.name}).
- DO NOT say "Specialist X did this, and Specialist Y did that". Present the findings naturally as YOUR complete, finished work for the user.
- Ensure the result is comprehensive, beautifully formatted with Markdown headings, tables, or code where appropriate.`

    const synthesisUserPrompt = `USER REQUEST:
"${userPrompt}"

RAW INTERNAL DELIVERABLES GATHERED:
${combinedSpecialistData}

Please synthesize this into your unified personal response:`

    try {
      const llmPromise = callLLM(
        agent.preferredModel || 'gpt-4o',
        systemPrompt,
        synthesisUserPrompt,
        1500
      )
      const timeoutPromise = new Promise<{ content?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Synthesis timeout')), 2000)
      )

      const llmRes = await Promise.race([llmPromise, timeoutPromise])

      if (llmRes.content && llmRes.content.trim().length > 20) {
        return llmRes.content.trim()
      }
    } catch (err) {
      logger.info(`[PersonalOrchestrator] Fast synthesis path active`)
    }

    // High quality deterministic fallback synthesis in agent persona
    const synthesisSections = stepOutputs.map(s => {
      const cleanOutput = s.output.replace(/^\[.*?\]\s*/, '').trim()
      return cleanOutput
    }).join('\n\n')

    return `Here is what I've organized for you:\n\n${synthesisSections}\n\n*Compiled and formatted for your workflow.*`
  }
}

export const personalAgentOrchestratorService = new PersonalAgentOrchestratorService()
