import { crucialMomentAndAdviceService } from '../services/crucial-moment-and-advice.service'
import { decisionPatternLearningService } from '../services/decision-pattern-learning.service'
import crypto from 'crypto'

async function runCrucialMomentsAndAdviceTests() {
  console.log('🚀 [Test] Starting Crucial-Moment Detection & Proactive Advice Test Suite (Prompt 31)...\n')
  const testTenantId = `test-tenant-crucial-${crypto.randomUUID().slice(0, 8)}`

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
    // ── TEST 1: Multi-Factor Crucial Moment Scoring ───────────────────
    console.log('--- Test Group 1: 5-Factor Concrete Crucial-Moment Scoring ---')

    // 1. Irreversibility Circuit Breaker
    const irrecRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'purge_all_archived_conversations',
      domain: 'destructive_actions',
      proposedPayload: { isPermanent: true }
    })
    assert(irrecRes.isCrucial, 'Irreversible deletion flags as crucial moment')
    assert(irrecRes.factorScores.irreversibilityScore === 1.0, 'Irreversibility score is 1.0')
    assert(irrecRes.triggeredFactors.some(f => f.includes('Irreversible Action')), 'Identifies irreversible action in triggered factors list')

    // 2. Financial Impact vs Configured Spend Limit ($120 vs $50 default limit)
    const finRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'purchase_enterprise_plugin_annual',
      domain: 'spending_threshold',
      proposedPayload: { amount: 120.0 }
    })
    assert(finRes.isCrucial, 'Cost exceeding $50 auto-spend limit flags as crucial moment')
    assert(finRes.factorScores.financialImpactScore === 1.0, 'Financial impact score is 1.0 when exceeding limit')
    assert(finRes.triggeredFactors.some(f => f.includes('Financial Impact')), 'Identifies financial threshold exceeded in triggered factors list')

    // 3. External Exposure (Sending email to external recipient)
    const extRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'send_client_contract_email',
      domain: 'email_comms',
      proposedPayload: { recipient: 'partner@externalcorporation.com' }
    })
    assert(extRes.isCrucial, 'External email dispatch flags as crucial moment')
    assert(extRes.factorScores.externalExposureScore >= 0.85, 'External exposure score is >= 0.85')
    assert(extRes.triggeredFactors.some(f => f.includes('External Exposure')), 'Identifies external exposure in triggered factors list')

    // 4. Genuine Novelty (Brand new domain with 0 historical decisions)
    const novelRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: `fresh-user-${crypto.randomUUID().slice(0, 6)}`,
      actionType: 'configure_unseen_webhook_integration',
      domain: 'delegation_routing'
    })
    assert(novelRes.factorScores.noveltyScore === 1.0, 'Zero-history domain has novelty score 1.0')

    // ── TEST 2: Clear, Explanatory Notification Triggering ─────────────
    console.log('\n--- Test Group 2: Clear, Non-Vague Explanation of Crucial Flags ---')
    const multiFactorRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'send_external_refund_notice',
      domain: 'spending_threshold',
      proposedPayload: { amount: 250, recipient: 'customer@external.com' }
    })
    assert(multiFactorRes.isCrucial, 'Multi-factor compound action flags as crucial')
    assert(multiFactorRes.triggeredFactors.length >= 2, 'Lists multiple triggered factors')
    assert(multiFactorRes.explanation.includes('Financial Impact') || multiFactorRes.explanation.includes('External Exposure'), 'Explanation cites exact triggering factor reasons')
    assert(!multiFactorRes.explanation.includes('this seems important'), 'Avoids vague feelings, gives concrete factor reasons')

    // ── TEST 3: Proactive Traceable Advice Generation ───────────────────
    console.log('\n--- Test Group 3: Proactive Traceable Advice Generation ---')
    // Seed 5 consistent decisions in scheduling
    for (let i = 0; i < 5; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: testTenantId,
        signalSource: 'permission_decision',
        domain: 'scheduling',
        contextSummary: 'Accepted morning focus block with 15m buffer',
        userDecision: 'approved'
      })
    }

    // Seed 5 consistent email draft edit diffs
    for (let i = 0; i < 5; i++) {
      await decisionPatternLearningService.recordSignal({
        tenantId: testTenantId,
        signalSource: 'edit_diff',
        domain: 'email_comms',
        contextSummary: 'Shortened proposed email by 35% before sending',
        userDecision: 'edited'
      })
    }

    const adviceList = await crucialMomentAndAdviceService.generateProactiveAdvice(testTenantId)
    assert(adviceList.length >= 1, 'Generates proactive advice based on learned history')
    
    const schedAdvice = adviceList.find(a => a.category === 'conflict_warning' || a.category === 'optimization') || adviceList[0]
    assert(Boolean(schedAdvice.reasoning), 'Advice includes traceable reasoning statement')
    assert(Array.isArray(schedAdvice.evidenceCitations) && schedAdvice.evidenceCitations.length > 0, 'Advice has traceable evidence citations')
    assert(Boolean(schedAdvice.evidenceCitations[0].source), 'Citation identifies concrete historical source')

    // ── TEST 4: Tunable Proactivity & Feedback Loop Frequency Dampening ──
    console.log('\n--- Test Group 4: Tunable Settings & Dynamic Feedback Dampening ---')
    // A. Proactivity Level 'off' returns 0 unsolicited suggestions
    await crucialMomentAndAdviceService.updateSettings(testTenantId, { proactivityLevel: 'off' })
    const offAdvice = await crucialMomentAndAdviceService.generateProactiveAdvice(testTenantId)
    assert(offAdvice.length === 0, 'Returns 0 advice items when proactivityLevel is "off"')

    // Reset back to frequent
    await crucialMomentAndAdviceService.updateSettings(testTenantId, { proactivityLevel: 'frequent' })
    const activeAdvice = await crucialMomentAndAdviceService.generateProactiveAdvice(testTenantId)
    assert(activeAdvice.length >= 1, 'Resumes surfacing advice when proactivityLevel is enabled')

    // B. User dismisses an advice item -> frequency dampens for that category
    const targetAdv = activeAdvice[0]
    const updatedAdv = await crucialMomentAndAdviceService.submitAdviceFeedback(testTenantId, targetAdv.id, 'dismissed')
    assert(updatedAdv?.status === 'dismissed', 'Advice item marked dismissed')
    
    const updatedSettings = await crucialMomentAndAdviceService.getSettings(testTenantId)
    const dampener = updatedSettings.categoryFrequencyDampeners[targetAdv.category]
    assert(dampener !== undefined && dampener < 1.0, `Category '${targetAdv.category}' dampener reduced to ${dampener} (< 1.0)`)

    // ── TEST 5: Safeguards: False Confidence & Anti-Echo Mistake Prevention ──
    console.log('\n--- Test Group 5: Safeguards against False Confidence & Mistake Echoing ---')
    
    // Safeguard A: Honest Probabilistic Phrasing
    const adviceItem = activeAdvice[0]
    const hasHonestPhrasing =
      adviceItem.summary.includes('Based on') ||
      adviceItem.summary.includes('tend to') ||
      adviceItem.summary.includes('usually') ||
      adviceItem.reasoning.includes('consistently') ||
      adviceItem.reasoning.includes('past')
    assert(hasHonestPhrasing, 'Advice uses honest, probabilistic wording instead of false certainty')

    // Safeguard B: Anti-Echo Mistake Registry (Item 5b)
    await crucialMomentAndAdviceService.flagMistake(testTenantId, {
      actionType: 'auto_deploy_untested_branch',
      domain: 'code_style',
      rationale: 'Deployed without running test suite, resulting in downtime'
    })

    const mistakeCheck = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'auto_deploy_untested_branch',
      domain: 'code_style',
      contextDescription: 'Attempting automated deploy of untested branch'
    })
    assert(mistakeCheck.isCrucial, 'Action matching user-flagged mistake triggers crucial moment')
    assert(mistakeCheck.isRepeatingKnownMistake === true, 'Flags isRepeatingKnownMistake = true')
    assert(mistakeCheck.recommendation === 'block_and_alert', 'Recommends block_and_alert to prevent repeating past mistake')
    assert(mistakeCheck.explanation.includes('previously flagged as a mistake'), 'Explicitly warns user about repeated mistake pattern')

    // ── TEST 6: Structured LLM Context Generation ───────────────────────
    console.log('\n--- Test Group 6: Structured XML Context Injection ---')
    const xmlAdviceContext = await crucialMomentAndAdviceService.getStructuredAdviceContext(testTenantId)
    assert(xmlAdviceContext.includes('<proactive_traceable_advice'), 'Outputs root <proactive_traceable_advice> tag')
    assert(xmlAdviceContext.includes('<advice_item'), 'Contains structured advice items')
    assert(xmlAdviceContext.includes('<citations>'), 'Includes cited factual sources in XML')

    // ── TEST 7: Ambiguous vs High-Stakes Boundary Verification ───────────
    console.log('\n--- Test Group 7: Boundary Tuning (Routine vs Ambiguous vs Crucial) ---')

    // Case A: Safe routine action within established bounds ($5 internal draft)
    const routineRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'draft_internal_summary_note',
      domain: 'email_comms',
      proposedPayload: { amount: 5.0, recipient: 'self@workspace.local' },
      contextDescription: 'Draft concise internal summary note'
    })
    assert(!routineRes.isCrucial, 'Safe routine internal draft does NOT trigger crucial escalation')
    assert(routineRes.recommendation === 'auto_proceed', 'Recommends auto_proceed for safe routine tasks')

    // Case B: High-stakes boundary crossing ($65 > $50 spend limit)
    const spendBoundaryRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'renew_plugin_license',
      domain: 'spending_threshold',
      proposedPayload: { amount: 65.0 }
    })
    assert(spendBoundaryRes.isCrucial, '$65 purchase crossing $50 threshold correctly escalates')

    // Case C: High-stakes boundary crossing (Delete action even if routine score is ok)
    const deleteBoundaryRes = await crucialMomentAndAdviceService.evaluateCrucialMoment({
      tenantId: testTenantId,
      actionType: 'delete_local_scratchpad_history',
      domain: 'destructive_actions'
    })
    assert(deleteBoundaryRes.isCrucial, 'Destructive delete action always escalates regardless of other factors')

    console.log(`\n======================================================`)
    console.log(`🎉 Crucial Moments & Proactive Advice Test Results: ${passed} Passed, ${failed} Failed`)
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

runCrucialMomentsAndAdviceTests()
