import crypto from 'crypto'
import { EventEmitter } from 'events'
import { logger } from './logger.service'
import { agentBus } from '../runtime/agent-bus.service'
import { db } from '../db'

export type SpanType = 'agent' | 'llm' | 'tool' | 'handoff' | 'escalation' | 'sandbox' | 'critic'
export type SpanStatus = 'ok' | 'error' | 'in_progress'
export type FindingType = 'long_running' | 'repeated_tool' | 'repeated_error' | 'no_activity' | 'possible_loop'
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface ObservedRun {
  id: string
  tenantId: string
  agentId?: string
  agentRole: string
  teamId?: string
  teamName?: string
  missionGoal: string
  status: 'running' | 'completed' | 'failed' | 'stuck' | 'paused'
  startedAt: string
  endedAt?: string
  durationMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalCostUSD: number
  metadata?: Record<string, any>
  lastActivityAt: string
}

export interface ObservedSpan {
  id: string
  runId: string
  parentId?: string
  traceId: string
  type: SpanType
  name: string
  status: SpanStatus
  startedAt: string
  endedAt?: string
  durationMs: number
  input?: any
  output?: any
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface ObservedLog {
  id: string
  runId: string
  spanId?: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
}

export interface ObservedError {
  id: string
  runId: string
  spanId?: string
  errorSignature: string
  type: string
  message: string
  stack?: string
  agentRole: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface ObservedFinding {
  id: string
  runId: string
  spanId?: string
  type: FindingType
  severity: FindingSeverity
  message: string
  details: Record<string, any>
  actionTaken?: 'alert_supervisor' | 'escalate' | 'reassign' | 'circuit_trip' | 'none'
  createdAt: string
}

export interface ErrorSignatureGroup {
  signature: string
  type: string
  sampleMessage: string
  sampleStack?: string
  count: number
  firstSeenAt: string
  lastSeenAt: string
  affectedAgents: string[]
  affectedRunIds: string[]
  sampleErrors: ObservedError[]
}

export interface DetectionThresholds {
  longRunningRunMs: number
  longRunningSpanMs: number
  repeatedToolThreshold: number
  repeatedErrorThreshold: number
  noActivitySeconds: number
  sweepIntervalSeconds: number
}

export class ObservabilityService extends EventEmitter {
  private runs: Map<string, ObservedRun> = new Map()
  private spans: Map<string, ObservedSpan> = new Map()
  private runSpans: Map<string, string[]> = new Map()
  private logs: Map<string, ObservedLog[]> = new Map()
  private errors: Map<string, ObservedError[]> = new Map() // signature -> errors
  private runErrors: Map<string, ObservedError[]> = new Map() // runId -> errors
  private findings: Map<string, ObservedFinding[]> = new Map() // runId -> findings
  private allFindings: ObservedFinding[] = []

  private thresholds: DetectionThresholds = {
    longRunningRunMs: 120000,
    longRunningSpanMs: 45000,
    repeatedToolThreshold: 4,
    repeatedErrorThreshold: 3,
    noActivitySeconds: 30,
    sweepIntervalSeconds: 10
  }

  private sweepTimer?: NodeJS.Timeout

  constructor() {
    super()
    this.startPeriodicSweep()
  }

  /**
   * Generates a deterministic hash signature from error type and message
   */
  public computeErrorSignature(type: string, message: string): string {
    const raw = `${type || 'Error'}:${message || 'Unknown'}`
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 12)
  }

  /**
   * Starts or updates a run record
   */
  public startRun(params: {
    runId?: string
    tenantId?: string
    agentId?: string
    agentRole: string
    teamId?: string
    teamName?: string
    missionGoal: string
    metadata?: Record<string, any>
  }): ObservedRun {
    const id = params.runId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()

    const run: ObservedRun = {
      id,
      tenantId: params.tenantId || '00000000-0000-0000-0000-000000000000',
      agentId: params.agentId,
      agentRole: params.agentRole,
      teamId: params.teamId,
      teamName: params.teamName || 'Autonomous Workforce Squad',
      missionGoal: params.missionGoal || 'Execute multi-agent goal',
      status: 'running',
      startedAt: now,
      lastActivityAt: now,
      durationMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCostUSD: 0,
      metadata: params.metadata || {}
    }

    this.runs.set(id, run)
    this.emit('run_update', run)
    return run
  }

