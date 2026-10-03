import { agentBus, AgentBusMessage } from '../runtime/agent-bus.service'
import { taskEventBus } from './task-event-bus.service'
import { sessionReplayService } from './session-replay.service'
import { logger } from './logger.service'

export interface AgentHandoffPayload {
  handoffId: string
  runId: string
  teamId: string
  fromRole: string
  toRole: string
  summaryOfWorkDone: string
  keyContextForReceiver: Record<string, any> | string
  artifactsProduced: Array<{ name: string; type: string; pathOrUrl?: string; preview?: string }>
  openQuestions?: string[]
  timestamp: string
}

export interface AgentEscalationPayload {
  escalationId: string
  runId: string
  teamId: string
  fromRole: string
  escalationTarget: 'team_lead' | 'human_operator'
  blockerReason: string
  attemptedApproaches: string[]
  requiredDecision: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'acknowledged' | 'resolved'
  resolution?: string
  timestamp: string
}

export interface TeamStandupReport {
  standupId: string
  runId: string
  teamId: string
  teamLeadRole: string
  summaryHeadline: string
  whatIsDone: string[]
  whatIsInProgress: Array<{ role: string; task: string; progressPercent?: number }>
  whatIsBlocked: Array<{ role: string; blocker: string; escalationId?: string }>
  estimatedProgressPercent: number
  timestamp: string
}

export interface ClarificationTurn {
  fromRole: string
  toRole: string
  question: string
  answer?: string
  timestamp: string
}

export interface ClarificationExchange {
  conversationId: string
  runId: string
  teamId: string
  handoffId?: string
  agentA: string
  agentB: string
  turns: ClarificationTurn[]
  currentRound: number
  maxRounds: number
  status: 'open' | 'answered' | 'escalated_due_to_loop'
  escalationId?: string
}

export class AgentCollaborationService {
  private handoffHistory: Map<string, AgentHandoffPayload[]> = new Map() // keyed by runId
  private escalationHistory: Map<string, AgentEscalationPayload[]> = new Map() // keyed by runId
  private standupHistory: Map<string, TeamStandupReport[]> = new Map() // keyed by runId
  private clarificationThreads: Map<string, ClarificationExchange> = new Map() // keyed by conversationId
  private liveTeamMessages: Map<string, any[]> = new Map() // keyed by teamId

  /**
   * 1. Structured Handoff Protocol
   */
  async performHandoff(params: Omit<AgentHandoffPayload, 'handoffId' | 'timestamp'>): Promise<AgentHandoffPayload> {
    const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const timestamp = new Date().toISOString()

    const handoff: AgentHandoffPayload = {
      handoffId,
      timestamp,
      ...params,
    }

    // Save to run handoff history
    if (!this.handoffHistory.has(handoff.runId)) {
      this.handoffHistory.set(handoff.runId, [])
    }
    this.handoffHistory.get(handoff.runId)!.push(handoff)

    // Save to team live chatter history
    this.recordLiveTeamMessage(handoff.teamId, {
      type: 'handoff',
      sender: handoff.fromRole,
      recipient: handoff.toRole,
      title: `Handoff from @${handoff.fromRole} to @${handoff.toRole}`,
      data: handoff,
      timestamp,
    })

    // Publish to AgentBus
    await agentBus.publish(`team:${handoff.teamId}`, {
      fromAgentId: handoff.fromRole,
      toAgentId: handoff.toRole,
      teamId: handoff.teamId,
      messageType: 'task_assignment',
      payload: {
        eventType: 'AGENT_HANDOFF',
        handoff,
      },
    })

    // Log to Session Replay
    try {
      await sessionReplayService.recordReplayStep(
        handoff.runId,
        {
          stepIndex: Date.now() % 100000,
          agentRole: handoff.fromRole,
          actionType: 'agent_handoff' as any,
          toolName: 'AgentBus.Handoff',
          toolInput: {
            toRole: handoff.toRole,
            summaryOfWorkDone: handoff.summaryOfWorkDone,
            artifactsProduced: handoff.artifactsProduced.length,
          },
          toolOutput: {
            handoffId: handoff.handoffId,
            keyContext: handoff.keyContextForReceiver,
            openQuestions: handoff.openQuestions || [],
          },
          rationale: `Handing off completed work to ${handoff.toRole} with structured context and ${handoff.artifactsProduced.length} artifacts.`,
          stepCostUSD: 0,
          timestamp,
        },
        {
          teamId: handoff.teamId,
          agentRole: handoff.fromRole,
        }
      )
    } catch (e: any) {
      logger.warn(`[Collaboration] Replay logging note: ${e.message}`)
    }

    // Emit live SSE event
    taskEventBus.emitTaskEvent(handoff.runId, 'collaboration:handoff', {
      teamId: handoff.teamId,
      handoff,
    })

    logger.info(`[Handoff] @${handoff.fromRole} -> @${handoff.toRole} (Run: ${handoff.runId}) | Work: "${handoff.summaryOfWorkDone}"`)

    return handoff
  }

