import assert from 'assert'
import { observabilityService } from '../services/observability.service'

async function runObservabilityTests() {
  console.log('🚀 Running Observability Service & Detection Rules Tests...')

  // 1. Test Run Lifecycle and Spans
  const run = observabilityService.startRun({
    runId: 'test_run_obs_1',
    agentRole: 'code_reviewer',
    missionGoal: 'Review PR and check vulnerability',
    metadata: { env: 'ci' }
  })
  assert.strictEqual(run.id, 'test_run_obs_1')
  assert.strictEqual(run.status, 'running')

  const span1 = observabilityService.startSpan({
    runId: run.id,
    name: 'fetch_git_diff',
    type: 'tool',
    input: { pr: 104 }
  })

  observabilityService.recordLog({
    runId: run.id,
    spanId: span1.id,
    level: 'info',
    message: 'Fetched 4 changed files'
  })

  observabilityService.endSpan(span1.id, {
    status: 'ok',
    output: { files: 4, additions: 120 }
  })

  observabilityService.endRun(run.id, {
    status: 'completed',
    promptTokens: 800,
    completionTokens: 250,
    costUSD: 0.0054
  })

  const runData = observabilityService.getRun(run.id)
  assert.strictEqual(runData.run?.status, 'completed')
  assert.strictEqual(runData.run?.totalTokens, 1050)
  assert.strictEqual(runData.spans.length, 1)
  assert.strictEqual(runData.logs.length, 1)
  console.log('  ✅ Run lifecycle and span recording verified')

  // 2. Failure Injection Test: Deterministic Loop Detection
  const loopRunId = 'test_run_loop_fail'
  observabilityService.startRun({
    runId: loopRunId,
    agentRole: 'looping_agent',
    missionGoal: 'Extract table data'
  })

  // Repeat A -> B -> A -> B
  for (let i = 0; i < 2; i++) {
    const sA = observabilityService.startSpan({
      runId: loopRunId,
      name: 'search_table',
      type: 'tool',
      input: { query: 'financials' }
    })
    observabilityService.endSpan(sA.id, { status: 'ok' })

    const sB = observabilityService.startSpan({
      runId: loopRunId,
      name: 'parse_html',
      type: 'tool',
      input: { element: 'table#1' }
    })
    observabilityService.endSpan(sB.id, { status: 'ok' })
  }

  const loopRunData = observabilityService.getRun(loopRunId)
  const loopFinding = loopRunData.findings.find(f => f.type === 'possible_loop')
  assert.ok(loopFinding, 'Expected possible_loop finding to be generated deterministically')
  assert.strictEqual(loopFinding?.severity, 'critical')
  console.log(`  ✅ Possible loop detected: "${loopFinding?.message}"`)

  // 3. Failure Injection Test: Repeated Tool Flailing
  const repToolRunId = 'test_run_rep_tool'
  observabilityService.startRun({
    runId: repToolRunId,
    agentRole: 'scraper',
    missionGoal: 'Download report'
  })

  // Invoke same tool 4 times (default threshold: 4)
  for (let i = 0; i < 4; i++) {
    const st = observabilityService.startSpan({
      runId: repToolRunId,
      name: 'download_pdf',
      type: 'tool',
      input: { attempt: i }
    })
    observabilityService.endSpan(st.id, { status: 'ok', output: '403 forbidden' })
  }

  const repToolData = observabilityService.getRun(repToolRunId)
  const repToolFinding = repToolData.findings.find(f => f.type === 'repeated_tool')
  assert.ok(repToolFinding, 'Expected repeated_tool finding')
  console.log(`  ✅ Repeated tool flailing detected: "${repToolFinding?.message}"`)

  // 4. Test Error Grouping by Signature
  observabilityService.recordError({
    runId: 'run_err_1',
    type: 'DatabaseTimeout',
    message: 'Connection pool exhausted after 30000ms',
    agentRole: 'backend_agent'
  })
  observabilityService.recordError({
    runId: 'run_err_2',
    type: 'DatabaseTimeout',
    message: 'Connection pool exhausted after 30000ms',
    agentRole: 'backend_agent'
  })
  observabilityService.recordError({
    runId: 'run_err_3',
    type: 'ValidationError',
    message: 'Invalid email format',
    agentRole: 'triage_agent'
  })

  const errorGroups = observabilityService.getErrorsGroupedBySignature()
  const dbGroup = errorGroups.find(g => g.type === 'DatabaseTimeout')
  assert.ok(dbGroup, 'Expected DatabaseTimeout group')
  assert.strictEqual(dbGroup?.count, 2)
  assert.strictEqual(dbGroup?.affectedRunIds.length, 2)
  console.log(`  ✅ Error signature grouped: ${dbGroup?.signature} (${dbGroup?.count} occurrences)`)

  console.log('🎉 All Observability unit & failure injection tests PASSED!')
}

runObservabilityTests().catch(err => {
  console.error('Test Failed:', err)
  process.exit(1)
})