  /**
   * Finalizes an observed run with status, token usage, and cost
   */
  public endRun(runId: string, params: {
    status: 'completed' | 'failed' | 'stuck' | 'paused'
    promptTokens?: number
    completionTokens?: number
    costUSD?: number
    error?: Error | string
  }): ObservedRun | undefined {
    const run = this.runs.get(runId)
    if (!run) return undefined

    const now = new Date().toISOString()
    const start = new Date(run.startedAt).getTime()
    const end = new Date(now).getTime()

    run.endedAt = now
    run.durationMs = Math.max(0, end - start)
    run.status = params.status
    run.lastActivityAt = now

    if (params.promptTokens) run.promptTokens += params.promptTokens
    if (params.completionTokens) run.completionTokens += params.completionTokens
    run.totalTokens = run.promptTokens + run.completionTokens
    if (params.costUSD) run.totalCostUSD += params.costUSD

    if (params.error) {
      const errMsg = typeof params.error === 'string' ? params.error : params.error.message
      const stack = typeof params.error === 'object' ? params.error.stack : undefined
      this.recordError({
        runId,
        type: 'RunExecutionError',
        message: errMsg,
        stack,
        agentRole: run.agentRole
      })
    }

    this.emit('run_update', run)
    return run
  }

  /**
   * Starts an OpenTelemetry-compatible execution span
   */
  public startSpan(params: {
    runId: string
    parentId?: string
    name: string
    type: SpanType
    input?: any
    metadata?: Record<string, any>
  }): ObservedSpan {
    const id = `span_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const traceId = crypto.randomBytes(16).toString('hex')
    const now = new Date().toISOString()

    const span: ObservedSpan = {
      id,
      runId: params.runId,
      parentId: params.parentId,
      traceId,
      type: params.type,
      name: params.name,
      status: 'in_progress',
      startedAt: now,
      durationMs: 0,
      input: params.input,
      metadata: params.metadata || {}
    }

    this.spans.set(id, span)

    let list = this.runSpans.get(params.runId)
    if (!list) {
      list = []
      this.runSpans.set(params.runId, list)
    }
    list.push(id)

    const run = this.runs.get(params.runId)
    if (run) {
      run.lastActivityAt = now
    }

    this.emit('span_update', span)
    return span
  }

  /**
   * Ends an execution span and evaluates ingest detection rules
   */
  public endSpan(spanId: string, params: {
    status?: SpanStatus
    output?: any
    error?: Error | string
  }): ObservedSpan | undefined {
    const span = this.spans.get(spanId)
    if (!span) return undefined

    const now = new Date().toISOString()
    const start = new Date(span.startedAt).getTime()
    const end = new Date(now).getTime()

    span.endedAt = now
    span.durationMs = Math.max(0, end - start)
    span.output = params.output
    span.status = params.status || (params.error ? 'error' : 'ok')

    if (params.error) {
      const errMsg = typeof params.error === 'string' ? params.error : params.error.message
      const stack = typeof params.error === 'object' ? params.error.stack : undefined
      span.errorMessage = errMsg
      span.status = 'error'

      this.recordError({
        runId: span.runId,
        spanId: span.id,
        type: `${span.type.toUpperCase()}_Error`,
        message: errMsg,
        stack,
        agentRole: span.metadata?.agent_role || 'agent'
      })
    }

    const run = this.runs.get(span.runId)
    if (run) {
      run.lastActivityAt = now
    }

    this.emit('span_update', span)

    // Evaluate deterministic rules on ingest
    this.evaluateSpanOnIngest(span)
    return span
  }

  /**
   * Records a structured log entry
   */
  public recordLog(params: {
    runId: string
    spanId?: string
    level: 'debug' | 'info' | 'warn' | 'error'
    message: string
    metadata?: Record<string, any>
  }): ObservedLog {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()

    const log: ObservedLog = {
      id,
      runId: params.runId,
      spanId: params.spanId,
      timestamp: now,
      level: params.level,
      message: params.message,
      metadata: params.metadata
    }

    let list = this.logs.get(params.runId)
    if (!list) {
      list = []
      this.logs.set(params.runId, list)
    }
    if (list.length >= 1000) list.shift()
    list.push(log)

    const run = this.runs.get(params.runId)
    if (run) {
      run.lastActivityAt = now
    }

    this.emit('log_entry', log)
    return log
  }

  /**
   * Records an error entry grouped by signature
   */
  public recordError(params: {
    runId: string
    spanId?: string
    type: string
    message: string
    stack?: string
    agentRole?: string
    metadata?: Record<string, any>
  }): ObservedError {
    const signature = this.computeErrorSignature(params.type, params.message)
    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()

    const err: ObservedError = {
      id,
      runId: params.runId,
      spanId: params.spanId,
      errorSignature: signature,
      type: params.type || 'Error',
      message: params.message,
      stack: params.stack,
      agentRole: params.agentRole || 'agent',
      timestamp: now,
      metadata: params.metadata
    }

    // Add to signature map
    let sigList = this.errors.get(signature)
    if (!sigList) {
      sigList = []
      this.errors.set(signature, sigList)
    }
    sigList.push(err)

    // Add to run errors map
    let runList = this.runErrors.get(params.runId)
    if (!runList) {
      runList = []
      this.runErrors.set(params.runId, runList)
    }
    runList.push(err)

    this.emit('error_entry', err)

    // Ingest check for repeated errors
    if (sigList.length >= this.thresholds.repeatedErrorThreshold) {
      this.addFinding({
        runId: params.runId,
        spanId: params.spanId,
        type: 'repeated_error',
        severity: 'high',
        message: `Error signature '${signature}' occurred ${sigList.length} times across runs: "${params.message}"`,
        details: {
          signature,
          count: sigList.length,
          threshold: this.thresholds.repeatedErrorThreshold,
          sampleMessage: params.message
        },
        actionTaken: 'escalate'
      })

      // Wire active recovery path: alert supervisor on agentBus
      agentBus.alertSupervisor('global', params.agentRole || 'agent', {
        reason: `Repeated error signature (${signature}) triggered threshold`,
        runId: params.runId,
        error: params.message
      }).catch(() => {})
    }

    return err
  }

  /**
   * Adds an automated diagnostic finding and emits live notification
   */
  public addFinding(params: {
    runId: string
    spanId?: string
    type: FindingType
    severity: FindingSeverity
    message: string
    details?: Record<string, any>
    actionTaken?: 'alert_supervisor' | 'escalate' | 'reassign' | 'circuit_trip' | 'none'
  }): ObservedFinding {
    const id = `find_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const now = new Date().toISOString()

    const finding: ObservedFinding = {
      id,
      runId: params.runId,
      spanId: params.spanId,
      type: params.type,
      severity: params.severity,
      message: params.message,
      details: params.details || {},
      actionTaken: params.actionTaken || 'none',
      createdAt: now
    }

    let list = this.findings.get(params.runId)
    if (!list) {
      list = []
      this.findings.set(params.runId, list)
    }
    list.push(finding)
    this.allFindings.unshift(finding)
    if (this.allFindings.length > 500) this.allFindings.pop()

    this.emit('finding_entry', finding)
    logger.warn(`[Observability] 🚨 ${finding.severity.toUpperCase()} Finding [${finding.type}]: ${finding.message}`)
    return finding
  }

