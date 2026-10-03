import { Router, Request, Response } from 'express'
import { observabilityService, SpanType, FindingType } from '../services/observability.service'
import { logger } from '../services/logger.service'

const router = Router()

/**
 * GET /api/observability/runs
 * Lists observed agent execution runs
 */
router.get('/runs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const status = req.query.status as string
    const role = req.query.role as string

    const runs = observabilityService.listRuns({ limit, status, role })
    res.json({
      success: true,
      runs,
      total: runs.length
    })
  } catch (err: any) {
    logger.error(`[ObservabilityRouter] Failed to list runs: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/runs/:id
 * Fetches full timeline, hierarchical spans, logs, errors, and findings for a run
 */
router.get('/runs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = observabilityService.getRun(id)

    if (!data.run) {
      return res.status(404).json({ success: false, error: `Run '${id}' not found` })
    }

    res.json({
      success: true,
      ...data
    })
  } catch (err: any) {
    logger.error(`[ObservabilityRouter] Failed to get run ${req.params.id}: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/observability/runs
 * Starts observing a new agent session
 */
router.post('/runs', (req: Request, res: Response) => {
  try {
    const { runId, tenantId, agentId, agentRole, teamId, teamName, missionGoal, metadata } = req.body
    const run = observabilityService.startRun({
      runId,
      tenantId,
      agentId,
      agentRole: agentRole || 'general_agent',
      teamId,
      teamName,
      missionGoal: missionGoal || 'Autonomous task',
      metadata
    })
    res.json({ success: true, run })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/errors
 * Returns error records aggregated and grouped by signature
 */
router.get('/errors', (req: Request, res: Response) => {
  try {
    const groups = observabilityService.getErrorsGroupedBySignature()
    res.json({
      success: true,
      groups,
      total: groups.length
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/errors/:signature
 * Returns detailed occurrences and all affected runs for an error signature
 */
router.get('/errors/:signature', (req: Request, res: Response) => {
  try {
    const { signature } = req.params
    const detail = observabilityService.getErrorDetail(signature)

    if (!detail.group) {
      return res.status(404).json({ success: false, error: `Error signature '${signature}' not found` })
    }

    res.json({
      success: true,
      ...detail
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/findings
 * Returns live deterministic detection findings feed
 */
router.get('/findings', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const findings = observabilityService.listFindings(limit)
    res.json({
      success: true,
      findings,
      total: findings.length
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/config
 * Retrieves or updates detection thresholds
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    config: observabilityService.getThresholds()
  })
})

router.post('/config', (req: Request, res: Response) => {
  try {
    const updated = observabilityService.updateThresholds(req.body)
    res.json({
      success: true,
      config: updated
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/observability/stream
 * Server-Sent Events stream for live runs, spans, errors, and findings
 */
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`)
  }

  // Initial connection heartbeat
  sendEvent('connected', { status: 'ok', serverTime: new Date().toISOString() })

  const onRunUpdate = (run: any) => sendEvent('run_update', run)
  const onSpanUpdate = (span: any) => sendEvent('span_update', span)
  const onLogEntry = (log: any) => sendEvent('log_entry', log)
  const onErrorEntry = (err: any) => sendEvent('error_entry', err)
  const onFindingEntry = (finding: any) => sendEvent('finding_entry', finding)

  observabilityService.on('run_update', onRunUpdate)
  observabilityService.on('span_update', onSpanUpdate)
  observabilityService.on('log_entry', onLogEntry)
  observabilityService.on('error_entry', onErrorEntry)
  observabilityService.on('finding_entry', onFindingEntry)

  req.on('close', () => {
    observabilityService.off('run_update', onRunUpdate)
    observabilityService.off('span_update', onSpanUpdate)
    observabilityService.off('log_entry', onLogEntry)
    observabilityService.off('error_entry', onErrorEntry)
    observabilityService.off('finding_entry', onFindingEntry)
  })
})

/**
 * POST /api/observability/otlp/v1/traces
 * OpenTelemetry standard OTLP JSON trace ingest endpoint
 */
router.post('/otlp/v1/traces', (req: Request, res: Response) => {
  try {
    const { resourceSpans } = req.body || {}

    if (Array.isArray(resourceSpans)) {
      for (const rs of resourceSpans) {
        const serviceName = rs.resource?.attributes?.find((a: any) => a.key === 'service.name')?.value || 'agent'

        for (const ss of rs.scopeSpans || []) {
          for (const sp of ss.spans || []) {
            const runIdAttr = sp.attributes?.find((a: any) => a.key === 'chatbolt.run_id')?.value
            const spanTypeAttr = sp.attributes?.find((a: any) => a.key === 'chatbolt.span_type')?.value || 'tool'
            const runId = runIdAttr || `run_${(sp.traceId || 'trace').substring(0, 8)}`

            const startMs = sp.startTimeUnixNano ? Math.round(sp.startTimeUnixNano / 1e6) : Date.now()
            const endMs = sp.endTimeUnixNano ? Math.round(sp.endTimeUnixNano / 1e6) : Date.now()

            const span = observabilityService.startSpan({
              runId,
              parentId: sp.parentSpanId || undefined,
              name: sp.name || 'unnamed_span',
              type: spanTypeAttr as SpanType,
              metadata: {
                traceId: sp.traceId,
                serviceName,
                ...sp.attributes?.reduce((acc: any, curr: any) => {
                  acc[curr.key] = curr.value
                  return acc
                }, {})
              }
            })

            observabilityService.endSpan(span.id, {
              status: sp.status?.code === 2 ? 'error' : 'ok',
              error: sp.status?.message
            })
          }
        }
      }
    }

    res.json({ status: 'success', received: true })
  } catch (err: any) {
    logger.error(`[OTLP Ingest] Error: ${err.message}`)
    res.status(400).json({ error: err.message })
  }
})

export default router
