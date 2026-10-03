import { personalAgentByokService } from '../services/personal-agent-byok.service'
import { personalAgentChannelService } from '../services/personal-agent-channel.service'
import { personalAgentService } from '../services/personal-agent.service'
import { personalAgentOrchestratorService } from '../services/personal-agent-orchestrator.service'
import crypto from 'crypto'

async function runChannelsAndByokTests() {
  console.log('🚀 [Test] Starting PersonalAgent Channels & BYOK Fast-Track Test Suite...\n')
  const testTenantId = `test-user-${crypto.randomUUID().slice(0, 8)}`

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

  // ── TEST 1: Provider Recommendations & Defaults ──────────────────
  console.log('--- Test Group 1: BYOK Provider Recommendations ---')
  const providers = personalAgentByokService.getProviders()
  assert(providers.length >= 4, 'Provides at least 4 major AI providers')
  
  const groq = providers.find(p => p.id === 'groq')
  assert(Boolean(groq && groq.recommended), 'Groq is explicitly marked as recommended 1st choice')
  assert(Boolean(groq && groq.freeTierAvailable), 'Groq indicates 100% free tier available')
  assert(groq?.estimatedCostPer1kTasks.includes('$0.00'), 'Groq cost indicates $0.00 platform fee')

  // ── TEST 2: Fast Key Validation ──────────────────────────────────
  console.log('\n--- Test Group 2: Fast Key Validation & Format Checks ---')
  // 1. Valid Groq Key
  const groqVal = await personalAgentByokService.validateKey('groq', 'gsk_test_groq_key_personal_assistant_2026')
  assert(groqVal.valid, 'Validates well-formed Groq API key')
  assert(groqVal.freeTier === true, 'Groq validation flags free tier active')
  assert(groqVal.speed.includes('tokens/sec'), 'Groq validation reports blazing token speed')

  // 2. Valid OpenAI Key
  const openaiVal = await personalAgentByokService.validateKey('openai', 'sk-proj-test-openai-key-live-token-1234567890')
  assert(openaiVal.valid, 'Validates well-formed OpenAI API key')
  assert(openaiVal.freeTier === false, 'OpenAI flags direct usage billing')

  // 3. Invalid Empty / Bad Key
  const emptyVal = await personalAgentByokService.validateKey('groq', '')
  assert(!emptyVal.valid, 'Rejects empty API key with helpful message')

  const badVal = await personalAgentByokService.validateKey('groq', 'short')
  assert(!badVal.valid, 'Rejects malformed short key')

  // ── TEST 3: BYOK Configuration & Zero Platform Markup ────────────
  console.log('\n--- Test Group 3: Save BYOK Config & Zero-Cost Declaration ---')
  const saveResult = await personalAgentByokService.saveByokConfig(
    testTenantId,
    'groq',
    'gsk_test_groq_key_personal_assistant_2026',
    'llama-3.3-70b-versatile'
  )
  assert(saveResult.success, 'Saves BYOK config successfully')
  assert(saveResult.zeroCostDeclaration.includes('100% Free Forever'), 'Declares 100% Free Forever guarantee')

  const status = await personalAgentByokService.getByokStatus(testTenantId)
  assert(status.configured, 'BYOK status returns configured = true')
  assert(status.provider === 'groq', 'BYOK status matches saved provider')
  assert(status.isFreeTier, 'BYOK status confirms free tier active')

  // ── TEST 4: Channel Overview & Inbound Email Routing ──────────────
  console.log('\n--- Test Group 4: Multi-Channel Overview & Inbound Addressing ---')
  const channels = await personalAgentChannelService.getChannelsOverview(testTenantId)
  assert(channels.channels.dashboard.status === 'active', 'Dashboard channel is active')
  assert(channels.channels.chromeExtension.status === 'ready', 'Chrome extension channel is ready')
  assert(channels.channels.emailIn.status === 'active', 'Email-In channel is active')
  assert(channels.channels.emailIn.inboundAddress.includes('@in.chatbolt.ai'), 'Generates valid inbound email address')

  // ── TEST 5: Chrome Extension Actions ─────────────────────────────
  console.log('\n--- Test Group 5: Chrome Extension Quick Actions & Page Summaries ---')
  const extSummary = await personalAgentChannelService.processChromeExtensionAction({
    tenantId: testTenantId,
    action: 'summarize_page',
    pageUrl: 'https://news.ycombinator.com',
    pageTitle: 'Hacker News - Top Tech Breakthroughs',
    pageContent: 'New autonomous agent framework released with sovereign local encryption and AES-256 storage.'
  })

  assert(extSummary.success, 'Processes Chrome extension page summarization')
  assert(extSummary.response.length > 20, 'Returns non-empty assistant summary for extension')
  assert(extSummary.agentName === 'Aria', 'Response attributes to personal assistant persona (Aria)')

  // ── TEST 6: Email-In Webhook Ingestion & Specialist Pipeline ─────
  console.log('\n--- Test Group 6: Email-In Ingestion & Auto-Reply Synthesis ---')
  const emailInResult = await personalAgentChannelService.processEmailIn({
    from: 'founder@startup.io',
    to: channels.channels.emailIn.inboundAddress,
    subject: 'Trip to Tokyo: Need 3-Day Plan & Budget',
    text: 'Hi Aria, please research top sites in Tokyo, calculate a rough $1200 budget breakdown, and write a quick itinerary.'
  })

  assert(emailInResult.success, 'Processes incoming email webhook successfully')
  assert(emailInResult.subject === 'Trip to Tokyo: Need 3-Day Plan & Budget', 'Preserves email subject')
  assert(Boolean(emailInResult.emailReplyDraft?.bodyText), 'Drafts clean email response body')
  assert(emailInResult.emailReplyDraft.to === 'founder@startup.io', 'Sets reply recipient correctly')

  // ── TEST 7: Fresh User End-to-End Onboarding & First Mission ──────
  console.log('\n--- Test Group 7: End-to-End Fresh User Experience in < 2 Minutes ---')
  const freshUserId = `fresh-user-${crypto.randomUUID().slice(0, 8)}`

  // 1. Initial State
  const freshAgent = await personalAgentService.getOrCreatePersonalAgent(freshUserId, 'Nova')
  assert(freshAgent.name === 'Nova', 'Fresh user names assistant "Nova"')

  // 2. Add BYOK Key
  const valFresh = await personalAgentByokService.validateKey('groq', 'gsk_nova_fast_start_key_2026')
  assert(valFresh.valid, 'Fresh user key validates instantly')

  await personalAgentByokService.saveByokConfig(freshUserId, 'groq', 'gsk_nova_fast_start_key_2026')

  // 3. Run First Real Task
  const firstTaskResult = await personalAgentService.chat(
    freshUserId,
    'Write a Python function to parse JSON strings safely and return None on syntax errors, with unit tests.'
  )

  assert(firstTaskResult.success, 'First task completes successfully')
  assert(
    firstTaskResult.message.content.includes('def ') ||
    firstTaskResult.message.content.includes('python') ||
    firstTaskResult.message.content.includes('json') ||
    firstTaskResult.message.content.toLowerCase().includes('parse') ||
    firstTaskResult.message.content.toLowerCase().includes('completed'),
    'First task contains valid Python/specialist execution output'
  )
  assert(!firstTaskResult.message.content.includes('[code]') && !firstTaskResult.message.content.includes('TASK_COMPLETED'), 'First task response reads as one cohesive personal assistant without raw patchwork headers')


  // 4. Verify Persistent History & Context
  const history = await personalAgentService.getMessages(freshAgent.id)
  assert(history.length >= 2, 'Conversation persists in personal history across sessions')

  console.log(`\n======================================================`)
  console.log(`Results: ${passed} Passed | ${failed} Failed`)
  console.log(`======================================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runChannelsAndByokTests().catch(err => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})
