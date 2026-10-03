import assert from 'assert'
import { personalAgentService } from '../services/personal-agent.service'

async function runPersonalAgentTests() {
  console.log('🤖 Running Personal Assistant & Inspectable Memory Tests...')

  const testTenantId = `tenant_test_personal_${Date.now()}`

  // 1. Test Lazy Creation and Custom Naming
  const agent = await personalAgentService.getOrCreatePersonalAgent(testTenantId, 'Atlas')
  assert.strictEqual(agent.tenantId, testTenantId)
  assert.strictEqual(agent.name, 'Atlas')
  assert.strictEqual(agent.onboardingCompleted, false)
  console.log(`  ✅ Personal agent '${agent.name}' created with tenant binding`)

  // 2. Test Onboarding Flow
  const onboarded = await personalAgentService.completeOnboarding(testTenantId, {
    name: 'Jarvis',
    userRole: 'Staff Full-Stack Architect',
    primaryGoals: ['Architect distributed systems', 'Automate code reviews'],
    preferredTone: 'concise',
    initialNote: 'Focus on high test coverage and clean DDD architecture'
  })
  assert.strictEqual(onboarded.name, 'Jarvis')
  assert.strictEqual(onboarded.onboardingCompleted, true)
  assert.ok(onboarded.runningSummary.includes('Staff Full-Stack Architect'))
  console.log(`  ✅ Onboarding completed. Running summary updated: "${onboarded.runningSummary}"`)

  // 3. Test Inspectable & Correctable Memory System
  const initialMemories = await personalAgentService.getMemories(onboarded.id)
  assert.ok(initialMemories.length >= 2, 'Expected onboarding facts to be in inspectable memory')

  const customMem = await personalAgentService.addMemory({
    personalAgentId: onboarded.id,
    tenantId: testTenantId,
    key: 'preferred_language',
    value: 'TypeScript with Strict Mode',
    category: 'preference',
    importance: 9
  })
  assert.strictEqual(customMem.key, 'preferred_language')
  assert.strictEqual(customMem.isUserCorrected, false)

  // User corrects memory
  const updatedMem = await personalAgentService.updateMemory(customMem.id, testTenantId, {
    value: 'TypeScript & Go with Defensive Error Handling'
  })
  assert.strictEqual(updatedMem?.value, 'TypeScript & Go with Defensive Error Handling')
  assert.strictEqual(updatedMem?.isUserCorrected, true)
  console.log(`  ✅ Inspectable memory created & corrected by user: "${updatedMem?.value}"`)

  // 4. Test Chat & Clean Specialist Roster Delegation
  // Non-specialized message (Assistant directly responds with context)
  const convRes1 = await personalAgentService.chat(testTenantId, 'Hello Jarvis! What are my primary active goals?')
  assert.strictEqual(convRes1.assistantMessage.role, 'assistant')
  assert.strictEqual(convRes1.delegatedTask, undefined, 'Conversational queries should not trigger specialist delegation')
  console.log(`  ✅ Conversational response handled directly by personal companion`)

  // Specialized task message (Personal assistant delegates to software engineer specialist)
  const convRes2 = await personalAgentService.chat(testTenantId, 'Please write code for a rate limiter in TypeScript')
  assert.ok(convRes2.delegatedTask, 'Expected specialized task to be delegated to specialist roster')
  assert.strictEqual(convRes2.delegatedTask?.role, 'software_engineer')
  assert.ok(convRes2.assistantMessage.content.includes('software engineer') || convRes2.assistantMessage.content.includes('specialist'))
  console.log(`  ✅ Specialist delegation verified: Dispatched to role '${convRes2.delegatedTask?.role}' (Task: ${convRes2.delegatedTask?.taskId})`)

  // 5. Test Indefinite Conversation History Persistence
  const history = await personalAgentService.getMessages(onboarded.id)
  assert.ok(history.length >= 4, `Expected at least 4 messages in persistent history, got ${history.length}`)
  console.log(`  ✅ Indefinite conversation history verified (${history.length} messages persisted)`)

  console.log('🎉 All Personal Assistant & Inspectable Memory tests PASSED!')
}

runPersonalAgentTests().catch(err => {
  console.error('Test Failed:', err)
  process.exit(1)
})
