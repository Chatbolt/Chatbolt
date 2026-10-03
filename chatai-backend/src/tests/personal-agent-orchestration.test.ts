import assert from 'assert'
import { personalAgentOrchestratorService } from '../services/personal-agent-orchestrator.service'
import { personalAgentService } from '../services/personal-agent.service'
import { agentCollaborationService } from '../services/agent-collaboration.service'
import { agentBus } from '../runtime/agent-bus.service'

async function runPersonalAgentOrchestrationTests() {
  console.log('🎭 Running PersonalAgent Orchestration, Specialist Routing & Handoff Tests...')
  const testTenantId = `tenant_test_orch_${Date.now()}`

  // 0. Ensure Agent Initialized
  const agent = await personalAgentService.getOrCreatePersonalAgent(testTenantId, 'Aria')
  assert.strictEqual(agent.name, 'Aria')
  console.log('  ✅ 0. PersonalAgent initialized with identity and persona')

  // 1. Test Intent Analysis & DAG Construction
  console.log('Testing Item 1: Intent classification & Personal DAG construction...')
  
  // A: Direct casual conversation
  const casualIntent = personalAgentOrchestratorService.analyzeIntent('Good morning! How are you doing today?')
  assert.strictEqual(casualIntent.requiresDelegation, false)
  assert.strictEqual(casualIntent.isMultiStep, false)

  // B: Single specialist technical request (code)
  const codeIntent = personalAgentOrchestratorService.analyzeIntent('Write a Python function to parse JSON logs and fix bug in regex')
  assert.strictEqual(codeIntent.requiresDelegation, true)
  assert.strictEqual(codeIntent.isMultiStep, false)
  assert.strictEqual(codeIntent.matchedRoles[0], 'code')

  // C: Compound multi-step request (Research + Budget Calculation + Itinerary Writing)
  const compoundIntent = personalAgentOrchestratorService.analyzeIntent(
    'Plan a 5-day vacation trip to Tokyo, calculate the estimated daily budget in USD, and write a complete itinerary doc'
  )
  assert.strictEqual(compoundIntent.requiresDelegation, true)
  assert.strictEqual(compoundIntent.isMultiStep, true)
  assert.ok(compoundIntent.plan.length >= 2, 'Compound plan must contain at least 2 specialist stages')
  console.log(`  ✅ 1. Intent classifier constructed DAG with ${compoundIntent.plan.length} specialist stages: [${compoundIntent.matchedRoles.join(' -> ')}]`)

  // 2. Test Single Specialist Execution with Structured Handoff
  console.log('Testing Item 2: Single specialist delegation & handoff packet emission...')
  
  let receivedHandoffOnBus: any = null
  const unsubBus = agentBus.subscribe('personal_team', (msg) => {
    if (msg.payload?.eventType === 'AGENT_HANDOFF') {
      receivedHandoffOnBus = msg.payload.handoff
    }
  })

  const singleResult = await personalAgentOrchestratorService.executePersonalRequest({
    tenantId: testTenantId,
    agent,
    userPrompt: 'Write a TypeScript helper function to retry failed HTTP requests with exponential backoff',
    memories: [],
    historyContext: ''
  })

  assert.strictEqual(singleResult.isDelegated, true)
  assert.strictEqual(singleResult.isMultiStep, false)
  assert.strictEqual(singleResult.specialistsInvolved[0], 'code')
  assert.ok(singleResult.unifiedResponse.length > 20)
  assert.ok(singleResult.handoffs.length >= 1, 'Must emit at least 1 handoff packet')
  assert.strictEqual(singleResult.handoffs[0].fromRole, 'code')
  assert.strictEqual(singleResult.handoffs[0].toRole, 'personal_assistant')
  console.log('  ✅ 2. Single specialist delegation executed with structured handoff packet')

  // 3. Test Multi-Step Personal DAG Execution (Trip Planning + Budget + Itinerary)
  console.log('Testing Item 3: Multi-step personal DAG with upstream context propagation...')

  const compoundResult = await personalAgentOrchestratorService.executePersonalRequest({
    tenantId: testTenantId,
    agent,
    userPrompt: 'Plan a 3-day itinerary in Kyoto, calculate the daily travel budget, and draft a structured itinerary with packing tips',
    memories: [],
    historyContext: ''
  })

  assert.strictEqual(compoundResult.isDelegated, true)
  assert.strictEqual(compoundResult.isMultiStep, true)
  assert.ok(compoundResult.specialistsInvolved.length >= 2, 'Must involve multiple specialists')
  assert.ok(compoundResult.handoffs.length >= 2, 'Must generate multiple handoff packets across stages')
  assert.ok(compoundResult.unifiedResponse.length > 100, 'Unified response must be detailed')
  console.log(`  ✅ 3. Multi-step DAG completed across ${compoundResult.specialistsInvolved.length} specialists with ${compoundResult.handoffs.length} handoffs`)

  // 4. Test Full PersonalAgent Chat Integration (Unified Persona & Transparency Metadata)
  console.log('Testing Item 4: End-to-end chat integration with unified persona...')

  const chatResult = await personalAgentService.chat(
    testTenantId,
    'Can you research the top 3 noise-cancelling headphones under $300, compare their battery life, and draft a short recommendation?'
  )

  assert.ok(chatResult.assistantMessage)
  assert.strictEqual(chatResult.assistantMessage.role, 'assistant')
  assert.ok(chatResult.assistantMessage.content.length > 50)
  
  // Verify unified voice without raw patchwork seams
  assert.ok(!chatResult.assistantMessage.content.includes('SPECIALIST DELIVERABLE:'), 'Output must be unified without raw internal labels')
  
  // Verify auditability in metadata
  assert.ok(chatResult.assistantMessage.metadata?.delegated, 'Metadata must record delegation flag')
  assert.ok(chatResult.assistantMessage.metadata?.handoffsCount >= 1, 'Metadata must preserve handoff count')
  assert.ok(chatResult.assistantMessage.metadata?.specialistsInvolved?.length >= 1, 'Metadata must record specialist roles')
  console.log('  ✅ 4. End-to-end chat produced cohesive response with transparent handoff metadata')

  // 5. Verify Conversation History Records Delegation Notices
  const messages = await personalAgentService.getMessages(agent.id, 10)
  const delegationNotice = messages.find(m => m.role === 'delegation_notice')
  assert.ok(delegationNotice, 'Conversation history must include transparency delegation notice')
  console.log('  ✅ 5. Transparency notice preserved in conversation audit history')

  unsubBus()
  console.log('\n🎉 ALL PERSONAL AGENT ORCHESTRATION & ROUTING TESTS PASSED!')
}

runPersonalAgentOrchestrationTests().catch(err => {
  console.error('❌ PersonalAgent Orchestration Test Failed:', err)
  process.exit(1)
})
