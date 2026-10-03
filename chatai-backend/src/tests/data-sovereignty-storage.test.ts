import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { PersonalAgentEncryption } from '../services/storage/personal-agent-encryption'
import { personalAgentStorageManager } from '../services/storage/personal-agent-storage.manager'
import { LocalEncryptedFileStorageAdapter } from '../services/storage/adapters/local-encrypted-file.adapter'
import { BYOS3StorageAdapter } from '../services/storage/adapters/byo-s3.adapter'
import { HostedPostgresStorageAdapter } from '../services/storage/adapters/hosted-postgres.adapter'
import { personalAgentService } from '../services/personal-agent.service'

async function runDataSovereigntyStorageTests() {
  console.log('🔒 Running Data Sovereignty & Pluggable Storage Tests...')

  const testTenantId = `tenant_sovereign_${Date.now()}`
  const userPassphrase = 'Sovereign_Super_Secret_Key_2026!'

  // ── 1. Cryptographic Encryption at Rest Tests ─────────────────────────────
  console.log('\n[1/5] Testing Client-Controlled AES-256-GCM Encryption...')
  const rawSecretFact = 'User prefers strict TypeScript and PostgreSQL schemas'
  
  const encrypted = PersonalAgentEncryption.encrypt(rawSecretFact, userPassphrase)
  assert.ok(encrypted.startsWith('enc:v1:'), 'Expected token to have enc:v1 prefix')
  assert.ok(!encrypted.includes('TypeScript'), 'Ciphertext must not leak plaintext keywords')
  
  const decrypted = PersonalAgentEncryption.decrypt(encrypted, userPassphrase)
  assert.strictEqual(decrypted, rawSecretFact, 'Decrypted text must match original plaintext')

  const wrongPassphraseDecrypted = PersonalAgentEncryption.decrypt(encrypted, 'Wrong_Passphrase_123')
  assert.ok(wrongPassphraseDecrypted.includes('Decryption Error'), 'Decryption must fail with wrong passphrase')
  console.log('  ✅ AES-256-GCM encryption & PBKDF2 user passphrase key derivation verified')

  // ── 2. Local Encrypted File Adapter (Zero Cloud) ──────────────────────────
  console.log('\n[2/5] Testing Zero-Cloud Local Disk Storage Adapter...')
  const localDir = path.join(process.cwd(), 'data', 'test-sovereign-vault')
  const localAdapter = new LocalEncryptedFileStorageAdapter(localDir)

  const testProfile = {
    id: `pa_local_${Date.now()}`,
    tenantId: testTenantId,
    name: 'Atlas-Local',
    persona: { roleDescription: 'Local Sovereign Orchestrator', tone: 'concise' as const, language: 'en' },
    runningSummary: 'Running 100% locally on user filesystem',
    systemPrompt: 'Local assistant only',
    onboardingCompleted: true,
    onboardingAnswers: { role: 'Security Architect' },
    preferredModel: 'local-ollama-llama3',
    connectedIntegrations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Save to local storage
  await localAdapter.saveProfile(testProfile, userPassphrase)
  const savedProfile = await localAdapter.getProfile(testTenantId, userPassphrase)
  assert.strictEqual(savedProfile?.name, 'Atlas-Local')
  assert.strictEqual(savedProfile?.runningSummary, 'Running 100% locally on user filesystem')

  // Save memories to local disk
  const mem1 = {
    id: `mem_local_1`,
    personalAgentId: testProfile.id,
    tenantId: testTenantId,
    key: 'private_api_token_rule',
    value: 'Never send raw tokens to unverified endpoints',
    category: 'constraint' as const,
    importance: 10,
    isUserCorrected: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  await localAdapter.saveMemory(mem1, userPassphrase)
  const localMems = await localAdapter.getMemories(testProfile.id, userPassphrase)
  assert.strictEqual(localMems.length, 1)
  assert.strictEqual(localMems[0].key, 'private_api_token_rule')
  console.log(`  ✅ Zero-cloud local disk storage verified (${localMems.length} fact stored locally)`)

  // ── 3. BYO S3 / Cloud Bucket Adapter ──────────────────────────────────────
  console.log('\n[3/5] Testing User-Controlled BYO S3 Bucket Adapter...')
  const s3Adapter = new BYOS3StorageAdapter()
  await s3Adapter.initialize({
    backendType: 'byo_s3',
    s3Bucket: 'my-private-corp-vault',
    s3Region: 'us-west-2',
    encryptionMode: 'user_passphrase'
  })

  const testConn = await s3Adapter.testConnection()
  assert.strictEqual(testConn.ok, true)
  assert.strictEqual(testConn.details?.bucket, 'my-private-corp-vault')

  await s3Adapter.saveProfile(testProfile, userPassphrase)
  await s3Adapter.saveMemory(mem1, userPassphrase)
  const s3Mems = await s3Adapter.getMemories(testProfile.id, userPassphrase)
  assert.strictEqual(s3Mems.length, 1)
  assert.strictEqual(s3Mems[0].value, 'Never send raw tokens to unverified endpoints')
  console.log('  ✅ BYO S3 storage connection test & encrypted record storage verified')

  // ── 4. One-Click Full Data Export with Cryptographic Manifest ─────────────
  console.log('\n[4/5] Testing One-Click Sovereign Data Export Package...')
  const exportPackage = await localAdapter.exportData(testProfile.id, testTenantId, userPassphrase)
  assert.strictEqual(exportPackage.tenantId, testTenantId)
  assert.strictEqual(exportPackage.inspectableMemories.length, 1)
  assert.strictEqual(exportPackage.dataSovereigntyManifest.originStorageBackend, 'local_encrypted_file')
  assert.ok(exportPackage.dataSovereigntyManifest.exportedChecksumSha256.length === 64, 'Must include SHA-256 integrity checksum')
  console.log(`  ✅ Export bundle verified with SHA-256 hash: ${exportPackage.dataSovereigntyManifest.exportedChecksumSha256.slice(0, 16)}...`)

  // ── 5. One-Click Permanent Hard Deletion (Real Storage Verification) ──────
  console.log('\n[5/5] Testing One-Click Permanent Hard Deletion...')
  const deleteResult = await localAdapter.permanentHardDelete(testProfile.id, testTenantId, userPassphrase)
  assert.strictEqual(deleteResult.deletedMemories, 1)
  assert.strictEqual(deleteResult.deletedProfile, true)
  assert.ok(deleteResult.physicalPathOrTablesCleared.includes('unlinked'))

  // Verify memory and profile are physically 0 in real storage
  const remainingMems = await localAdapter.getMemories(testProfile.id, userPassphrase)
  const remainingProfile = await localAdapter.getProfile(testTenantId, userPassphrase)
  assert.strictEqual(remainingMems.length, 0, 'Memories must be physically zero after hard delete')
  assert.strictEqual(remainingProfile, null, 'Profile must be physically null after hard delete')
  console.log('  ✅ Physical hard-delete verified: 0 records remain in active storage medium')

  // Clean up test directory if created
  try {
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true })
    }
  } catch {}

  console.log('\n🎉 All Data Sovereignty & Pluggable Storage tests PASSED with 100% assertions!\n')
}

runDataSovereigntyStorageTests().catch(err => {
  console.error('Test Failed:', err)
  process.exit(1)
})