  /**
   * 2. Formal Escalation Pattern
   */
  async escalateIssue(params: Omit<AgentEscalationPayload, 'escalationId' | 'status' | 'timestamp'>): Promise<AgentEscalationPayload> {
    const escalationId = `esc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const timestamp = new Date().toISOString()

    const escalation: AgentEscalationPayload = {
      escalationId,
      status: 'pending',
      timestamp,
      ...params,
    }

    if (!this.escalationHistory.has(escalation.runId)) {
      this.escalationHistory.set(escalation.runId, [])
    }
    this.escalationHistory.get(escalation.runId)!.push(escalation)

    // Save to team live chatter
    this.recordLiveTeamMessage(escalation.teamId, {
      type: 'escalation',
      sender: escalation.fromRole,
      recipient: escalation.escalationTarget,
      title: `⚠️ Escalation by @${escalation.fromRole} [${escalation.urgency.toUpperCase()}]`,
      data: escalation,
      timestamp,
    })

    // Publish to AgentBus supervisor channel
    await agentBus.alertSupervisor(escalation.teamId, escalation.fromRole, {
      eventType: 'AGENT_ESCALATION',
      escalation,
    })

    // Log to Session Replay
    try {
      await sessionReplayService.recordReplayStep(
        escalation.runId,
        {
          stepIndex: Date.now() % 100000,
          agentRole: escalation.fromRole,
          actionType: 'agent_escalation' as any,
          toolName: 'AgentBus.Escalate',
          toolInput: {
            target: escalation.escalationTarget,
            urgency: escalation.urgency,
            blocker: escalation.blockerReason,
          },
          toolOutput: {
            escalationId: escalation.escalationId,
            attemptedApproaches: escalation.attemptedApproaches,
            requiredDecision: escalation.requiredDecision,
          },
          rationale: `Escalating blocker to ${escalation.escalationTarget}: ${escalation.blockerReason}`,
          stepCostUSD: 0,
          timestamp,
        },
        {
          teamId: escalation.teamId,
          agentRole: escalation.fromRole,
        }
      )
    } catch (e: any) {
      logger.warn(`[Collaboration] Replay logging note: ${e.message}`)
    }

    // Emit live SSE event
    taskEventBus.emitTaskEvent(escalation.runId, 'collaboration:escalation', {
      teamId: escalation.teamId,
      escalation,
    })

    logger.warn(`[Escalation] @${escalation.fromRole} escalated to ${escalation.escalationTarget}: "${escalation.blockerReason}"`)

    return escalation
  }

  /**
   * Resolves an active escalation
   */
  resolveEscalation(runId: string, escalationId: string, resolution: string, resolvedBy: string): AgentEscalationPayload | null {
    const list = this.escalationHistory.get(runId) || []
    const esc = list.find((e) => e.escalationId === escalationId)
    if (!esc) return null

    esc.status = 'resolved'
    esc.resolution = `Resolved by ${resolvedBy}: ${resolution}`

    taskEventBus.emitTaskEvent(runId, 'collaboration:escalation_resolved', {
      escalationId,
      resolution: esc.resolution,
    })

    return esc
  }

  /**
   * 3. Team Standup Summary Pattern
   */
  async generateStandupSummary(params: Omit<TeamStandupReport, 'standupId' | 'timestamp'>): Promise<TeamStandupReport> {
    const standupId = `standup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const timestamp = new Date().toISOString()

    const standup: TeamStandupReport = {
      standupId,
      timestamp,
      ...params,
    }

    if (!this.standupHistory.has(standup.runId)) {
      this.standupHistory.set(standup.runId, [])
    }
    this.standupHistory.get(standup.runId)!.push(standup)

    // Save to team live chatter
    this.recordLiveTeamMessage(standup.teamId, {
      type: 'standup',
      sender: standup.teamLeadRole,
      recipient: 'team_and_human',
      title: `📊 Team Standup: ${standup.summaryHeadline} (${standup.estimatedProgressPercent}% Complete)`,
      data: standup,
      timestamp,
    })

    // Broadcast on AgentBus
    await agentBus.broadcastToTeam(standup.teamId, standup.teamLeadRole, {
      eventType: 'TEAM_STANDUP',
      standup,
    })

    // Log to Session Replay
    try {
      await sessionReplayService.recordReplayStep(
        standup.runId,
        {
          stepIndex: Date.now() % 100000,
          agentRole: standup.teamLeadRole,
          actionType: 'team_standup' as any,
          toolName: 'TeamLead.Standup',
          toolInput: {
            progressPercent: standup.estimatedProgressPercent,
            completedCount: standup.whatIsDone.length,
            inProgressCount: standup.whatIsInProgress.length,
          },
          toolOutput: {
            standupId: standup.standupId,
            headline: standup.summaryHeadline,
            blockers: standup.whatIsBlocked,
          },
          rationale: `Conducting periodic standup summary for human supervisor: ${standup.summaryHeadline}`,
          stepCostUSD: 0,
          timestamp,
        },
        {
          teamId: standup.teamId,
          agentRole: standup.teamLeadRole,
        }
      )
    } catch (e: any) {
      logger.warn(`[Collaboration] Replay logging note: ${e.message}`)
    }

    // Emit live SSE event
    taskEventBus.emitTaskEvent(standup.runId, 'collaboration:standup', {
      teamId: standup.teamId,
      standup,
    })

    logger.info(`[Standup] Team ${standup.teamId}: "${standup.summaryHeadline}" | Done: ${standup.whatIsDone.length} | In Progress: ${standup.whatIsInProgress.length} | Blocked: ${standup.whatIsBlocked.length}`)

    return standup
  }

