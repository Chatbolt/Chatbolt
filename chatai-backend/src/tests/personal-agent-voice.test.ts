import assert from 'assert'
import { personalAgentVoiceService } from '../services/personal-agent-voice.service'
import { personalAgentByokService } from '../services/personal-agent-byok.service'

async function runPersonalAgentVoiceTests() {
  console.log('🎙️ Starting Personal Assistant Voice Capabilities Test Suite (Prompt 32)...')

  const testTenantId = `tenant_voice_test_${Date.now()}`

  // ── Test Group 1: Phase 1 Browser-Native Default Configuration ─────────────
  console.log('\n--- Test Group 1: Phase 1 Browser-Native Voice Defaults ---')

  const defaultSettings = await personalAgentVoiceService.getVoiceSettings(testTenantId)
  assert.strictEqual(defaultSettings.inputMode, 'browser', 'Default input mode must be zero-cost browser-native Web Speech')
  assert.strictEqual(defaultSettings.outputMode, 'browser', 'Default output mode must be zero-cost browser-native SpeechSynthesis')
  assert.strictEqual(defaultSettings.autoSendOnSilence, false, 'autoSendOnSilence must be false so user always reviews text before sending')
  assert.strictEqual(defaultSettings.voiceInputEnabled, true, 'Voice input capability must be enabled by default')
  assert.strictEqual(defaultSettings.voiceOutputEnabled, true, 'Voice output capability must be enabled by default')
  assert.strictEqual(defaultSettings.spokenNotificationsEnabled, false, 'Spoken background notifications must be opt-in (false by default)')
  console.log('  ✅ PASS: Default settings adhere to Phase 1 browser-native zero-cost architecture')
  console.log('  ✅ PASS: User review safeguard active (no unverified auto-sending)')

  // ── Test Group 2: Phase 1 Zero-Cost Speech Fallback ─────────────────────────
  console.log('\n--- Test Group 2: Phase 1 Zero-Cost Speech Fallback Handling ---')

  const sttFallback = await personalAgentVoiceService.transcribeAudio(testTenantId, undefined, 'audio/webm', 10)
  assert.strictEqual(sttFallback.provider, 'browser_fallback', 'Default/fallback provider must be browser_fallback')
  assert.strictEqual(sttFallback.costUSD, 0, 'Browser fallback transcription must incur $0.00 cost')
  assert.strictEqual(sttFallback.metered, false, 'Browser fallback must not meter external tokens')
  console.log('  ✅ PASS: Browser-native STT transcription operates at $0.00 zero cost')

  const ttsFallback = await personalAgentVoiceService.synthesizeSpeech(
    testTenantId,
    'Hello! This is your personal assistant speaking through browser speech synthesis.'
  )
  assert.strictEqual(ttsFallback.provider, 'browser_fallback', 'Default/fallback TTS must be browser_fallback')
  assert.strictEqual(ttsFallback.costUSD, 0, 'Browser fallback synthesis must incur $0.00 cost')
  console.log('  ✅ PASS: Browser-native TTS synthesis operates at $0.00 zero cost')

  // ── Test Group 3: Voice Settings Customization ──────────────────────────────
  console.log('\n--- Test Group 3: Voice Settings Customization & Tunability ---')

  const updatedSettings = await personalAgentVoiceService.updateVoiceSettings(testTenantId, {
    spokenNotificationsEnabled: true,
    browserRate: 1.15,
    browserPitch: 0.95,
    providerTtsVoice: 'nova'
  })
  assert.strictEqual(updatedSettings.spokenNotificationsEnabled, true)
  assert.strictEqual(updatedSettings.browserRate, 1.15)
  assert.strictEqual(updatedSettings.browserPitch, 0.95)
  assert.strictEqual(updatedSettings.providerTtsVoice, 'nova')
  console.log('  ✅ PASS: Spoken background notification toggle and audio playback pitch/rate updated')

  // ── Test Group 4: Phase 2 Provider Upgrade & Spend Metering ─────────────────
  console.log('\n--- Test Group 4: Phase 2 Provider-Based Upgrade & Cost Metering ---')

  // Configure a mock BYOK key for the tenant
  await personalAgentByokService.saveAndEncryptKey(
    testTenantId,
    'openai',
    'sk-proj-mock-voice-test-key-for-transcription-and-tts-2026',
    'gpt-4o'
  )

  // Switch modes to provider
  await personalAgentVoiceService.updateVoiceSettings(testTenantId, {
    inputMode: 'provider',
    outputMode: 'provider'
  })

  // Test provider Whisper STT
  const whisperResult = await personalAgentVoiceService.transcribeAudio(
    testTenantId,
    Buffer.from('MOCK_AUDIO_DATA'),
    'audio/webm',
    12 // 12 seconds
  )
  assert.strictEqual(whisperResult.provider, 'whisper')
  assert.strictEqual(whisperResult.metered, true)
  assert.ok(whisperResult.costUSD > 0, 'Provider Whisper transcription must compute accurate fractional cent cost')
  console.log(`  ✅ PASS: Provider Whisper STT processed (12s @ $${whisperResult.costUSD})`)

  // Test provider TTS synthesis
  const testPhrase = 'Your high priority strategy review has been rescheduled to Thursday at 3 PM.'
  const ttsResult = await personalAgentVoiceService.synthesizeSpeech(testTenantId, testPhrase, 'nova')
  assert.strictEqual(ttsResult.provider, 'provider_tts')
  assert.strictEqual(ttsResult.characterCount, testPhrase.length)
  assert.strictEqual(ttsResult.metered, true)
  assert.ok(ttsResult.costUSD > 0, 'Provider TTS must compute character-based cost')
  console.log(`  ✅ PASS: Provider TTS speech synthesis generated (${ttsResult.characterCount} chars @ $${ttsResult.costUSD})`)

  // ── Test Group 5: Transparent Usage Ledger ──────────────────────────────────
  console.log('\n--- Test Group 5: Real-Time Transparent Spend & Usage Ledger ---')

  const usage = await personalAgentVoiceService.getVoiceUsageSummary(testTenantId)
  assert.strictEqual(usage.providerSttCallCount, 1)
  assert.strictEqual(usage.providerTtsCallCount, 1)
  assert.strictEqual(usage.totalSttSeconds, 12)
  assert.strictEqual(usage.totalTtsCharacters, testPhrase.length)
  assert.ok(usage.totalVoiceCostUSD > 0)
  console.log(`  ✅ PASS: Transparent ledger accurately aggregated STT seconds (${usage.totalSttSeconds}s), TTS chars (${usage.totalTtsCharacters}), and total spend ($${usage.totalVoiceCostUSD})`)

  // ── Test Group 6: Graceful Fallback on Missing / Broken Provider Key ────────
  console.log('\n--- Test Group 6: Graceful Fallback Protection ---')

  const brokenTenantId = `tenant_broken_${Date.now()}`
  // Enable provider mode without saving any BYOK key
  await personalAgentVoiceService.updateVoiceSettings(brokenTenantId, {
    inputMode: 'provider',
    outputMode: 'provider'
  })

  const fallbackStt = await personalAgentVoiceService.transcribeAudio(brokenTenantId, undefined, 'audio/webm', 5)
  assert.strictEqual(fallbackStt.provider, 'browser_fallback', 'Must automatically fall back to browser on missing BYOK key')
  assert.strictEqual(fallbackStt.costUSD, 0)

  const fallbackTts = await personalAgentVoiceService.synthesizeSpeech(brokenTenantId, 'Test fallback speech')
  assert.strictEqual(fallbackTts.provider, 'browser_fallback', 'Must automatically fall back to browser on missing BYOK key')
  assert.strictEqual(fallbackTts.costUSD, 0)
  console.log('  ✅ PASS: Automatic zero-cost fallback safely triggered when provider key is absent')

  console.log('\n======================================================')
  console.log('🎉 Personal Agent Voice Test Results: All Tests Passed!')
  console.log('======================================================\n')
}

runPersonalAgentVoiceTests().catch(err => {
  console.error('❌ Voice test suite failed:', err)
  process.exit(1)
})
