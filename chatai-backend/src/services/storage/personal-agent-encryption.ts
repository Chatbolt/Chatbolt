import crypto from 'crypto'
import { logger } from '../logger.service'

export interface EncryptedPayload {
  version: number
  cipher: 'aes-256-gcm'
  iv: string // hex
  tag: string // hex
  salt: string // hex
  ciphertext: string // hex
}

export interface EncryptionConfig {
  mode: 'user_passphrase' | 'platform_isolated_vault'
  saltHex?: string
  verificationHash?: string
}

const DEFAULT_ITERATIONS = 100_000
const KEY_LENGTH = 32 // 256-bit key
const PLATFORM_MASTER_SECRET = process.env.ENCRYPTION_MASTER_KEY || 'chatbolt-sovereign-vault-master-key-seed-2026'

export class PersonalAgentEncryption {
  /**
   * Derives a 256-bit encryption key from a user passphrase or tenant secret using PBKDF2
   */
  public static deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      passphrase,
      salt,
      DEFAULT_ITERATIONS,
      KEY_LENGTH,
      'sha512'
    )
  }

  /**
   * Generates a verification hash to test whether a user passphrase is correct without storing the plaintext passphrase
   */
  public static createPassphraseVerifier(passphrase: string, salt: Buffer): string {
    const key = this.deriveKey(passphrase, salt)
    return crypto.createHmac('sha256', key).update('chatbolt-passphrase-verifier-v1').digest('hex')
  }

  /**
   * Verifies if a user-supplied passphrase matches the stored verification hash
   */
  public static verifyPassphrase(passphrase: string, saltHex: string, expectedVerifierHex: string): boolean {
    const salt = Buffer.from(saltHex, 'hex')
    const actualVerifier = this.createPassphraseVerifier(passphrase, salt)
    return crypto.timingSafeEqual(Buffer.from(actualVerifier, 'hex'), Buffer.from(expectedVerifierHex, 'hex'))
  }

  /**
   * Encrypts plaintext string using AES-256-GCM with a user-controlled passphrase or tenant key
   */
  public static encrypt(
    plaintext: string,
    secretOrPassphrase?: string,
    providedSalt?: Buffer
  ): string {
    if (!plaintext) return ''

    const salt = providedSalt || crypto.randomBytes(16)
    const secret = secretOrPassphrase || PLATFORM_MASTER_SECRET
    const key = this.deriveKey(secret, salt)
    const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag()

    const payload: EncryptedPayload = {
      version: 1,
      cipher: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex'),
      ciphertext: encrypted
    }

    return `enc:v1:${Buffer.from(JSON.stringify(payload)).toString('base64')}`
  }

  /**
   * Decrypts an encrypted payload using AES-256-GCM with the user's passphrase or fallback key
   */
  public static decrypt(
    encryptedToken: string,
    secretOrPassphrase?: string
  ): string {
    if (!encryptedToken) return ''
    if (!encryptedToken.startsWith('enc:v1:')) {
      // Legacy or unencrypted string fallback
      return encryptedToken
    }

    try {
      const jsonStr = Buffer.from(encryptedToken.replace('enc:v1:', ''), 'base64').toString('utf8')
      const payload: EncryptedPayload = JSON.parse(jsonStr)

      const salt = Buffer.from(payload.salt, 'hex')
      const iv = Buffer.from(payload.iv, 'hex')
      const tag = Buffer.from(payload.tag, 'hex')
      const secret = secretOrPassphrase || PLATFORM_MASTER_SECRET
      const key = this.deriveKey(secret, salt)

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)

      let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (err: any) {
      logger.warn(`[PersonalAgentEncryption] Decryption failed with provided key: ${err.message}`)
      return '[Decryption Error: Invalid passphrase or corrupted ciphertext]'
    }
  }

  /**
   * Encrypts a JSON object into an encrypted string payload
   */
  public static encryptJSON(data: any, secretOrPassphrase?: string): string {
    return this.encrypt(JSON.stringify(data), secretOrPassphrase)
  }

  /**
   * Decrypts an encrypted string payload back into a JSON object
   */
  public static decryptJSON<T = any>(encryptedToken: string, secretOrPassphrase?: string): T | null {
    const raw = this.decrypt(encryptedToken, secretOrPassphrase)
    if (raw.startsWith('[Decryption Error')) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
}
