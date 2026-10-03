import { ChatboltClient } from '../client'

export interface RunsListOptions {
  limit?: number
  status?: string
  role?: string
  json?: boolean
}

export interface RunInspectOptions {
  runId: string
  json?: boolean
}

export interface ErrorsListOptions {
  signature?: string
  json?: boolean
}

export async function runsListCommand(options: RunsListOptions = {}, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { limit = 20, status, role, json } = options

  try {
    let url = `/api/observability/runs?limit=${limit}`
    if (status) url += `&status=${encodeURIComponent(status)}`
    if (role) url += `&role=${encodeURIComponent(role)}`

    const res = await client.request('GET', url)
    if (res.status >= 400 || !res.data?.success) {
      const msg = res.data?.error || `HTTP ${res.status}`
      if (json) console.log(JSON.stringify({ error: msg }))
      else console.error(`Failed to list runs: ${msg}`)
      return { error: msg }
    }

    const runs = res.data.runs || []
    if (json) {
      console.log(JSON.stringify(runs, null, 2))
      return runs
    }

    console.log(`\n📊  Agent Execution Runs (${runs.length})`)
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════`)
    console.log(`  ${'RUN ID'.padEnd(20)} ${'ROLE'.padEnd(16)} ${'STATUS'.padEnd(12)} ${'DURATION'.padEnd(10)} ${'TOKENS'.padEnd(10)} ${'COST (USD)'.padEnd(12)} GOAL`)
    console.log(`──────────────────────────────────────────────────────────────────────────────────────────`)

    for (const r of runs) {
      const dur = `${(r.durationMs / 1000).toFixed(1)}s`
      const cost = `$${Number(r.totalCostUSD || 0).toFixed(4)}`
      const goal = (r.missionGoal || '').slice(0, 30)
      const statusColored = r.status === 'completed' ? `\x1b[32m${r.status}\x1b[0m` :
                            r.status === 'failed' ? `\x1b[31m${r.status}\x1b[0m` :
                            r.status === 'stuck' ? `\x1b[33m${r.status}\x1b[0m` : r.status

      console.log(`  ${r.id.padEnd(20)} ${r.agentRole.padEnd(16)} ${statusColored.padEnd(20)} ${dur.padEnd(10)} ${String(r.totalTokens || 0).padEnd(10)} ${cost.padEnd(12)} ${goal}`)
    }
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════\n`)
    return runs
  } catch (err: any) {
    if (json) console.log(JSON.stringify({ error: err.message }))
    else console.error(`Error: ${err.message}`)
    return { error: err.message }
  }
}

export async function runInspectCommand(options: RunInspectOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { runId, json } = options

  if (!runId) {
    console.error('Error: Run ID is required. Example: chatbolt runs inspect run_123')
    return { error: 'Run ID required' }
  }

  try {
    const res = await client.request('GET', `/api/observability/runs/${runId}`)
    if (res.status >= 400 || !res.data?.success) {
      const msg = res.data?.error || `HTTP ${res.status}`
      if (json) console.log(JSON.stringify({ error: msg }))
      else console.error(`Failed to inspect run '${runId}': ${msg}`)
      return { error: msg }
    }

    if (json) {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    const { run, spans = [], logs = [], findings = [], errors = [] } = res.data

    console.log(`\n🔍  Run Timeline Inspector: ${run.id}`)
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════`)
    console.log(`  Role:           ${run.agentRole}`)
    console.log(`  Status:         ${run.status.toUpperCase()}`)
    console.log(`  Mission Goal:   ${run.missionGoal}`)
    console.log(`  Duration:       ${(run.durationMs / 1000).toFixed(2)}s`)
    console.log(`  Tokens / Cost:  ${run.totalTokens} tokens ($${Number(run.totalCostUSD || 0).toFixed(4)} USD)`)
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════\n`)

    if (findings.length > 0) {
      console.log(`🚨 Diagnostic Findings (${findings.length}):`)
      for (const f of findings) {
        const sev = f.severity === 'critical' ? `\x1b[31m[CRITICAL]\x1b[0m` :
                    f.severity === 'high' ? `\x1b[33m[HIGH]\x1b[0m` : `[${f.severity.toUpperCase()}]`
        console.log(`  ${sev} ${f.type}: ${f.message}`)
        if (f.actionTaken && f.actionTaken !== 'none') {
          console.log(`     ↳ Action Executed: \x1b[36m${f.actionTaken}\x1b[0m`)
        }
      }
      console.log(``)
    }

    console.log(`⏱️  Execution Spans (${spans.length}):`)
    for (let i = 0; i < spans.length; i++) {
      const sp = spans[i]
      const statusIcon = sp.status === 'ok' ? '✓' : sp.status === 'error' ? '✗' : '⋯'
      const indent = sp.parentId ? '    ↳ ' : '  • '
      const dur = `${sp.durationMs}ms`
      console.log(`${indent}[${sp.type.toUpperCase()}] ${sp.name} (${dur}) [${statusIcon}]`)
      if (sp.errorMessage) {
        console.log(`      \x1b[31mError: ${sp.errorMessage}\x1b[0m`)
      }
    }
    console.log(``)

    if (logs.length > 0) {
      console.log(`📜 Structured Logs (${logs.length}):`)
      for (const l of logs.slice(-10)) {
        console.log(`  [${l.level.toUpperCase()}] ${l.message}`)
      }
      console.log(``)
    }

    return res.data
  } catch (err: any) {
    if (json) console.log(JSON.stringify({ error: err.message }))
    else console.error(`Error: ${err.message}`)
    return { error: err.message }
  }
}

export async function errorsListCommand(options: ErrorsListOptions = {}, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { signature, json } = options

  try {
    const url = signature ? `/api/observability/errors/${signature}` : `/api/observability/errors`
    const res = await client.request('GET', url)

    if (res.status >= 400 || !res.data?.success) {
      const msg = res.data?.error || `HTTP ${res.status}`
      if (json) console.log(JSON.stringify({ error: msg }))
      else console.error(`Failed to fetch errors: ${msg}`)
      return { error: msg }
    }

    if (json) {
      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    if (signature) {
      const { group, occurrences = [], affectedRuns = [] } = res.data
      console.log(`\n⚠️  Error Signature Detail: ${group.signature}`)
      console.log(`══════════════════════════════════════════════════════════════════════════════════════════`)
      console.log(`  Type:           ${group.type}`)
      console.log(`  Message:        ${group.sampleMessage}`)
      console.log(`  Occurrences:    ${group.count}`)
      console.log(`  First Seen:     ${group.firstSeenAt}`)
      console.log(`  Last Seen:      ${group.lastSeenAt}`)
      console.log(`  Agents:         ${group.affectedAgents.join(', ')}`)
      console.log(`  Affected Runs:  ${group.affectedRunIds.join(', ')}`)
      console.log(`══════════════════════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    const groups = res.data.groups || []
    console.log(`\n⚠️  Errors Grouped by Signature (${groups.length})`)
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════`)
    console.log(`  ${'SIGNATURE'.padEnd(16)} ${'COUNT'.padEnd(8)} ${'TYPE'.padEnd(20)} ${'AGENTS'.padEnd(20)} MESSAGE`)
    console.log(`──────────────────────────────────────────────────────────────────────────────────────────`)

    for (const g of groups) {
      const agents = (g.affectedAgents || []).join(', ').slice(0, 18)
      const msg = (g.sampleMessage || '').slice(0, 40)
      console.log(`  ${g.signature.padEnd(16)} ${String(g.count).padEnd(8)} ${g.type.padEnd(20)} ${agents.padEnd(20)} ${msg}`)
    }
    console.log(`══════════════════════════════════════════════════════════════════════════════════════════\n`)
    return groups
  } catch (err: any) {
    if (json) console.log(JSON.stringify({ error: err.message }))
    else console.error(`Error: ${err.message}`)
    return { error: err.message }
  }
}