  /**
   * Evaluates deterministic rules when a span completes
   */
  private evaluateSpanOnIngest(span: ObservedSpan): void {
    // 1. Long running span check
    if (span.durationMs > this.thresholds.longRunningSpanMs && span.status !== 'in_progress') {
      this.addFinding({
        runId: span.runId,
        spanId: span.id,
        type: 'long_running',
        severity: 'medium',
        message: `Span '${span.name}' [${span.type}] exceeded duration threshold (${span.durationMs}ms > ${this.thresholds.longRunningSpanMs}ms)`,
        details: { spanId: span.id, durationMs: span.durationMs, threshold: this.thresholds.longRunningSpanMs }
      })
    }

    // 2. Repeated tool check
    const spanIds = this.runSpans.get(span.runId) || []
    const runSpansList = spanIds.map(id => this.spans.get(id)).filter(Boolean) as ObservedSpan[]
    if (runSpansList.length >= 3) {
      this.checkRepeatedTool(span.runId, runSpansList)
      this.checkPossibleLoop(span.runId, runSpansList)
    }
  }

  private checkRepeatedTool(runId: string, spansList: ObservedSpan[]): void {
    const counts: Record<string, number> = {}
    for (const s of spansList) {
      if (s.type === 'tool' && s.name) {
        counts[s.name] = (counts[s.name] || 0) + 1
      }
    }

    for (const [toolName, count] of Object.entries(counts)) {
      if (count >= this.thresholds.repeatedToolThreshold) {
        const existing = this.findings.get(runId) || []
        const alreadyReported = existing.some(f => f.type === 'repeated_tool' && f.details?.toolName === toolName)
        if (!alreadyReported) {
          const finding = this.addFinding({
            runId,
            type: 'repeated_tool',
            severity: 'high',
            message: `Tool '${toolName}' invoked ${count} times without completing goal (threshold: ${this.thresholds.repeatedToolThreshold}) — agent may be flailing`,
            details: { toolName, count, threshold: this.thresholds.repeatedToolThreshold },
            actionTaken: 'reassign'
          })

          const run = this.runs.get(runId)
          agentBus.alertSupervisor(run?.teamId || 'global', run?.agentRole || 'agent', {
            reason: `Flailing agent repeatedly calling ${toolName}`,
            runId,
            finding
          }).catch(() => {})
        }
      }
    }
  }

