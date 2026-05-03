/**
 * Gmail Token Encryption/Decryption
 * AES-256-GCM for encrypting OAuth2 tokens at rest in MongoDB.
 */
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    const secret = process.env.SESSION_SECRET || ''
    // Derive a 32-byte key from the session secret using SHA-256
    return crypto.createHash('sha256').update(secret).digest()
}

export function encryptTokens(tokens: object): string {
    const key = getKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decryptTokens(encrypted: string): any {
    const key = getKey()
    const [ivHex, authTagHex, ciphertext] = encrypted.split(':')
    if (!ivHex || !authTagHex || !ciphertext) return null
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return JSON.parse(decrypted)
    } catch {
        return null
    }
}
