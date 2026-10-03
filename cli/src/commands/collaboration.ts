import { ChatboltClient } from '../client'

export interface CollaborationCliOptions {
  action: 'chatter' | 'timeline' | 'handoff' | 'escalate' | 'resolve' | 'standup' | 'clarify'
  teamId?: string
  runId?: string
  fromRole?: string
  toRole?: string
  summary?: string
  blocker?: string
  decision?: string
  escalationId?: string
  resolution?: string
  headline?: string
  progress?: number
  question?: string
  answer?: string
  conversationId?: string
  limit?: number
  json?: boolean
}

export async function collaborationCommand(
  options: CollaborationCliOptions,
  client: ChatboltClient = new ChatboltClient()
): Promise<any> {
  const {
    action,
    teamId,
    runId,
    fromRole,
    toRole,
    summary,
    blocker,
    decision,
    escalationId,
    resolution,
    headline,
    progress = 50,
    question,
    answer,
    conversationId,
    limit = 20,
    json,
  } = options

  try {
    if (action === 'chatter') {
      const targetTeam = teamId || 'marketing_team'
      const res = await client.request('GET', `/api/collaboration/teams/${targetTeam}/live?limit=${limit}`)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const messages = res.data.messages || []
      console.log(`\n💬 Live Inter-Agent Group Chat [Team: ${targetTeam}] (${messages.length} Events)`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      for (const m of messages) {
        const timeStr = new Date(m.timestamp).toLocaleTimeString()
        const badge =
          m.type === 'handoff'
            ? '\x1b[32m[HANDOFF]\x1b[0m'
            : m.type === 'escalation'
            ? '\x1b[31m[ESCALATION]\x1b[0m'
            : m.type === 'standup'
            ? '\x1b[36m[STANDUP]\x1b[0m'
            : '\x1b[33m[Q&A]\x1b[0m'

        console.log(`[${timeStr}] ${badge} @${m.sender} ➔ @${m.recipient}: ${m.title}`)
        if (m.type === 'handoff') {
          console.log(`   📝 Work Summary: "${m.data.summaryOfWorkDone}"`)
          if (m.data.artifactsProduced?.length) {
            console.log(`   📦 Artifacts: ${m.data.artifactsProduced.map((a: any) => a.name).join(', ')}`)
          }
        } else if (m.type === 'escalation') {
          console.log(`   ⚠️ Blocker: "${m.data.blockerReason}"`)
          console.log(`   ❓ Decision Needed: "${m.data.requiredDecision}"`)
        }
      }
      console.log(`═══════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    if (action === 'timeline') {
      if (!runId) throw new Error('runId is required. Example: chatbolt team timeline --run <runId>')
      const res = await client.request('GET', `/api/collaboration/runs/${runId}/timeline`)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      console.log(`\n🗺️  Structured Collaboration Timeline [Run: ${runId}]`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`🤝 Handoffs (${res.data.handoffs?.length || 0}):`)
      for (const h of res.data.handoffs || []) {
        console.log(`  • @${h.fromRole} ➔ @${h.toRole}: "${h.summaryOfWorkDone}" (${h.artifactsProduced?.length || 0} artifacts)`)
      }

      console.log(`\n⚠️ Escalations (${res.data.escalations?.length || 0}):`)
      for (const e of res.data.escalations || []) {
        const statusColor = e.status === 'resolved' ? '\x1b[32mRESOLVED\x1b[0m' : '\x1b[31mPENDING\x1b[0m'
        console.log(`  • [${statusColor}] @${e.fromRole} ➔ @${e.escalationTarget}: "${e.blockerReason}"`)
      }

      console.log(`\n📊 Standup Reports (${res.data.standups?.length || 0}):`)
      for (const s of res.data.standups || []) {
        console.log(`  • @${s.teamLeadRole}: "${s.summaryHeadline}" (${s.estimatedProgressPercent}% Complete)`)
      }
      console.log(`═══════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    if (action === 'handoff') {
      if (!runId || !fromRole || !toRole || !summary) {
        throw new Error('runId, fromRole, toRole, and summary are required for handoff')
      }

      const res = await client.request('POST', `/api/collaboration/runs/${runId}/handoff`, {
        teamId: teamId || 'default_team',
        fromRole,
        toRole,
        summaryOfWorkDone: summary,
        keyContextForReceiver: { note: summary },
        artifactsProduced: [],
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      console.log(`\n✅ Handoff Completed: @${fromRole} ➔ @${toRole}`)
      console.log(`  Handoff ID:         ${res.data.handoff.handoffId}`)
      console.log(`  Logged to Replay:   Yes\n`)
      return res.data
    }

    if (action === 'escalate') {
      if (!runId || !fromRole || !blocker) {
        throw new Error('runId, fromRole, and blocker are required for escalation')
      }

      const res = await client.request('POST', `/api/collaboration/runs/${runId}/escalate`, {
        teamId: teamId || 'default_team',
        fromRole,
        escalationTarget: toRole || 'team_lead',
        blockerReason: blocker,
        attemptedApproaches: ['Direct execution failed'],
        requiredDecision: decision || 'Please review blocker and advise next action',
        urgency: 'high',
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      console.log(`\n⚠️ Escalation Submitted to ${res.data.escalation.escalationTarget}`)
      console.log(`  Escalation ID:      ${res.data.escalation.escalationId}`)
      console.log(`  Blocker:            ${res.data.escalation.blockerReason}`)
      console.log(`  Status:             PENDING\n`)
      return res.data
    }

    if (action === 'standup') {
      if (!runId || !headline) {
        throw new Error('runId and headline are required for standup')
      }

      const res = await client.request('POST', `/api/collaboration/runs/${runId}/standup`, {
        teamId: teamId || 'default_team',
        teamLeadRole: fromRole || 'team_lead',
        summaryHeadline: headline,
        whatIsDone: ['Core task milestones completed'],
        whatIsInProgress: [{ role: 'developer', task: 'Implementation' }],
        whatIsBlocked: [],
        estimatedProgressPercent: progress,
      })

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      console.log(`\n📊 Team Standup Broadcasted`)
      console.log(`  Headline:           ${res.data.standup.summaryHeadline}`)
      console.log(`  Progress:           ${res.data.standup.estimatedProgressPercent}%\n`)
      return res.data
    }

    throw new Error(`Unknown collaboration action '${action}'`)
  } catch (err: any) {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`)
    if (json) {
      return { success: false, error: err.message }
    }
    throw err
  }
}
