import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Encryption utility for sensitive configuration data
 * Uses AES-256-GCM for authenticated encryption
 */
export class CryptoManager {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32;

  /**
   * Generate a secure encryption key from a password
   */
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Generate a machine-specific encryption key
   * Uses machine ID for deterministic key generation
   */
  static getMachineKey(): string {
    const machineId = this.getMachineId();
    return crypto.createHash('sha256').update(machineId).digest('hex');
  }

  /**
   * Get machine-specific identifier
   */
  private static getMachineId(): string {
    try {
      // Try to get a stable machine identifier
      const os = require('os');
      const hostname = os.hostname();
      const networkInterfaces = os.networkInterfaces();

      // Get first non-internal MAC address
      let macAddress = '';
      for (const iface of Object.values(networkInterfaces)) {
        const nonInternal = (iface as any[]).find(
          (i) => !i.internal && i.mac !== '00:00:00:00:00:00',
        );
        if (nonInternal) {
          macAddress = nonInternal.mac;
          break;
        }
      }

      return `${hostname}:${macAddress}`;
    } catch (error) {
      // Fallback to random ID (will require re-encryption on each run)
      console.warn('Could not determine stable machine ID, using random fallback');
      return crypto.randomBytes(32).toString('hex');
    }
  }

  /**
   * Encrypt sensitive data (API keys, passwords)
   */
  static encrypt(plaintext: string, password: string = this.getMachineKey()): string {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: salt:iv:authTag:ciphertext
    return [salt.toString('hex'), iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(ciphertext: string, password: string = this.getMachineKey()): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];

    const key = this.deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if a string is encrypted
   */
  static isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    return parts.length === 4 && parts.every((p) => /^[0-9a-f]+$/.test(p));
  }

  /**
   * Generate a secure random API key
   */
  static generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Best-effort wipe of a Buffer holding a secret. JavaScript strings are
   * immutable, so the previous string-based version of this method was a
   * no-op — callers that care about clearing secret material must hold it
   * in a Buffer and pass that Buffer here.
   */
  static wipeBuffer(buf: Buffer): void {
    if (!buf || buf.length === 0) return;
    buf.fill(0);
  }
}

/**
 * Secure storage for sensitive configuration
 */
export class SecureStorage {
  private static readonly SECURE_FIELDS = ['apiKey', 'password', 'snmpCommunity'];

  /**
   * Encrypt sensitive fields in configuration
   */
  static encryptConfig(config: any): any {
    const encrypted = JSON.parse(JSON.stringify(config));

    // Encrypt API key
    if (encrypted.api?.apiKey && !CryptoManager.isEncrypted(encrypted.api.apiKey)) {
      encrypted.api.apiKey = CryptoManager.encrypt(encrypted.api.apiKey);
    }

    // Encrypt device passwords
    if (encrypted.devices) {
      for (const device of encrypted.devices) {
        if (device.password && !CryptoManager.isEncrypted(device.password)) {
          device.password = CryptoManager.encrypt(device.password);
        }
        if (device.snmpCommunity && !CryptoManager.isEncrypted(device.snmpCommunity)) {
          device.snmpCommunity = CryptoManager.encrypt(device.snmpCommunity);
        }
      }
    }

    return encrypted;
  }

  /**
   * Decrypt sensitive fields in configuration
   */
  static decryptConfig(config: any): any {
    const decrypted = JSON.parse(JSON.stringify(config));

    // Decrypt API key
    if (decrypted.api?.apiKey && CryptoManager.isEncrypted(decrypted.api.apiKey)) {
      decrypted.api.apiKey = CryptoManager.decrypt(decrypted.api.apiKey);
    }

    // Decrypt device passwords
    if (decrypted.devices) {
      for (const device of decrypted.devices) {
        if (device.password && CryptoManager.isEncrypted(device.password)) {
          device.password = CryptoManager.decrypt(device.password);
        }
        if (device.snmpCommunity && CryptoManager.isEncrypted(device.snmpCommunity)) {
          device.snmpCommunity = CryptoManager.decrypt(device.snmpCommunity);
        }
      }
    }

    return decrypted;
  }
}