  private checkPossibleLoop(runId: string, spansList: ObservedSpan[]): void {
    const toolSequence = spansList
      .filter(s => s.type === 'tool' || s.type === 'llm')
      .map(s => ({
        name: s.name,
        inputHash: crypto.createHash('md5').update(JSON.stringify(s.input || {})).digest('hex').substring(0, 8)
      }))

    const n = toolSequence.length
    if (n < 3) return

    const existing = this.findings.get(runId) || []
    if (existing.some(f => f.type === 'possible_loop')) return

    // Period 1: A -> A -> A
    if (n >= 3) {
      const a = toolSequence[n - 1], b = toolSequence[n - 2], c = toolSequence[n - 3]
      if (a.name === b.name && b.name === c.name && a.inputHash === b.inputHash && b.inputHash === c.inputHash) {
        this.emitLoopAlert(runId, `Single-step cycle detected: '${a.name}' invoked 3x consecutively with identical arguments`, 1, a.name)
        return
      }
    }

    // Period 2: A -> B -> A -> B
    if (n >= 4) {
      const a1 = toolSequence[n - 4], b1 = toolSequence[n - 3], a2 = toolSequence[n - 2], b2 = toolSequence[n - 1]
      if (a1.name === a2.name && b1.name === b2.name && a1.inputHash === a2.inputHash && b1.inputHash === b2.inputHash) {
        this.emitLoopAlert(runId, `Two-step cycle detected: [${a1.name} -> ${b1.name}] repeating with identical arguments`, 2, `${a1.name} -> ${b1.name}`)
        return
      }
    }

    // Period 3: A -> B -> C -> A -> B -> C
    if (n >= 6) {
      const a1 = toolSequence[n - 6], b1 = toolSequence[n - 5], c1 = toolSequence[n - 4]
      const a2 = toolSequence[n - 3], b2 = toolSequence[n - 2], c2 = toolSequence[n - 1]
      if (a1.name === a2.name && b1.name === b2.name && c1.name === c2.name &&
          a1.inputHash === a2.inputHash && b1.inputHash === b2.inputHash && c1.inputHash === c2.inputHash) {
        this.emitLoopAlert(runId, `Three-step cycle detected: [${a1.name} -> ${b1.name} -> ${c1.name}] repeating deterministically`, 3, `${a1.name} -> ${b1.name} -> ${c1.name}`)
        return
      }
    }
  }

  private emitLoopAlert(runId: string, message: string, period: number, pattern: string): void {
    const finding = this.addFinding({
      runId,
      type: 'possible_loop',
      severity: 'critical',
      message,
      details: { period, pattern },
      actionTaken: 'alert_supervisor'
    })

    const run = this.runs.get(runId)
    agentBus.alertSupervisor(run?.teamId || 'global', run?.agentRole || 'agent', {
      reason: `Agent stuck in reasoning loop (${pattern})`,
      runId,
      finding
    }).catch(() => {})
  }

  /**
   * Periodic background sweep checking long-running runs and silent agents
   */
  private startPeriodicSweep(): void {
    const intervalMs = (this.thresholds.sweepIntervalSeconds || 10) * 1000
    this.sweepTimer = setInterval(() => {
      this.runPeriodicSweep()
    }, intervalMs)
  }

  public runPeriodicSweep(): void {
    const now = Date.now()

    for (const run of this.runs.values()) {
      if (run.status !== 'running') continue

      const start = new Date(run.startedAt).getTime()
      const runDur = now - start
      const existing = this.findings.get(run.id) || []

      // Check long_running run
      if (runDur > this.thresholds.longRunningRunMs && !existing.some(f => f.type === 'long_running' && !f.spanId)) {
        this.addFinding({
          runId: run.id,
          type: 'long_running',
          severity: 'medium',
          message: `Run '${run.id}' duration (${Math.round(runDur / 1000)}s) exceeded threshold (${Math.round(this.thresholds.longRunningRunMs / 1000)}s)`,
          details: { durationMs: runDur, threshold: this.thresholds.longRunningRunMs }
        })
      }

      // Check no_activity (silent agent)
      const lastAct = new Date(run.lastActivityAt || run.startedAt).getTime()
      const silentSec = Math.round((now - lastAct) / 1000)

      if (silentSec >= this.thresholds.noActivitySeconds && !existing.some(f => f.type === 'no_activity')) {
        const finding = this.addFinding({
          runId: run.id,
          type: 'no_activity',
          severity: 'high',
          message: `Agent '${run.agentRole}' in run '${run.id}' has shown no activity for ${silentSec}s (threshold: ${this.thresholds.noActivitySeconds}s) — possible hung execution`,
          details: { silentSeconds: silentSec, threshold: this.thresholds.noActivitySeconds },
          actionTaken: 'escalate'
        })

        if (silentSec >= this.thresholds.noActivitySeconds * 2) {
          run.status = 'stuck'
          this.emit('run_update', run)
        }

        agentBus.alertSupervisor(run.teamId || 'global', run.agentRole, {
          reason: `Silent / hung agent detected in run ${run.id}`,
          runId: run.id,
          finding
        }).catch(() => {})
      }
    }
  }

