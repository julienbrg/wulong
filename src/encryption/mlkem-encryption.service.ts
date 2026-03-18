import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMlKem1024 } from 'mlkem';
import * as crypto from 'crypto';

/**
 * ML-KEM (Kyber) quantum-resistant encryption service
 *
 * This service provides post-quantum encryption/decryption using ML-KEM-1024 (NIST FIPS 203).
 *
 * Architecture:
 * 1. Client encapsulates with admin's public key → generates shared secret
 * 2. Client encrypts data with AES-256-GCM using shared secret
 * 3. Client sends { ciphertext, encryptedData, iv, authTag }
 * 4. Server decapsulates ciphertext with private key → recovers shared secret
 * 5. Server decrypts data with AES-256-GCM
 */

export interface EncryptedPayload {
  ciphertext: string; // ML-KEM ciphertext (base64)
  encryptedData: string; // AES-256-GCM encrypted data (base64)
  iv: string; // Initialization vector (base64)
  authTag: string; // GCM authentication tag (base64)
}

@Injectable()
export class MlKemEncryptionService {
  private readonly logger = new Logger(MlKemEncryptionService.name);
  private mlkem: Awaited<ReturnType<typeof createMlKem1024>> | null = null;
  private publicKey: Uint8Array | null = null;
  private privateKey: Uint8Array | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the ML-KEM instance and load keys
   */
  async onModuleInit() {
    this.logger.log('Initializing ML-KEM-1024 encryption service...');

    // Create ML-KEM instance
    this.mlkem = await createMlKem1024();

    // Load keys from environment
    const publicKeyBase64 = this.configService.get<string>(
      'ADMIN_MLKEM_PUBLIC_KEY',
    );
    const privateKeyBase64 = this.configService.get<string>(
      'ADMIN_MLKEM_PRIVATE_KEY',
    );

    if (!publicKeyBase64 || !privateKeyBase64) {
      this.logger.warn(
        'ML-KEM keys not configured. Run: pnpm ts-node scripts/generate-admin-keypair.ts',
      );
      return;
    }

    try {
      this.publicKey = Buffer.from(publicKeyBase64, 'base64');
      this.privateKey = Buffer.from(privateKeyBase64, 'base64');

      // Validate key sizes
      if (this.publicKey.length !== 1568) {
        throw new Error(
          `Invalid ML-KEM-1024 public key size: ${this.publicKey.length} (expected 1568)`,
        );
      }
      if (this.privateKey.length !== 3168) {
        throw new Error(
          `Invalid ML-KEM-1024 private key size: ${this.privateKey.length} (expected 3168)`,
        );
      }

      this.logger.log('✅ ML-KEM-1024 keys loaded successfully');
      this.logger.log(
        `Public key: ${publicKeyBase64.substring(0, 32)}... (${this.publicKey.length} bytes)`,
      );
    } catch (error) {
      this.logger.error('Failed to load ML-KEM keys:', error);
      throw error;
    }
  }

  /**
   * Get the admin's public key for client-side encryption
   */
  getPublicKey(): string | null {
    if (!this.publicKey) {
      return null;
    }
    return Buffer.from(this.publicKey).toString('base64');
  }

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return this.mlkem !== null && this.privateKey !== null;
  }

  /**
   * Decrypt an encrypted payload
   *
   * @param payload - Encrypted payload from client
   * @returns Decrypted plaintext
   */
  decrypt(payload: EncryptedPayload): string {
    if (!this.mlkem || !this.privateKey) {
      throw new Error('ML-KEM encryption not initialized');
    }

    try {
      // Decode from base64
      const ciphertext = Buffer.from(payload.ciphertext, 'base64');
      const encryptedData = Buffer.from(payload.encryptedData, 'base64');
      const iv = Buffer.from(payload.iv, 'base64');
      const authTag = Buffer.from(payload.authTag, 'base64');

      // Validate sizes
      if (ciphertext.length !== 1568) {
        throw new Error(
          `Invalid ML-KEM ciphertext size: ${ciphertext.length} (expected 1568)`,
        );
      }

      // Decapsulate to recover shared secret
      const sharedSecret = this.mlkem.decap(ciphertext, this.privateKey);

      // Decrypt data with AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data', { cause: error });
    }
  }

  /**
   * Encrypt data (for testing purposes)
   * In production, encryption should happen on the client side
   */
  encrypt(plaintext: string): EncryptedPayload {
    if (!this.mlkem || !this.publicKey) {
      throw new Error('ML-KEM encryption not initialized');
    }

    try {
      // Encapsulate with public key to generate shared secret
      const [ciphertext, sharedSecret] = this.mlkem.encap(this.publicKey);

      // Generate random IV
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM

      // Encrypt data with AES-256-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);
      let encrypted = cipher.update(plaintext, 'utf-8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();

      return {
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        encryptedData: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data', { cause: error });
    }
  }
}