  /**
   * 4. Inter-Agent Clarifying Q&A with Strict Loop Protection
   */
  async askClarification(params: {
    runId: string
    teamId: string
    handoffId?: string
    fromRole: string
    toRole: string
    question: string
    maxRounds?: number
  }): Promise<{
    conversationId: string
    exchange: ClarificationExchange
    escalated: boolean
    escalation?: AgentEscalationPayload
  }> {
    const maxRounds = params.maxRounds || 3
    const conversationKey = params.handoffId || `thread_${params.runId}_${[params.fromRole, params.toRole].sort().join('_')}`

    let exchange = this.clarificationThreads.get(conversationKey)

    if (!exchange) {
      exchange = {
        conversationId: conversationKey,
        runId: params.runId,
        teamId: params.teamId,
        handoffId: params.handoffId,
        agentA: params.fromRole,
        agentB: params.toRole,
        turns: [],
        currentRound: 1,
        maxRounds,
        status: 'open',
      }
      this.clarificationThreads.set(conversationKey, exchange)
    } else {
      exchange.currentRound++
    }

    const turn: ClarificationTurn = {
      fromRole: params.fromRole,
      toRole: params.toRole,
      question: params.question,
      timestamp: new Date().toISOString(),
    }
    exchange.turns.push(turn)

    // Save to team live chatter
    this.recordLiveTeamMessage(params.teamId, {
      type: 'clarification_question',
      sender: params.fromRole,
      recipient: params.toRole,
      title: `❓ Question: @${params.fromRole} asked @${params.toRole} (Round ${exchange.currentRound}/${exchange.maxRounds})`,
      data: { question: params.question, conversationId: conversationKey },
      timestamp: turn.timestamp,
    })

    // Publish direct message to peer on AgentBus
    await agentBus.sendDirect(params.fromRole, params.toRole, {
      eventType: 'CLARIFICATION_QUESTION',
      conversationId: conversationKey,
      round: exchange.currentRound,
      maxRounds: exchange.maxRounds,
      question: params.question,
    }, params.teamId)

    // Check Turn Limit & Loop Protection
    if (exchange.currentRound > exchange.maxRounds) {
      exchange.status = 'escalated_due_to_loop'
      logger.warn(`[Loop Protection Triggered] Clarification between @${params.fromRole} and @${params.toRole} exceeded ${exchange.maxRounds} rounds. Auto-escalating to TeamLead/Human!`)

      const escalation = await this.escalateIssue({
        runId: params.runId,
        teamId: params.teamId,
        fromRole: params.fromRole,
        escalationTarget: 'team_lead',
        blockerReason: `Ambiguity unresolved after ${exchange.maxRounds} clarification rounds between @${params.fromRole} and @${params.toRole}.`,
        attemptedApproaches: exchange.turns.map((t) => `@${t.fromRole}: Q: "${t.question}" -> A: "${t.answer || 'none'}"`),
        requiredDecision: `Please review discussion and provide definitive guidance on: "${params.question}"`,
        urgency: 'high',
      })

      exchange.escalationId = escalation.escalationId
      return {
        conversationId: conversationKey,
        exchange,
        escalated: true,
        escalation,
      }
    }

    return {
      conversationId: conversationKey,
      exchange,
      escalated: false,
    }
  }

