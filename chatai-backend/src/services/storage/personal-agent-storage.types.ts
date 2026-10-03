import { PersonalAgentProfile, PersonalAgentMessage, PersonalAgentMemoryItem } from '../personal-agent.service'

export type StorageBackendType =
  | 'hosted_postgres'
  | 'self_hosted_postgres'
  | 'byo_s3'
  | 'local_encrypted_file'

export interface StorageBackendConfig {
  backendType: StorageBackendType
  // Self-hosted Postgres / Supabase
  postgresUri?: string
  // BYO S3 / R2 / MinIO
  s3Endpoint?: string
  s3Bucket?: string
  s3Region?: string
  s3AccessKeyId?: string
  s3SecretAccessKey?: string
  s3Prefix?: string
  // Local File / Desktop mount
  localFilePath?: string
  // Encryption
  encryptionMode: 'user_passphrase' | 'platform_isolated_vault'
  saltHex?: string
  passphraseVerifierHex?: string
  lastTestedAt?: string
  status?: 'healthy' | 'degraded' | 'unreachable' | 'unconfigured'
}

export interface StorageMetrics {
  backendType: StorageBackendType
  backendName: string
  isZeroCloudStorage: boolean
  physicalLocation: string
  totalMemoriesCount: number
  totalMessagesCount: number
  estimatedSizeBytes: number
  encryptionMode: 'user_passphrase' | 'platform_isolated_vault'
  hasCustomPassphrase: boolean
  lastVerifiedAt: string
  dataRetentionPolicy: 'user_controlled_hard_delete'
}

export interface PersonalAgentExportPackage {
  formatVersion: string
  exportedAt: string
  tenantId: string
  personalAgent: {
    id: string
    name: string
    runningSummary: string
    persona: any
    preferredModel: string
    createdAt: string
  }
  inspectableMemories: Array<{
    id: string
    key: string
    value: string
    category: string
    importance: number
    isUserCorrected: boolean
    createdAt: string
  }>
  conversationHistory: Array<{
    id: string
    role: string
    content: string
    delegatedTaskId?: string
    delegatedAgentRole?: string
    createdAt: string
  }>
  dataSovereigntyManifest: {
    originStorageBackend: StorageBackendType
    storageEncryptionAtRest: string
    cloudAccessGuarantees: string
    thirdPartyInferenceNotice: string
    exportedChecksumSha256: string
  }
}

export interface ConnectionTestResult {
  ok: boolean
  latencyMs: number
  backendType: StorageBackendType
  error?: string
  details?: Record<string, any>
}

export interface IPersonalAgentStorageAdapter {
  readonly backendType: StorageBackendType
  readonly backendName: string
  readonly isZeroCloud: boolean

  initialize(config?: StorageBackendConfig): Promise<void>
  testConnection(config?: StorageBackendConfig): Promise<ConnectionTestResult>
  
  // Profile
  getProfile(tenantId: string, encryptionKey?: string): Promise<PersonalAgentProfile | null>
  saveProfile(profile: PersonalAgentProfile, encryptionKey?: string): Promise<void>
  
  // Messages
  getMessages(agentId: string, limit?: number, encryptionKey?: string): Promise<PersonalAgentMessage[]>
  saveMessage(msg: PersonalAgentMessage, encryptionKey?: string): Promise<void>
  
  // Memories
  getMemories(agentId: string, encryptionKey?: string): Promise<PersonalAgentMemoryItem[]>
  saveMemory(memory: PersonalAgentMemoryItem, encryptionKey?: string): Promise<void>
  updateMemory(id: string, agentId: string, updates: Partial<PersonalAgentMemoryItem>, encryptionKey?: string): Promise<PersonalAgentMemoryItem | null>
  deleteMemory(id: string, agentId: string): Promise<boolean>
  
  // Sovereign Operations
  getMetrics(agentId: string, tenantId: string): Promise<StorageMetrics>
  exportData(agentId: string, tenantId: string, encryptionKey?: string): Promise<PersonalAgentExportPackage>
  permanentHardDelete(agentId: string, tenantId: string, encryptionKey?: string): Promise<{
    deletedMemories: number
    deletedMessages: number
    deletedProfile: boolean
    physicalPathOrTablesCleared: string
  }>
}