  // --- QUERY APIS ---

  public listRuns(options?: { limit?: number; status?: string; role?: string }): ObservedRun[] {
    let result = Array.from(this.runs.values())
    if (options?.status) result = result.filter(r => r.status === options.status)
    if (options?.role) result = result.filter(r => r.agentRole === options.role)
    result.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    if (options?.limit && options.limit > 0) result = result.slice(0, options.limit)
    return result
  }

  public getRun(runId: string): {
    run: ObservedRun | undefined
    spans: ObservedSpan[]
    logs: ObservedLog[]
    errors: ObservedError[]
    findings: ObservedFinding[]
  } {
    const run = this.runs.get(runId)
    const spanIds = this.runSpans.get(runId) || []
    const spans = spanIds.map(id => this.spans.get(id)).filter(Boolean) as ObservedSpan[]
    spans.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

    const logs = this.logs.get(runId) || []
    const errors = this.runErrors.get(runId) || []
    const findings = this.findings.get(runId) || []

    return { run, spans, logs, errors, findings }
  }

  public getErrorsGroupedBySignature(): ErrorSignatureGroup[] {
    const groups: ErrorSignatureGroup[] = []

    for (const [signature, list] of this.errors.entries()) {
      if (list.length === 0) continue

      const sample = list[list.length - 1]
      const agents = Array.from(new Set(list.map(e => e.agentRole).filter(Boolean)))
      const runIds = Array.from(new Set(list.map(e => e.runId).filter(Boolean)))
      const timestamps = list.map(e => new Date(e.timestamp).getTime())
      const firstSeenAt = new Date(Math.min(...timestamps)).toISOString()
      const lastSeenAt = new Date(Math.max(...timestamps)).toISOString()

      groups.push({
        signature,
        type: sample.type,
        sampleMessage: sample.message,
        sampleStack: sample.stack,
        count: list.length,
        firstSeenAt,
        lastSeenAt,
        affectedAgents: agents,
        affectedRunIds: runIds,
        sampleErrors: list.slice(-10)
      })
    }

    groups.sort((a, b) => b.count - a.count)
    return groups
  }

  public getErrorDetail(signature: string): {
    group: ErrorSignatureGroup | undefined
    occurrences: ObservedError[]
    affectedRuns: ObservedRun[]
  } {
    const list = this.errors.get(signature) || []
    if (list.length === 0) {
      return { group: undefined, occurrences: [], affectedRuns: [] }
    }

    const sample = list[list.length - 1]
    const agents = Array.from(new Set(list.map(e => e.agentRole).filter(Boolean)))
    const runIds = Array.from(new Set(list.map(e => e.runId).filter(Boolean)))
    const timestamps = list.map(e => new Date(e.timestamp).getTime())

    const group: ErrorSignatureGroup = {
      signature,
      type: sample.type,
      sampleMessage: sample.message,
      sampleStack: sample.stack,
      count: list.length,
      firstSeenAt: new Date(Math.min(...timestamps)).toISOString(),
      lastSeenAt: new Date(Math.max(...timestamps)).toISOString(),
      affectedAgents: agents,
      affectedRunIds: runIds,
      sampleErrors: list
    }

    const affectedRuns = runIds.map(id => this.runs.get(id)).filter(Boolean) as ObservedRun[]

    return { group, occurrences: list, affectedRuns }
  }

  public listFindings(limit = 100): ObservedFinding[] {
    return this.allFindings.slice(0, limit)
  }

  public getThresholds(): DetectionThresholds {
    return { ...this.thresholds }
  }

  public updateThresholds(cfg: Partial<DetectionThresholds>): DetectionThresholds {
    this.thresholds = { ...this.thresholds, ...cfg }
    logger.info(`[Observability] Updated detection thresholds: ${JSON.stringify(this.thresholds)}`)
    return this.thresholds
  }
}

export const observabilityService = new ObservabilityService()