  /**
   * Responds to an open clarification question
   */
  async respondClarification(params: {
    conversationId: string
    fromRole: string
    answer: string
  }): Promise<ClarificationExchange | null> {
    const exchange = this.clarificationThreads.get(params.conversationId)
    if (!exchange || exchange.turns.length === 0) return null

    const latestTurn = exchange.turns[exchange.turns.length - 1]
    latestTurn.answer = params.answer
    exchange.status = 'answered'

    // Save to team live chatter
    this.recordLiveTeamMessage(exchange.teamId, {
      type: 'clarification_answer',
      sender: params.fromRole,
      recipient: latestTurn.fromRole,
      title: `💡 Answer: @${params.fromRole} replied to @${latestTurn.fromRole}`,
      data: { answer: params.answer, conversationId: params.conversationId },
      timestamp: new Date().toISOString(),
    })

    // Send response via AgentBus
    await agentBus.sendDirect(params.fromRole, latestTurn.fromRole, {
      eventType: 'CLARIFICATION_ANSWER',
      conversationId: params.conversationId,
      answer: params.answer,
    }, exchange.teamId)

    return exchange
  }

  /**
   * 5. Live Team Feed & Historical Queries
   */
  private recordLiveTeamMessage(teamId: string, msg: any) {
    if (!this.liveTeamMessages.has(teamId)) {
      this.liveTeamMessages.set(teamId, [])
    }
    const list = this.liveTeamMessages.get(teamId)!
    list.push({ id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...msg })
    if (list.length > 200) list.shift()
  }

  getLiveTeamChatter(teamId: string, limit = 50): any[] {
    const list = this.liveTeamMessages.get(teamId) || []
    return list.slice(-limit)
  }

  getRunCollaborationTimeline(runId: string): {
    handoffs: AgentHandoffPayload[]
    escalations: AgentEscalationPayload[]
    standups: TeamStandupReport[]
  } {
    return {
      handoffs: this.handoffHistory.get(runId) || [],
      escalations: this.escalationHistory.get(runId) || [],
      standups: this.standupHistory.get(runId) || [],
    }
  }

  clearHistory(): void {
    this.handoffHistory.clear()
    this.escalationHistory.clear()
    this.standupHistory.clear()
    this.clarificationThreads.clear()
    this.liveTeamMessages.clear()
  }
}

export const agentCollaborationService = new AgentCollaborationService()
