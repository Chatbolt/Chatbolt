import { decisionPatternLearningService } from '../services/decision-pattern-learning.service'
import { personalAgentService } from '../services/personal-agent.service'
import crypto from 'crypto'

async function runDecisionPatternLearningTests() {
  console.log('🚀 [Test] Starting Decision-Pattern Learning & Autonomy Gating Test Suite (Prompt 30)...\n')
  const testTenantId = `test-tenant-patterns-${crypto.randomUUID().slice(0, 8)}`

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
      failed++
    }
  }

  try {
    // ── TEST 1: Signal Ingestion across 5 Distinct Sources ──────────────
    console.log('--- Test Group 1: Multi-Source Signal Ingestion & Structuring ---')
    
    // 1. Permission approval
    const sig1 = await decisionPatternLearningService.recordSignal({
      tenantId: testTenantId,
      signalSource: 'permission_decision',
      domain: 'email_comms',
      contextSummary: 'Approved sending concise email update to team',
      userDecision: 'approved',
      timestamp: new Date().toISOString()
    })
    assert(sig1.domain === 'email_comms', 'Signal correctly classified under email_comms domain')
    assert(sig1.evidenceCount === 1, 'First observation recorded in evidence log')

    // 2. Edit Diff between proposed and accepted
    const sig2 = await decisionPatternLearningService.recordSignal({
      tenantId: testTenantId,
      signalSource: 'edit_diff',
      domain: 'email_comms',
      contextSummary: 'User shortened long draft by 40% before sending',
      userDecision: 'edited',
      diffDetails: {
        originalProposed: 'Dear team, I would like to formally announce that our project is on schedule.',
        userEdited: 'Team - project is on track.',
        diffRatio: 0.6
      },
      timestamp: new Date().toISOString()
    })
    assert(sig2.evidenceCount === 2, 'Diff edit ingested into pattern evidence log')
    const diffEvidence = sig2.evidenceLog.find(e => e.diffDetails) || sig2.evidenceLog[0]
    assert(Boolean(diffEvidence.diffDetails?.originalProposed), 'Original proposed text preserved in diff audit')
    assert(Boolean(diffEvidence.diffDetails?.userEdited), 'User accepted text preserved in diff audit')

    // 3. Option choice presented
    const sig3 = await decisionPatternLearningService.recordSignal({
      tenantId: testTenantId,
      signalSource: 'option_choice',
      domain: 'code_style',
      contextSummary: 'User selected TypeScript strict mode over standard JS',
      userDecision: 'chosen',
      chosenOption: 'TypeScript Strict Mode',
      optionsPresented: ['TypeScript Strict Mode', 'Standard JavaScript', 'Flow'],
      timestamp: new Date().toISOString()
    })
    assert(sig3.domain === 'code_style', 'Option choice captured in code_style domain')
    assert(sig3.evidenceLog[0].chosenOption === 'TypeScript Strict Mode', 'Chosen option recorded accurately')

    // ── TEST 2: Cold Start Honesty & Confidence Accumulation ───────────
    console.log('\n--- Test Group 2: Cold Start Protection & Scaling Confidence ---')
    const freshTenantId = `cold-start-user-${crypto.randomUUID().slice(0, 8)}`

    // Step A: Brand new user (0 observations)
    const gate0 = await decisionPatternLearningService.evaluateAutonomyGate(freshTenantId, {
      domain: 'scheduling',
      actionType: 'schedule_morning_sync',
      stakesLevel: 'low'
    })
    assert(!gate0.allowAutoExecute, 'Zero-history user does NOT auto-execute')
    assert(gate0.decisionCode === 'ASK_USER_COLD_START', 'Flags cold start explicitly')
    assert(gate0.rationale.includes('Still learning your preferences'), 'Honest user-facing cold start message displayed')

    // Step B: Record 1st, 2nd, and 3rd decisions (below 4 decision minimum)
    for (let i = 1; i <= 3; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: freshTenantId,
        signalSource: 'permission_decision',
        domain: 'scheduling',
        contextSummary: `Accepted 9:30 AM slot #${i}`,
        userDecision: 'approved'
      })
    }

    const gate3 = await decisionPatternLearningService.evaluateAutonomyGate(freshTenantId, {
      domain: 'scheduling',
      actionType: 'schedule_morning_sync',
      stakesLevel: 'low'
    })
    assert(!gate3.allowAutoExecute, '3 decisions still protected by cold start barrier')
    assert(gate3.decisionCode === 'ASK_USER_COLD_START', 'Requires >= 4 consistent decisions')

    // Step C: 4th & 5th consistent decisions scale confidence and graduate to established
    await decisionPatternLearningService.recordSignal({
      tenantId: freshTenantId,
      signalSource: 'permission_decision',
      domain: 'scheduling',
      contextSummary: 'Accepted 9:30 AM slot #4',
      userDecision: 'approved'
    })
    await decisionPatternLearningService.recordSignal({
      tenantId: freshTenantId,
      signalSource: 'permission_decision',
      domain: 'scheduling',
      contextSummary: 'Accepted 9:30 AM slot #5',
      userDecision: 'approved'
    })

    const gate5 = await decisionPatternLearningService.evaluateAutonomyGate(freshTenantId, {
      domain: 'scheduling',
      actionType: 'schedule_morning_sync',
      stakesLevel: 'low'
    })
    assert(gate5.allowAutoExecute, 'Graduates to auto-execute after 5 consistent decisions')
    assert(gate5.decisionCode === 'AUTO_EXECUTE_HIGH_CONFIDENCE', 'Graduation code is AUTO_EXECUTE_HIGH_CONFIDENCE')
    assert(gate5.confidenceScore >= 0.80, `Confidence score scales to ${(gate5.confidenceScore * 100).toFixed(0)}% (>= 80%)`)

    // ── TEST 3: Structured Context Generator for Agent Reasoning ───────
    console.log('\n--- Test Group 3: Structured XML Context Injection ---')
    const xmlContext = await decisionPatternLearningService.getStructuredDecisionContext(freshTenantId, 'scheduling')
    assert(xmlContext.includes('<user_decision_patterns>'), 'Outputs structured XML tag wrapper')
    assert(xmlContext.includes('domain="scheduling"'), 'Scopes XML attributes to active domain')
    assert(xmlContext.includes('confidence='), 'Includes calibrated confidence percentage')
    assert(xmlContext.includes('evidence_count="5"'), 'Includes evidence observation count')

    // ── TEST 4: Confidence-Gated Autonomy & High-Stakes Guardrails ─────
    console.log('\n--- Test Group 4: Autonomy Gating & High-Stakes Circuit Breakers ---')
    // Seed 6 consistent decisions for spending
    for (let i = 0; i < 6; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: testTenantId,
        signalSource: 'permission_decision',
        domain: 'spending_threshold',
        contextSummary: 'Approved small tooling subscription ($15/mo)',
        userDecision: 'approved'
      })
    }

    // Low stakes -> auto executes
    const lowStakes = await decisionPatternLearningService.evaluateAutonomyGate(testTenantId, {
      domain: 'spending_threshold',
      actionType: 'renew_micro_subscription',
      stakesLevel: 'low'
    })
    assert(lowStakes.allowAutoExecute, 'Low stakes action permitted autonomously')

    // High stakes -> BLOCKS and routes to user confirmation
    const highStakes = await decisionPatternLearningService.evaluateAutonomyGate(testTenantId, {
      domain: 'spending_threshold',
      actionType: 'purchase_enterprise_software_license',
      stakesLevel: 'high'
    })
    assert(!highStakes.allowAutoExecute, 'High stakes action is strictly blocked from auto-execution')
    assert(highStakes.decisionCode === 'ASK_USER_HIGH_STAKES', 'Returns ASK_USER_HIGH_STAKES circuit breaker code')

    // Destructive actions -> BLOCKS ALWAYS
    const destructive = await decisionPatternLearningService.evaluateAutonomyGate(testTenantId, {
      domain: 'destructive_actions',
      actionType: 'purge_all_archived_conversations',
      stakesLevel: 'medium'
    })
    assert(!destructive.allowAutoExecute, 'Destructive domain actions always block')
    assert(destructive.decisionCode === 'ASK_USER_HIGH_STAKES', 'Destructive actions trigger high stakes prompt')

    // ── TEST 5: Inspection, Editing, Pinning & Deletion ────────────────
    console.log('\n--- Test Group 5: Inspectable UI Operations & Rule Pinning ---')
    const patternList = await decisionPatternLearningService.getPatterns(testTenantId)
    const targetPattern = patternList[0]
    assert(Boolean(targetPattern), 'Learned patterns are inspectable')

    // User edits rule text and pins it
    const editedPattern = await decisionPatternLearningService.updateUserPattern(testTenantId, targetPattern.id, {
      userEditedRule: 'Always prefer concise bullet points and direct conclusions',
      isPinned: true,
      userSetConfidence: 0.99
    })
    assert(editedPattern?.userOverride?.isPinned === true, 'Rule is pinned by user')
    assert(editedPattern?.naturalLanguageSummary.includes('concise bullet points'), 'Updated natural language rule applied')

    // Pinned rule bypasses cold start and gates directly
    const pinnedGate = await decisionPatternLearningService.evaluateAutonomyGate(testTenantId, {
      domain: targetPattern.domain,
      actionType: 'custom_action',
      stakesLevel: 'low'
    })
    assert(pinnedGate.allowAutoExecute, 'Pinned rule auto-executes with user authority')
    assert(pinnedGate.decisionCode === 'USER_OVERRIDE_PINNED', 'Reports USER_OVERRIDE_PINNED code')

    // Delete pattern
    const deleteSuccess = await decisionPatternLearningService.deletePattern(testTenantId, targetPattern.id)
    assert(deleteSuccess, 'Pattern deleted successfully')
    const afterDeletePatterns = await decisionPatternLearningService.getPatterns(testTenantId)
    assert(!afterDeletePatterns.some(p => p.id === targetPattern.id), 'Pattern and its evidence completely removed')

    // ── TEST 6: Sovereign Data Guarantees & One-Click Erase ────────────
    console.log('\n--- Test Group 6: Data Sovereignty Export & Wipe ---')
    // Seed new pattern
    await decisionPatternLearningService.recordSignal({
      tenantId: testTenantId,
      signalSource: 'permission_decision',
      domain: 'email_comms',
      contextSummary: 'Export and wipe validation pattern',
      userDecision: 'approved'
    })

    // Export includes decision patterns
    const exportDump = await personalAgentService.exportAllData(testTenantId)
    assert(Array.isArray(exportDump.decisionPatterns), 'Export payload contains decisionPatterns array')
    assert(exportDump.decisionPatterns.length >= 1, 'Learned decision patterns included in sovereign export')

    // Permanent hard delete wipes patterns completely
    await personalAgentService.permanentHardDelete(testTenantId)
    const postWipePatterns = await decisionPatternLearningService.getPatterns(testTenantId)
    assert(postWipePatterns.length === 0, 'Permanent delete wiped all tenant decision patterns')

    // ── TEST 7: Anti-Overfitting Safeguard against Outlier Streaks ─────
    console.log('\n--- Test Group 7: Anti-Overfitting & Anomaly Resistance ---')
    const robustTenantId = `robust-user-${crypto.randomUUID().slice(0, 8)}`

    // 1. Establish solid pattern over 15 consistent approvals
    for (let i = 0; i < 15; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: robustTenantId,
        signalSource: 'permission_decision',
        domain: 'delegation_routing',
        contextSummary: 'Consistently delegated code tasks to Code Specialist',
        userDecision: 'approved'
      })
    }

    const baselinePatterns = await decisionPatternLearningService.getPatterns(robustTenantId, 'delegation_routing')
    const baseline = baselinePatterns[0]
    assert(baseline.evidenceCount === 15, '15 baseline observations established')
    assert(baseline.confidenceScore >= 0.95, `High baseline confidence: ${(baseline.confidenceScore * 100).toFixed(0)}%`)

    // 2. User makes 3 unusual contradicting rejections in a row
    for (let i = 0; i < 3; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: robustTenantId,
        signalSource: 'permission_decision',
        domain: 'delegation_routing',
        contextSummary: 'Unusual rejection of code delegation',
        userDecision: 'rejected'
      })
    }

    const afterAnomalyPatterns = await decisionPatternLearningService.getPatterns(robustTenantId, 'delegation_routing')
    const afterAnomaly = afterAnomalyPatterns[0]

    assert(afterAnomaly.evidenceCount === 18, 'Evidence count accurately increments to 18')
    assert(afterAnomaly.confidenceScore < 0.80, `Confidence gracefully drops below 80% threshold: ${(afterAnomaly.confidenceScore * 100).toFixed(0)}%`)
    assert(afterAnomaly.confidenceScore > 0.45, `Did NOT invert or wipe 15 past approvals: ${(afterAnomaly.confidenceScore * 100).toFixed(0)}%`)

    // 3. Autonomy gate safely stops auto-execution and asks user
    const anomalyGate = await decisionPatternLearningService.evaluateAutonomyGate(robustTenantId, {
      domain: 'delegation_routing',
      actionType: 'delegate_to_code_specialist',
      stakesLevel: 'low'
    })
    assert(!anomalyGate.allowAutoExecute, 'Autonomy gate safely falls back to Ask First on contradiction')
    assert(anomalyGate.decisionCode === 'ASK_USER_LOW_CONFIDENCE', 'Reports ASK_USER_LOW_CONFIDENCE due to anomaly drag')

    console.log(`\n======================================================`)
    console.log(`🎉 Decision Pattern Learning Test Results: ${passed} Passed, ${failed} Failed`)
    console.log(`======================================================\n`)

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err: any) {
    console.error('💥 Unhandled exception during tests:', err)
    process.exit(1)
  }
}

runDecisionPatternLearningTests()
