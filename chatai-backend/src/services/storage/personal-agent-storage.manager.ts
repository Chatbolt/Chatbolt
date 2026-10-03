import crypto from 'crypto'
import { logger } from '../logger.service'
import {
  IPersonalAgentStorageAdapter,
  StorageBackendType,
  StorageBackendConfig,
  StorageMetrics,
  PersonalAgentExportPackage,
  ConnectionTestResult
} from './personal-agent-storage.types'
import {
  PersonalAgentProfile,
  PersonalAgentMessage,
  PersonalAgentMemoryItem
} from '../personal-agent.service'
import { HostedPostgresStorageAdapter } from './adapters/hosted-postgres.adapter'
import { LocalEncryptedFileStorageAdapter } from './adapters/local-encrypted-file.adapter'
import { BYOS3StorageAdapter } from './adapters/byo-s3.adapter'
import { SelfHostedPostgresStorageAdapter } from './adapters/self-hosted-postgres.adapter'
import { PersonalAgentEncryption } from './personal-agent-encryption'

export class PersonalAgentStorageManager {
  private adapters: Map<StorageBackendType, IPersonalAgentStorageAdapter> = new Map()
  private tenantConfigs: Map<string, StorageBackendConfig> = new Map()
  private tenantPassphrases: Map<string, string> = new Map() // In-memory session-scoped passphrase

  constructor() {
    this.registerAdapter(new HostedPostgresStorageAdapter())
    this.registerAdapter(new LocalEncryptedFileStorageAdapter())
    this.registerAdapter(new BYOS3StorageAdapter())
    this.registerAdapter(new SelfHostedPostgresStorageAdapter())
  }

  public registerAdapter(adapter: IPersonalAgentStorageAdapter): void {
    this.adapters.set(adapter.backendType, adapter)
  }

  public getAdapter(backendType: StorageBackendType): IPersonalAgentStorageAdapter {
    const adapter = this.adapters.get(backendType)
    if (!adapter) {
      throw new Error(`Storage adapter for type '${backendType}' is not registered`)
    }
    return adapter
  }

  public listAvailableBackends(): Array<{
    type: StorageBackendType
    name: string
    isZeroCloud: boolean
    description: string
  }> {
    return [
      {
        type: 'hosted_postgres',
        name: 'Hosted Managed PostgreSQL',
        isZeroCloud: false,
        description: 'Default isolated cloud database with AES-256-GCM encryption at rest and one-click export/wipe.'
      },
      {
        type: 'local_encrypted_file',
        name: 'Local Encrypted Disk Vault (Zero Cloud)',
        isZeroCloud: true,
        description: 'Data never leaves your local machine or self-hosted filesystem. Encrypted at rest with your passphrase.'
      },
      {
        type: 'self_hosted_postgres',
        name: 'Self-Hosted PostgreSQL / Supabase',
        isZeroCloud: true,
        description: 'Connect directly to your self-hosted private PostgreSQL database or Supabase project.'
      },
      {
        type: 'byo_s3',
        name: 'User-Controlled S3 / R2 Bucket',
        isZeroCloud: true,
        description: 'Stream encrypted memories and conversations directly to your own AWS S3, Cloudflare R2, or MinIO bucket.'
      }
    ]
  }

  /**
   * Retrieves or builds the active storage configuration for a tenant
   */
  public getTenantConfig(tenantId: string): StorageBackendConfig {
    let cfg = this.tenantConfigs.get(tenantId)
    if (!cfg) {
      cfg = {
        backendType: 'hosted_postgres',
        encryptionMode: 'platform_isolated_vault',
        status: 'healthy'
      }
      this.tenantConfigs.set(tenantId, cfg)
    }
    return cfg
  }

  /**
   * Updates or switches storage backend for a tenant
   */
  public async configureTenantStorage(
    tenantId: string,
    newConfig: Partial<StorageBackendConfig>,
    migrateExistingData = false,
    agentId?: string
  ): Promise<{ success: boolean; config: StorageBackendConfig; migratedRecords?: number }> {
    const currentConfig = this.getTenantConfig(tenantId)
    const oldBackendType = currentConfig.backendType
    const targetBackendType = newConfig.backendType || currentConfig.backendType

    const targetAdapter = this.getAdapter(targetBackendType)
    await targetAdapter.initialize({ ...currentConfig, ...newConfig })

    let migratedCount = 0
    if (migrateExistingData && oldBackendType !== targetBackendType && agentId) {
      const oldAdapter = this.getAdapter(oldBackendType)
      const encKey = this.getTenantEncryptionKey(tenantId)

      const profile = await oldAdapter.getProfile(tenantId, encKey)
      const memories = await oldAdapter.getMemories(agentId, encKey)
      const messages = await oldAdapter.getMessages(agentId, 1000, encKey)

      if (profile) await targetAdapter.saveProfile(profile, encKey)
      for (const mem of memories) {
        await targetAdapter.saveMemory(mem, encKey)
      }
      for (const msg of messages) {
        await targetAdapter.saveMessage(msg, encKey)
      }
      migratedCount = memories.length + messages.length + (profile ? 1 : 0)
      logger.info(`[StorageManager] Migrated ${migratedCount} records from '${oldBackendType}' to '${targetBackendType}' for tenant '${tenantId}'`)
    }

    const updated: StorageBackendConfig = {
      ...currentConfig,
      ...newConfig,
      backendType: targetBackendType,
      lastTestedAt: new Date().toISOString(),
      status: 'healthy'
    }

    this.tenantConfigs.set(tenantId, updated)
    return { success: true, config: updated, migratedRecords: migratedCount }
  }

