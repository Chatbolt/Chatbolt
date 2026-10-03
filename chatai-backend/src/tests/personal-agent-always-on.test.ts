import assert from 'assert'
import { personalAgentSchedulerService } from '../services/personal-agent-scheduler.service'
import { personalAgentService } from '../services/personal-agent.service'
import { permissionSystemService } from '../services/permission-system.service'

async function runAlwaysOnTests() {
  console.log('⏰ Running Always-On PersonalAgent Background Scheduling & Proactive Outreach Tests...')
  const testTenantId = `tenant_test_always_on_${Date.now()}`

  // 0. Ensure Agent Initialized
  const agent = await personalAgentService.getOrCreatePersonalAgent(testTenantId, 'Aria')
  assert.strictEqual(agent.name, 'Aria')
  console.log('  ✅ 0. PersonalAgent initialized for tenant')

  // 1. Test Recurring Checks and Event Watcher Trigger Creation
  const recurring = await personalAgentSchedulerService.createTrigger(testTenantId, {
    title: 'Morning Inbox & Agenda Brief',
    description: 'Check unread emails and outline morning priorities',
    triggerType: 'recurring_cron',
    scheduleCron: '0 8 * * 1-5',
    actionPayload: {
      taskType: 'workspace_brief',
      title: 'Morning Inbox Brief',
      prompt: 'Synthesize unread emails and draft urgent replies'
    }
  })

  assert.ok(recurring.id)
  assert.strictEqual(recurring.triggerType, 'recurring_cron')
  assert.strictEqual(recurring.status, 'active')

  const eventWatcher = await personalAgentSchedulerService.createTrigger(testTenantId, {
    title: 'Pre-Meeting Context Dossier',
    description: 'Watches Google Calendar for meetings starting in 60 mins',
    triggerType: 'event_watcher',
    eventPattern: {
      source: 'google_calendar',
      eventType: 'meeting_upcoming',
      filter: { leadTimeMinutes: 60 }
    },
    actionPayload: {
      taskType: 'meeting_prep',
      title: 'Meeting Dossier',
      prompt: 'Extract attendee history and open deliverables'
    }
  })

  assert.ok(eventWatcher.id)
  assert.strictEqual(eventWatcher.triggerType, 'event_watcher')

  const triggers = await personalAgentSchedulerService.listTriggers(testTenantId)
  assert.ok(triggers.length >= 2, 'Expected at least 2 active triggers')
  console.log('  ✅ 1. Recurring cron schedule & Event watcher created successfully')

  // 2. Test Autonomy Gating on L1 Supervised (Side-Effect Action Requires Approval)
  const triggerWithSideEffect = await personalAgentSchedulerService.createTrigger(testTenantId, {
    title: 'Customer Followup Draft',
    triggerType: 'recurring_cron',
    actionPayload: {
      taskType: 'email_summary',
      title: 'VIP Client Response',
      prompt: 'Check VIP inbox and send drafted acknowledgment',
      intendedSideEffects: [
        {
          type: 'send_email',
          recipient: 'vip-client@enterprise.com',
          preview: 'Follow-up regarding Enterprise SLA',
          riskLevel: 'medium'
        }
      ]
    }
  })

  const runWithSideEffect = await personalAgentSchedulerService.executeTriggerTask(triggerWithSideEffect, {
    triggeredBy: 'manual_or_schedule'
  })

  assert.strictEqual(runWithSideEffect.status, 'waiting_approval')
  assert.strictEqual(runWithSideEffect.requiresApproval, true)
  assert.strictEqual(runWithSideEffect.approvalStatus, 'pending')
  assert.ok(runWithSideEffect.approvalId)
  console.log('  ✅ 2. L1 Supervised Autonomy Gate successfully held side-effect for user approval')

  // 3. Test Human-in-the-Loop Approval & Trust Building
  const digestBeforeApprove = await personalAgentSchedulerService.getExecutiveDigest(testTenantId, '24h')
  assert.ok(digestBeforeApprove.pendingApprovals.length >= 1)
  const approvalItem = digestBeforeApprove.pendingApprovals[0]

  const approvalResult = await personalAgentSchedulerService.approvePendingAction(
    approvalItem.id,
    testTenantId,
    'Verified by user: approve email dispatch.'
  )

  assert.strictEqual(approvalResult.success, true)
  assert.strictEqual(approvalResult.approval.status, 'approved')
  assert.strictEqual(approvalResult.run?.status, 'action_approved')

  const digestAfterApprove = await personalAgentSchedulerService.getExecutiveDigest(testTenantId, '24h')
  assert.strictEqual(digestAfterApprove.pendingApprovals.length, 0)
  console.log('  ✅ 3. Human approval executed action and cleared pending approval queue')

  // 4. Test Event-Triggered Watcher Execution
  const eventResult = await personalAgentSchedulerService.handleIncomingIntegrationEvent(
    testTenantId,
    'google_calendar',
    'meeting_upcoming',
    { title: 'Sprint Review & Architecture Sync', attendees: ['alice@chatbolt.io', 'bob@chatbolt.io'] }
  )

  assert.strictEqual(eventResult.matchedCount, 1)
  assert.strictEqual(eventResult.triggeredRuns.length, 1)
  assert.strictEqual(eventResult.triggeredRuns[0].status, 'completed')
  assert.ok(eventResult.triggeredRuns[0].executiveSummary.includes('Sprint Review'))
  console.log('  ✅ 4. Event watcher intercepted Calendar event and generated context brief')

  // 5. Test Executive Digest View ("What did my assistant do while I was away")
  const executiveDigest = await personalAgentSchedulerService.getExecutiveDigest(testTenantId, '24h')
  assert.strictEqual(executiveDigest.tenantId, testTenantId)
  assert.ok(executiveDigest.metrics.totalRuns >= 2)
  assert.ok(executiveDigest.metrics.completedRuns >= 2)
  assert.ok(executiveDigest.metrics.estimatedMinutesSaved > 0)
  assert.ok(executiveDigest.timeline.length >= 2)
  assert.ok(executiveDigest.executiveNarrative.length > 10)
  console.log(`  ✅ 5. Executive Digest compiled: ${executiveDigest.metrics.completedRuns} runs, ~${executiveDigest.metrics.estimatedMinutesSaved} mins saved`)

  // 6. Test Multi-Day Simulation for Long-term Reliability
  const multiDaySim = await personalAgentSchedulerService.simulateMultiDayScenario(testTenantId, 3)
  assert.strictEqual(multiDaySim.daysSimulated, 3)
  assert.strictEqual(multiDaySim.totalRunsGenerated, 6)

  const multiDayDigest = await personalAgentSchedulerService.getExecutiveDigest(testTenantId, '7d')
  assert.ok(multiDayDigest.timeline.length >= 6)
  assert.ok(multiDayDigest.metrics.totalRuns >= 6)
  console.log('  ✅ 6. Multi-day simulation passed: 6 consecutive background runs verified')

  console.log('\n🎉 ALL ALWAYS-ON BACKGROUND SCHEDULING TESTS PASSED!')
}

runAlwaysOnTests().catch(err => {
  console.error('❌ Always-On Test Failed:', err)
  process.exit(1)
})
