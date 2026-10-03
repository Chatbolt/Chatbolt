import assert from 'assert'
import express from 'express'
import { agentCollaborationService } from '../services/agent-collaboration.service'
import { agentBus } from '../runtime/agent-bus.service'
import { sessionReplayService } from '../services/session-replay.service'
import collaborationRoutes from '../routes/collaboration'

async function runAgentCollaborationTests() {
  console.log('🤝 Starting Agent Collaboration, Handoff & Escalation Test Suite...\n')
  let passed = 0
  let total = 5

  agentCollaborationService.clearHistory()
  agentBus.clearHistory()

  const RUN_ID = `run_collab_${Date.now()}`
  const TEAM_ID = 'team_growth_collab_01'

  // =========================================================================
  // Item 1: Structured "Handoff" Protocol
  // =========================================================================
  console.log('Testing Item 1: Structured handoff protocol with context and artifacts...')

  let receivedHandoffBusMsg: any = null
  const unsubHandoff = agentBus.subscribe(`team:${TEAM_ID}`, (msg) => {
    if (msg.payload?.eventType === 'AGENT_HANDOFF') {
      receivedHandoffBusMsg = msg.payload.handoff
    }
  })

  const handoffRes = await agentCollaborationService.performHandoff({
    runId: RUN_ID,
    teamId: TEAM_ID,
    fromRole: 'developer',
    toRole: 'writer',
    summaryOfWorkDone: 'Implemented OAuth2 PKCE authorization flow with refresh token rotation.',
    keyContextForReceiver: {
      authEndpoint: '/auth/pkce/token',
      supportedProviders: ['github', 'google', 'gitlab'],
      breakingChange: false,
    },
    artifactsProduced: [
      { name: 'oauth_pkce.ts', type: 'code', pathOrUrl: 'src/auth/oauth_pkce.ts' },
      { name: 'swagger_auth.json', type: 'schema', pathOrUrl: 'docs/swagger_auth.json' }
    ],
    openQuestions: ['Does the marketing landing page mention GitLab SSO availability?'],
  })

  assert.ok(handoffRes.handoffId, 'Handoff must have a unique ID')
  assert.strictEqual(handoffRes.fromRole, 'developer')
  assert.strictEqual(handoffRes.toRole, 'writer')
  assert.strictEqual(handoffRes.artifactsProduced.length, 2, 'Must include 2 artifacts')
  assert.ok(receivedHandoffBusMsg, 'Handoff must be published to AgentBus')
  assert.strictEqual(receivedHandoffBusMsg.handoffId, handoffRes.handoffId)

  // Verify Session Replay records the handoff
  const replay = await sessionReplayService.getReplay(RUN_ID)
  assert.ok(replay, 'Replay record must exist for run')
  const handoffStep = replay.timeline.find((s) => s.actionType === ('agent_handoff' as any))
  assert.ok(handoffStep, 'Session replay must contain agent_handoff step')
  assert.ok(handoffStep.toolInput.summaryOfWorkDone.includes('OAuth2 PKCE'), 'Replay must preserve work summary')

  unsubHandoff()
  console.log('  ✅ PASS: Item 1: Structured handoff protocol logs context, artifacts, and open questions to Replay and AgentBus')
  passed++

  // =========================================================================
  // Item 2: Formal "Escalation" Pattern Distinct from Failure
  // =========================================================================
  console.log('\nTesting Item 2: Formal escalation pattern to TeamLead/Human with blocker rationale...')

  let receivedSupervisorAlert: any = null
  const unsubSupervisor = agentBus.subscribe(`team:${TEAM_ID}:supervisor`, (msg) => {
    if (msg.payload?.eventType === 'AGENT_ESCALATION') {
      receivedSupervisorAlert = msg.payload.escalation
    }
  })

  const escalationRes = await agentCollaborationService.escalateIssue({
    runId: RUN_ID,
    teamId: TEAM_ID,
    fromRole: 'sre_engineer',
    escalationTarget: 'team_lead',
    blockerReason: 'Database migration requires schema lock exceeding 500ms in production cluster.',
    attemptedApproaches: [
      'Executed concurrent index creation (failed due to existing unique constraint violation)',
      'Attempted read replica offloading (replica lag spiked to 4.2s)'
    ],
    requiredDecision: 'Approve 2-minute maintenance window at 02:00 UTC or alter table in batches of 5,000 rows.',
    urgency: 'critical',
  })

  assert.ok(escalationRes.escalationId, 'Escalation must generate ID')
  assert.strictEqual(escalationRes.status, 'pending')
  assert.strictEqual(escalationRes.urgency, 'critical')
  assert.ok(receivedSupervisorAlert, 'Supervisor channel must receive escalation alert')

  // Verify resolution
  const resolved = agentCollaborationService.resolveEscalation(
    RUN_ID,
    escalationRes.escalationId,
    'Approved batch alterations of 5,000 rows without maintenance downtime.',
    'human_supervisor_lead'
  )
  assert.ok(resolved, 'Escalation must be resolvable')
  assert.strictEqual(resolved?.status, 'resolved')
  assert.ok(resolved?.resolution?.includes('Approved batch alterations'), 'Resolution must be recorded')

  unsubSupervisor()
  console.log('  ✅ PASS: Item 2: Formal escalation pattern enables structured ask-for-help with decision rationale')
  passed++

  // =========================================================================
  // Item 3: Lightweight "Standup" Pattern for Long-Running Missions
  // =========================================================================
  console.log('\nTesting Item 3: Lightweight standup summary pattern across role agents...')

  const standupRes = await agentCollaborationService.generateStandupSummary({
    runId: RUN_ID,
    teamId: TEAM_ID,
    teamLeadRole: 'team_lead',
    summaryHeadline: 'Sprint Goal 75% Complete: Auth & API Endpoints Deployed, Copywriting in Progress',
    whatIsDone: [
      'Backend OAuth2 PKCE engine implemented (@developer)',
      'Database batch migration executed with zero downtime (@sre_engineer)'
    ],
    whatIsInProgress: [
      { role: 'writer', task: 'Product Changelog and Announcement Copy', progressPercent: 60 },
      { role: 'seo_specialist', task: 'OpenGraph and Schema Metadata Audit', progressPercent: 40 }
    ],
    whatIsBlocked: [],
    estimatedProgressPercent: 75,
  })

  assert.ok(standupRes.standupId, 'Standup report must have ID')
  assert.strictEqual(standupRes.estimatedProgressPercent, 75)
  assert.strictEqual(standupRes.whatIsDone.length, 2)
  assert.strictEqual(standupRes.whatIsInProgress.length, 2)

  // Verify standup is logged to Replay
  const updatedReplay = await sessionReplayService.getReplay(RUN_ID)
  const standupStep = updatedReplay?.timeline.find((s) => s.actionType === ('team_standup' as any))
  assert.ok(standupStep, 'Replay must contain team_standup step')
  assert.strictEqual(standupStep?.toolInput.progressPercent, 75)

  console.log('  ✅ PASS: Item 3: TeamLead periodic standup digests multi-agent status into human-readable summary')
  passed++

  // =========================================================================
  // Item 4: Inter-Agent Clarifying Q&A with Strict Loop Protection
  // =========================================================================
  console.log('\nTesting Item 4: Inter-agent clarifying Q&A with turn limits and anti-loop auto-escalation...')

  const QA_RUN = `run_qa_${Date.now()}`
  const THREAD_KEY = `thread_${QA_RUN}_qa_test`

  // Round 1: Writer asks Developer
  const q1 = await agentCollaborationService.askClarification({
    runId: QA_RUN,
    teamId: TEAM_ID,
    handoffId: THREAD_KEY,
    fromRole: 'writer',
    toRole: 'developer',
    question: 'Should we highlight GitLab SSO in the headline or the bullet points?',
    maxRounds: 3,
  })
  assert.strictEqual(q1.escalated, false, 'Round 1 must not escalate')
  assert.strictEqual(q1.exchange.currentRound, 1)

  // Developer answers
  await agentCollaborationService.respondClarification({
    conversationId: THREAD_KEY,
    fromRole: 'developer',
    answer: 'Highlight Google and GitHub in the headline; mention GitLab in the integration list.',
  })

  // Round 2: Writer asks follow-up
  const q2 = await agentCollaborationService.askClarification({
    runId: QA_RUN,
    teamId: TEAM_ID,
    handoffId: THREAD_KEY,
    fromRole: 'writer',
    toRole: 'developer',
    question: 'Is Enterprise SAML ready as well or coming in next release?',
    maxRounds: 3,
  })
  assert.strictEqual(q2.escalated, false, 'Round 2 must not escalate')
  assert.strictEqual(q2.exchange.currentRound, 2)

  // Round 3: Writer asks another follow-up
  const q3 = await agentCollaborationService.askClarification({
    runId: QA_RUN,
    teamId: TEAM_ID,
    handoffId: THREAD_KEY,
    fromRole: 'writer',
    toRole: 'developer',
    question: 'What about custom OIDC claims?',
    maxRounds: 3,
  })
  assert.strictEqual(q3.escalated, false, 'Round 3 reaches max limit')
  assert.strictEqual(q3.exchange.currentRound, 3)

  // Round 4: Loop Protection Triggered! (currentRound > maxRounds)
  const q4 = await agentCollaborationService.askClarification({
    runId: QA_RUN,
    teamId: TEAM_ID,
    handoffId: THREAD_KEY,
    fromRole: 'writer',
    toRole: 'developer',
    question: 'Can you give me a list of all 40 claims?',
    maxRounds: 3,
  })
  assert.strictEqual(q4.escalated, true, 'Round 4 must trigger loop protection escalation')
  assert.strictEqual(q4.exchange.status, 'escalated_due_to_loop')
  assert.ok(q4.escalation, 'Auto-escalation record must be generated')
  assert.strictEqual(q4.escalation?.escalationTarget, 'team_lead')
  assert.ok(q4.escalation?.blockerReason.includes('3 clarification rounds'), 'Blocker must cite round limit')

  console.log('  ✅ PASS: Item 4: Inter-agent Q&A resolves ambiguities and auto-escalates on loop threshold')
  passed++

  // =========================================================================
  // Item 5: Live Group Chat & Timeline REST APIs
  // =========================================================================
  console.log('\nTesting Item 5: Live team group chat and timeline REST endpoints...')

  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    (req as any).tenant = { id: '00000000-0000-0000-0000-000000000000' }
    ;(req as any).tenantId = '00000000-0000-0000-0000-000000000000'
    ;(req as any).user = { id: 'test_user_collab' }
    next()
  })
  app.use('/api/collaboration', collaborationRoutes)

  const server = app.listen(0)
  const port = (server.address() as any).port

  const jwt = await import('jsonwebtoken')
  const testToken = jwt.default.sign(
    { sub: '00000000-0000-0000-0000-000000000000', email: 'dev@chatbolt.ai' },
    process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
  )

  try {
    // 1. Live team chatter feed
    const chatRes = await fetch(`http://127.0.0.1:${port}/api/collaboration/teams/${TEAM_ID}/live`, {
      headers: { authorization: `Bearer ${testToken}` }
    })
    assert.strictEqual(chatRes.status, 200, 'Live team chatter route must return 200')
    const chatData = await chatRes.json()
    assert.strictEqual(chatData.success, true)
    assert.ok(chatData.messages.length >= 3, 'Must contain logged team messages (handoffs, escalations, standups)')

    // 2. Full run collaboration timeline
    const timeRes = await fetch(`http://127.0.0.1:${port}/api/collaboration/runs/${RUN_ID}/timeline`, {
      headers: { authorization: `Bearer ${testToken}` }
    })
    assert.strictEqual(timeRes.status, 200, 'Timeline route must return 200')
    const timeData = await timeRes.json()
    assert.strictEqual(timeData.success, true)
    assert.strictEqual(timeData.handoffs.length, 1, 'Must return 1 handoff')
    assert.strictEqual(timeData.escalations.length, 1, 'Must return 1 escalation')
    assert.strictEqual(timeData.standups.length, 1, 'Must return 1 standup')
  } finally {
    server.close()
  }

  console.log('  ✅ PASS: Item 5: Team dashboard and timeline REST endpoints surface live inter-agent coworker visibility')
  passed++

  console.log(`\n=============================================`)
  console.log(`Agent Collaboration Results: ${passed}/${total} Passed (100%)`)
  console.log(`=============================================\n`)
}

runAgentCollaborationTests().catch((err) => {
  console.error('Fatal Agent Collaboration Test Error:', err)
  process.exit(1)
})