  /**
   * Sets or updates the user-controlled encryption passphrase for a tenant
   */
  public setTenantPassphrase(tenantId: string, passphrase: string): { saltHex: string; verifierHex: string } {
    const salt = crypto.randomBytes(16)
    const verifierHex = PersonalAgentEncryption.createPassphraseVerifier(passphrase, salt)
    const saltHex = salt.toString('hex')

    const cfg = this.getTenantConfig(tenantId)
    cfg.encryptionMode = 'user_passphrase'
    cfg.saltHex = saltHex
    cfg.passphraseVerifierHex = verifierHex
    this.tenantConfigs.set(tenantId, cfg)

    this.tenantPassphrases.set(tenantId, passphrase)
    logger.info(`[StorageManager] User-controlled passphrase enabled for tenant '${tenantId}'`)

    return { saltHex, verifierHex }
  }

  /**
   * Unlocks the user's encryption session using their passphrase
   */
  public unlockWithPassphrase(tenantId: string, passphrase: string): boolean {
    const cfg = this.getTenantConfig(tenantId)
    if (!cfg.saltHex || !cfg.passphraseVerifierHex) {
      this.tenantPassphrases.set(tenantId, passphrase)
      return true
    }

    const valid = PersonalAgentEncryption.verifyPassphrase(passphrase, cfg.saltHex, cfg.passphraseVerifierHex)
    if (valid) {
      this.tenantPassphrases.set(tenantId, passphrase)
    }
    return valid
  }

  public getTenantEncryptionKey(tenantId: string): string | undefined {
    return this.tenantPassphrases.get(tenantId)
  }

  /**
   * Helper to get active storage adapter for a tenant
   */
  public getActiveAdapterForTenant(tenantId: string): IPersonalAgentStorageAdapter {
    const cfg = this.getTenantConfig(tenantId)
    return this.getAdapter(cfg.backendType)
  }

  /**
   * Sovereign Data Metrics: Exactly where is user data, how much is stored, and encryption posture
   */
  public async getSovereigntyOverview(tenantId: string, agentId: string): Promise<{
    activeConfig: StorageBackendConfig
    metrics: StorageMetrics
    availableBackends: Array<{ type: StorageBackendType; name: string; isZeroCloud: boolean; description: string }>
    guaranteesAndDisclosures: {
      guarantees: string[]
      nonGuarantees: string[]
      thirdPartyInferenceNote: string
      threatModelSummary: string
    }
  }> {
    const cfg = this.getTenantConfig(tenantId)
    const adapter = this.getActiveAdapterForTenant(tenantId)
    const metrics = await adapter.getMetrics(agentId, tenantId)

    return {
      activeConfig: cfg,
      metrics: {
        ...metrics,
        encryptionMode: cfg.encryptionMode,
        hasCustomPassphrase: Boolean(cfg.saltHex && cfg.passphraseVerifierHex)
      },
      availableBackends: this.listAvailableBackends(),
      guaranteesAndDisclosures: {
        guarantees: [
          'Zero standing retention by Chatbolt when BYO storage (Local Disk, S3, Self-Hosted DB) is active.',
          'AES-256-GCM authenticated encryption at rest using keys derived from your passphrase.',
          'One-click permanent hard deletion physically drops records from your active storage medium (no hidden soft-deletes).',
          'Full one-click JSON/zip export bundle containing all memories, conversation histories, and cryptographic verification checksums.'
        ],
        nonGuarantees: [
          'In-flight inference requests sent to your chosen LLM provider (OpenAI, Anthropic) necessarily contain the prompt content unless using a local self-hosted engine (Ollama/vLLM).',
          'Local storage sovereignty does not protect against compromised local operating system host environments.',
          'Losing your custom encryption passphrase without a backup means data at rest cannot be recovered by anyone, including Chatbolt staff.'
        ],
        thirdPartyInferenceNote: 'Prompt context is sent over TLS only during active command execution. Storage at rest is strictly isolated.',
        threatModelSummary: 'Cryptographic zero-trust data sovereignty for Personal Assistant memories and interactions.'
      }
    }
  }

  /**
   * One-Click Full Data Export
   */
  public async exportAllTenantData(tenantId: string, agentId: string): Promise<PersonalAgentExportPackage> {
    const adapter = this.getActiveAdapterForTenant(tenantId)
    const encKey = this.getTenantEncryptionKey(tenantId)
    return adapter.exportData(agentId, tenantId, encKey)
  }

  /**
   * One-Click Permanent Physical Wipe
   */
  public async permanentHardDeleteTenantData(tenantId: string, agentId: string): Promise<{
    success: boolean
    deletedMemories: number
    deletedMessages: number
    deletedProfile: boolean
    verificationReceipt: {
      tenantId: string
      agentId: string
      timestamp: string
      storageCleared: string
    }
  }> {
    const adapter = this.getActiveAdapterForTenant(tenantId)
    const encKey = this.getTenantEncryptionKey(tenantId)
    const res = await adapter.permanentHardDelete(agentId, tenantId, encKey)
    this.tenantPassphrases.delete(tenantId)

    return {
      success: true,
      deletedMemories: res.deletedMemories,
      deletedMessages: res.deletedMessages,
      deletedProfile: res.deletedProfile,
      verificationReceipt: {
        tenantId,
        agentId,
        timestamp: new Date().toISOString(),
        storageCleared: res.physicalPathOrTablesCleared
      }
    }
  }
}

export const personalAgentStorageManager = new PersonalAgentStorageManager()
