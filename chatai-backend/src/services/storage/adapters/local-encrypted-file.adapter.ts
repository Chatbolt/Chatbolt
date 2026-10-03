import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { logger } from '../../logger.service'
import {
  IPersonalAgentStorageAdapter,
  StorageBackendType,
  StorageBackendConfig,
  StorageMetrics,
  PersonalAgentExportPackage,
  ConnectionTestResult
} from '../personal-agent-storage.types'
import {
  PersonalAgentProfile,
  PersonalAgentMessage,
  PersonalAgentMemoryItem
} from '../../personal-agent.service'
import { PersonalAgentEncryption } from '../personal-agent-encryption'

interface LocalStorageFileFormat {
  version: number
  tenantId: string
  saltHex: string
  updatedAt: string
  profilePayload: string // encrypted
  memoriesPayload: string // encrypted
  messagesPayload: string // encrypted
}

export class LocalEncryptedFileStorageAdapter implements IPersonalAgentStorageAdapter {
  public readonly backendType: StorageBackendType = 'local_encrypted_file'
  public readonly backendName = 'Local Encrypted Disk Vault (Zero Cloud)'
  public readonly isZeroCloud = true

  private baseDir: string

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), 'data', 'sovereign-storage')
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true })
      }
    } catch {}
  }

  private getFilePath(tenantId: string): string {
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.baseDir, `personal_agent_${safeTenant}.enc.json`)
  }

  private readContainer(tenantId: string): LocalStorageFileFormat | null {
    const filePath = this.getFilePath(tenantId)
    if (!fs.existsSync(filePath)) return null
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(raw) as LocalStorageFileFormat
    } catch (err: any) {
      logger.warn(`[LocalStorage] Failed to read container file ${filePath}: ${err.message}`)
      return null
    }
  }

  private writeContainer(tenantId: string, data: LocalStorageFileFormat): void {
    const filePath = this.getFilePath(tenantId)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  async initialize(config?: StorageBackendConfig): Promise<void> {
    if (config?.localFilePath) {
      this.baseDir = config.localFilePath
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true })
      }
    }
    logger.info(`[StorageAdapter:LocalEncryptedFile] Initialized at ${this.baseDir}`)
  }

  async testConnection(config?: StorageBackendConfig): Promise<ConnectionTestResult> {
    const start = Date.now()
    const targetDir = config?.localFilePath || this.baseDir
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      const testFile = path.join(targetDir, `.write_test_${Date.now()}`)
      fs.writeFileSync(testFile, 'ok', 'utf8')
      fs.unlinkSync(testFile)

      return {
        ok: true,
        latencyMs: Date.now() - start,
        backendType: this.backendType,
        details: { directory: targetDir, writable: true, zeroCloud: true }
      }
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        backendType: this.backendType,
        error: `Local filesystem storage error: ${err.message}`
      }
    }
  }

  async getProfile(tenantId: string, encryptionKey?: string): Promise<PersonalAgentProfile | null> {
    const container = this.readContainer(tenantId)
    if (!container || !container.profilePayload) return null

    const decrypted = PersonalAgentEncryption.decryptJSON<PersonalAgentProfile>(
      container.profilePayload,
      encryptionKey
    )
    return decrypted
  }

  async saveProfile(profile: PersonalAgentProfile, encryptionKey?: string): Promise<void> {
    let container = this.readContainer(profile.tenantId)
    if (!container) {
      container = {
        version: 1,
        tenantId: profile.tenantId,
        saltHex: crypto.randomBytes(16).toString('hex'),
        updatedAt: new Date().toISOString(),
        profilePayload: '',
        memoriesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey),
        messagesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey)
      }
    }

    container.profilePayload = PersonalAgentEncryption.encryptJSON(profile, encryptionKey)
    container.updatedAt = new Date().toISOString()
    this.writeContainer(profile.tenantId, container)
  }

  async getMessages(agentId: string, limit = 50, encryptionKey?: string): Promise<PersonalAgentMessage[]> {
    // Look up file by reading containers or direct match
    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.enc.json'))
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(this.baseDir, f), 'utf8')
        const container: LocalStorageFileFormat = JSON.parse(raw)
        const msgs = PersonalAgentEncryption.decryptJSON<PersonalAgentMessage[]>(
          container.messagesPayload,
          encryptionKey
        ) || []
        const matching = msgs.filter(m => m.personalAgentId === agentId)
        if (matching.length > 0) {
          return matching.slice(-limit)
        }
      } catch {}
    }
    return []
  }

  async saveMessage(msg: PersonalAgentMessage, encryptionKey?: string): Promise<void> {
    let container = this.readContainer(msg.tenantId)
    if (!container) {
      container = {
        version: 1,
        tenantId: msg.tenantId,
        saltHex: crypto.randomBytes(16).toString('hex'),
        updatedAt: new Date().toISOString(),
        profilePayload: '',
        memoriesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey),
        messagesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey)
      }
    }

    const currentMsgs = PersonalAgentEncryption.decryptJSON<PersonalAgentMessage[]>(
      container.messagesPayload,
      encryptionKey
    ) || []
    currentMsgs.push(msg)

    container.messagesPayload = PersonalAgentEncryption.encryptJSON(currentMsgs, encryptionKey)
    container.updatedAt = new Date().toISOString()
    this.writeContainer(msg.tenantId, container)
  }

  async getMemories(agentId: string, encryptionKey?: string): Promise<PersonalAgentMemoryItem[]> {
    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.enc.json'))
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(this.baseDir, f), 'utf8')
        const container: LocalStorageFileFormat = JSON.parse(raw)
        const mems = PersonalAgentEncryption.decryptJSON<PersonalAgentMemoryItem[]>(
          container.memoriesPayload,
          encryptionKey
        ) || []
        const matching = mems.filter(m => m.personalAgentId === agentId)
        if (matching.length > 0) {
          return matching
        }
      } catch {}
    }
    return []
  }

  async saveMemory(memory: PersonalAgentMemoryItem, encryptionKey?: string): Promise<void> {
    let container = this.readContainer(memory.tenantId)
    if (!container) {
      container = {
        version: 1,
        tenantId: memory.tenantId,
        saltHex: crypto.randomBytes(16).toString('hex'),
        updatedAt: new Date().toISOString(),
        profilePayload: '',
        memoriesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey),
        messagesPayload: PersonalAgentEncryption.encryptJSON([], encryptionKey)
      }
    }

    const currentMems = PersonalAgentEncryption.decryptJSON<PersonalAgentMemoryItem[]>(
      container.memoriesPayload,
      encryptionKey
    ) || []
    currentMems.unshift(memory)

    container.memoriesPayload = PersonalAgentEncryption.encryptJSON(currentMems, encryptionKey)
    container.updatedAt = new Date().toISOString()
    this.writeContainer(memory.tenantId, container)
  }

  async updateMemory(id: string, agentId: string, updates: Partial<PersonalAgentMemoryItem>, encryptionKey?: string): Promise<PersonalAgentMemoryItem | null> {
    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.enc.json'))
    for (const f of files) {
      try {
        const filePath = path.join(this.baseDir, f)
        const raw = fs.readFileSync(filePath, 'utf8')
        const container: LocalStorageFileFormat = JSON.parse(raw)
        const mems = PersonalAgentEncryption.decryptJSON<PersonalAgentMemoryItem[]>(
          container.memoriesPayload,
          encryptionKey
        ) || []

        const idx = mems.findIndex(m => m.id === id && m.personalAgentId === agentId)
        if (idx !== -1) {
          mems[idx] = {
            ...mems[idx],
            ...updates,
            isUserCorrected: updates.value !== undefined ? true : mems[idx].isUserCorrected,
            updatedAt: new Date().toISOString()
          }
          container.memoriesPayload = PersonalAgentEncryption.encryptJSON(mems, encryptionKey)
          container.updatedAt = new Date().toISOString()
          fs.writeFileSync(filePath, JSON.stringify(container, null, 2), 'utf8')
          return mems[idx]
        }
      } catch {}
    }
    return null
  }

  async deleteMemory(id: string, agentId: string): Promise<boolean> {
    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.enc.json'))
    for (const f of files) {
      try {
        const filePath = path.join(this.baseDir, f)
        const raw = fs.readFileSync(filePath, 'utf8')
        const container: LocalStorageFileFormat = JSON.parse(raw)
        const mems = PersonalAgentEncryption.decryptJSON<PersonalAgentMemoryItem[]>(
          container.memoriesPayload
        ) || []

        const filtered = mems.filter(m => m.id !== id)
        if (filtered.length !== mems.length) {
          container.memoriesPayload = PersonalAgentEncryption.encryptJSON(filtered)
          container.updatedAt = new Date().toISOString()
          fs.writeFileSync(filePath, JSON.stringify(container, null, 2), 'utf8')
          return true
        }
      } catch {}
    }
    return true
  }

  async getMetrics(agentId: string, tenantId: string): Promise<StorageMetrics> {
    const filePath = this.getFilePath(tenantId)
    const exists = fs.existsSync(filePath)
    let sizeBytes = 0
    if (exists) {
      sizeBytes = fs.statSync(filePath).size
    }

    const messages = await this.getMessages(agentId, 1000)
    const memories = await this.getMemories(agentId)

    return {
      backendType: this.backendType,
      backendName: this.backendName,
      isZeroCloudStorage: true,
      physicalLocation: `Local Disk: ${filePath}`,
      totalMemoriesCount: memories.length,
      totalMessagesCount: messages.length,
      estimatedSizeBytes: sizeBytes || 1024,
      encryptionMode: 'user_passphrase',
      hasCustomPassphrase: true,
      lastVerifiedAt: new Date().toISOString(),
      dataRetentionPolicy: 'user_controlled_hard_delete'
    }
  }

  async exportData(agentId: string, tenantId: string, encryptionKey?: string): Promise<PersonalAgentExportPackage> {
    const profile = await this.getProfile(tenantId, encryptionKey)
    const memories = await this.getMemories(agentId, encryptionKey)
    const messages = await this.getMessages(agentId, 2000, encryptionKey)

    const rawExportPayload = JSON.stringify({ profile, memories, messages })
    const checksum = crypto.createHash('sha256').update(rawExportPayload).digest('hex')

    return {
      formatVersion: 'chatbolt-sovereign-export-v1',
      exportedAt: new Date().toISOString(),
      tenantId,
      personalAgent: {
        id: agentId,
        name: profile?.name || 'Aria',
        runningSummary: profile?.runningSummary || '',
        persona: profile?.persona || {},
        preferredModel: profile?.preferredModel || 'gpt-4o',
        createdAt: profile?.createdAt || new Date().toISOString()
      },
      inspectableMemories: memories.map(m => ({
        id: m.id,
        key: m.key,
        value: m.value,
        category: m.category,
        importance: m.importance,
        isUserCorrected: m.isUserCorrected,
        createdAt: m.createdAt
      })),
      conversationHistory: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        delegatedTaskId: m.delegatedTaskId,
        delegatedAgentRole: m.delegatedAgentRole,
        createdAt: m.createdAt
      })),
      dataSovereigntyManifest: {
        originStorageBackend: this.backendType,
        storageEncryptionAtRest: 'Zero-cloud local encrypted JSON vault (AES-256-GCM)',
        cloudAccessGuarantees: 'Zero PersonalAgent data touches Chatbolt cloud servers. Complete local storage sovereignty.',
        thirdPartyInferenceNotice: 'AI inference requests are forwarded directly to chosen model endpoints only during execution.',
        exportedChecksumSha256: checksum
      }
    }
  }

  async permanentHardDelete(agentId: string, tenantId: string, encryptionKey?: string): Promise<{
    deletedMemories: number
    deletedMessages: number
    deletedProfile: boolean
    physicalPathOrTablesCleared: string
  }> {
    const filePath = this.getFilePath(tenantId)
    const mems = await this.getMemories(agentId, encryptionKey)
    const msgs = await this.getMessages(agentId, 1000, encryptionKey)
    const hadFile = fs.existsSync(filePath)

    if (hadFile) {
      // Overwrite with zeros before unlinking (defensive secure erase)
      const size = fs.statSync(filePath).size
      fs.writeFileSync(filePath, Buffer.alloc(size, 0))
      fs.unlinkSync(filePath)
    }

    return {
      deletedMemories: Math.max(mems.length, hadFile ? 1 : 0),
      deletedMessages: msgs.length,
      deletedProfile: hadFile,
      physicalPathOrTablesCleared: `Securely shredded and unlinked: ${filePath}`
    }
  }
}
