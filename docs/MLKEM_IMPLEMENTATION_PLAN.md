# ML-KEM Bilateral Encryption Implementation Plan

## Overview

This document describes the implementation plan for **bilateral ML-KEM encryption** in Wulong, enabling:

1. **Client-side encryption** with user's ML-KEM wallet keys
2. **Server-side decryption & processing** with server's ML-KEM keys in TEE
3. **Encrypted responses** that only the client can decrypt

This provides **quantum-resistant, end-to-end encryption** where the server can process data but cannot impersonate the client, and admins cannot decrypt stored secrets.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Client (w3pk wallet with ML-KEM support)                     │
│                                                              │
│ Step 1: Generate ML-KEM-1024 keypair                        │
│   • Client public key (1568 bytes)                          │
│   • Client private key (3168 bytes) - encrypted with passkey│
│                                                              │
│ Step 2: Get server attestation                              │
│   GET /chest/attestation                                    │
│   • Verify measurement (code integrity)                     │
│   • Get server's ML-KEM public key                          │
│                                                              │
│ Step 3: Encrypt secret for server                           │
│   • Encapsulate with server's public key                    │
│   • Encrypt data with AES-256-GCM                           │
│   • Include client's public key in payload                  │
│                                                              │
│ Step 4: Store encrypted secret                              │
│   POST /chest/store                                         │
│   {                                                          │
│     secret: {                                               │
│       ciphertext: "...",      // ML-KEM ciphertext          │
│       encryptedData: "...",   // AES-encrypted secret       │
│       iv: "...",              // AES IV                     │
│       authTag: "..."          // AES-GCM auth tag           │
│     },                                                       │
│     clientPublicKey: "...",   // For encrypted responses    │
│     publicAddresses: ["0x..."] // SIWE authorization        │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Wulong TEE Service                                           │
│                                                              │
│ /chest/store:                                                │
│   1. Receive encrypted payload + client public key          │
│   2. Validate ML-KEM ciphertext size (1568 bytes)           │
│   3. Store encrypted data (quantum-safe at rest)            │
│   4. Associate client public key with slot                  │
│                                                              │
│ /chest/access/{slot}:                                        │
│   1. Verify SIWE authentication                             │
│   2. Check caller is authorized owner                       │
│   3. Decrypt with server's ML-KEM private key:              │
│      • Decapsulate ciphertext → shared secret               │
│      • Decrypt AES-256-GCM → plaintext secret               │
│   4. Process/use the secret (application logic)             │
│   5. Re-encrypt response for client:                        │
│      • Encapsulate with client's public key                 │
│      • Encrypt response with AES-256-GCM                    │
│   6. Return encrypted response                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Client (w3pk wallet)                                         │
│                                                              │
│ Step 5: Receive encrypted response                          │
│   GET /chest/access/{slot}                                  │
│   {                                                          │
│     secret: {                                               │
│       ciphertext: "...",                                    │
│       encryptedData: "...",                                 │
│       iv: "...",                                            │
│       authTag: "..."                                        │
│     }                                                        │
│   }                                                          │
│                                                              │
│ Step 6: Decrypt response                                    │
│   • Decapsulate with client's private key → shared secret   │
│   • Decrypt AES-256-GCM → plaintext                         │
│   • Use secret data                                         │
└──────────────────────────────────────────────────────────────┘
```

## Security Properties

### Quantum Resistance
- ✅ **ML-KEM-1024** (NIST FIPS 203) - Post-quantum secure
- ✅ **AES-256-GCM** - 128-bit quantum security (sufficient)
- ✅ **No RSA/ECDSA** in encryption layer - All quantum-resistant

### Trust Model
- ✅ **TEE Attestation** - Cryptographic proof of code integrity
- ✅ **Admin cannot decrypt** - ML-KEM private keys only in TEE memory
- ✅ **Server cannot impersonate client** - Only client has their private key
- ✅ **Forward secrecy** - Each encryption uses unique shared secret
- ✅ **Data at rest** - Stored encrypted with ML-KEM

### Attack Resistance
| Attack Vector | Mitigation |
|---------------|------------|
| Admin reads storage | ✅ Data encrypted with ML-KEM, admin doesn't have private key |
| Quantum computer | ✅ ML-KEM-1024 is quantum-resistant |
| Man-in-the-middle | ✅ TEE attestation verifies server identity |
| Replay attacks | ✅ SIWE nonces prevent replay |
| Side-channel | ⚠️ TEE provides isolation (see SIDE_CHANNEL_ATTACKS.md) |

## Implementation Phases

### Phase 1: w3pk ML-KEM Helpers (1-2 weeks)

**Owner:** w3pk maintainer
**Goal:** Add ML-KEM encryption capabilities to w3pk SDK

#### 1.1 Add ML-KEM Dependency

```bash
# In w3pk repository
pnpm add mlkem
```

#### 1.2 Implement ML-KEM Key Management

**File:** `src/crypto/mlkem.ts` (new file in w3pk)

```typescript
import { createMlKem1024 } from 'mlkem';

export interface MLKEMKeyPair {
  publicKey: Uint8Array;  // 1568 bytes
  privateKey: Uint8Array; // 3168 bytes
}

export interface EncryptedPayload {
  ciphertext: string;     // Base64 ML-KEM ciphertext
  encryptedData: string;  // Base64 AES-encrypted data
  iv: string;             // Base64 IV
  authTag: string;        // Base64 auth tag
}

/**
 * Generate ML-KEM-1024 keypair for the user
 */
export async function generateMLKEMKeypair(): Promise<MLKEMKeyPair> {
  const mlkem = await createMlKem1024();
  const [publicKey, privateKey] = mlkem.keygen();

  return {
    publicKey,
    privateKey,
  };
}

/**
 * Encrypt data for a recipient's ML-KEM public key
 */
export async function encryptForRecipient(
  plaintext: string,
  recipientPublicKey: string | Uint8Array
): Promise<EncryptedPayload> {
  const mlkem = await createMlKem1024();

  // Convert to Uint8Array if base64 string
  const publicKeyBytes = typeof recipientPublicKey === 'string'
    ? Buffer.from(recipientPublicKey, 'base64')
    : recipientPublicKey;

  // Validate public key size
  if (publicKeyBytes.length !== 1568) {
    throw new Error(`Invalid ML-KEM public key size: ${publicKeyBytes.length} (expected 1568)`);
  }

  // Encapsulate to generate shared secret
  const [ciphertext, sharedSecret] = mlkem.encap(publicKeyBytes);

  // Encrypt data with AES-256-GCM using shared secret
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const key = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Extract auth tag (last 16 bytes)
  const encryptedArray = new Uint8Array(encrypted);
  const encryptedData = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);

  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    encryptedData: Buffer.from(encryptedData).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    authTag: Buffer.from(authTag).toString('base64'),
  };
}

/**
 * Decrypt data encrypted for this user
 */
export async function decryptWithPrivateKey(
  payload: EncryptedPayload,
  privateKey: Uint8Array
): Promise<string> {
  const mlkem = await createMlKem1024();

  // Decode from base64
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const encryptedData = Buffer.from(payload.encryptedData, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');

  // Validate ciphertext size
  if (ciphertext.length !== 1568) {
    throw new Error(`Invalid ML-KEM ciphertext size: ${ciphertext.length} (expected 1568)`);
  }

  // Validate private key size
  if (privateKey.length !== 3168) {
    throw new Error(`Invalid ML-KEM private key size: ${privateKey.length} (expected 3168)`);
  }

  // Decapsulate to recover shared secret
  const sharedSecret = mlkem.decap(ciphertext, privateKey);

  // Decrypt with AES-256-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Reconstruct encrypted data with auth tag
  const encryptedWithTag = new Uint8Array(encryptedData.length + authTag.length);
  encryptedWithTag.set(encryptedData, 0);
  encryptedWithTag.set(authTag, encryptedData.length);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedWithTag
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed: Invalid ciphertext or key', { cause: error });
  }
}
```

#### 1.3 Integrate into Web3Passkey Class

**File:** `src/wallet/web3-passkey.ts` (existing file in w3pk)

```typescript
import { generateMLKEMKeypair, encryptForRecipient, decryptWithPrivateKey, type MLKEMKeyPair, type EncryptedPayload } from '../crypto/mlkem';

export class Web3Passkey {
  private mlkemKeyPair: MLKEMKeyPair | null = null;

  /**
   * Initialize ML-KEM keypair for quantum-resistant encryption
   */
  async initializeMLKEM(): Promise<void> {
    // Check if keypair already exists in secure storage
    const stored = await this.secureStorage.get('mlkem-keypair');

    if (stored) {
      this.mlkemKeyPair = JSON.parse(stored);
    } else {
      // Generate new keypair
      this.mlkemKeyPair = await generateMLKEMKeypair();

      // Store encrypted with passkey
      const encrypted = await this.secureStorage.encrypt(
        JSON.stringify(this.mlkemKeyPair),
        'mlkem-keypair'
      );
      await this.secureStorage.set('mlkem-keypair', encrypted);
    }
  }

  /**
   * Get user's ML-KEM public key (for receiving encrypted data)
   */
  getMLKEMPublicKey(): string {
    if (!this.mlkemKeyPair) {
      throw new Error('ML-KEM not initialized. Call initializeMLKEM() first.');
    }
    return Buffer.from(this.mlkemKeyPair.publicKey).toString('base64');
  }

  /**
   * Encrypt data for a server/recipient
   */
  async encryptForServer(
    data: string,
    serverPublicKey: string
  ): Promise<EncryptedPayload> {
    return encryptForRecipient(data, serverPublicKey);
  }

  /**
   * Decrypt data sent to this user
   */
  async decryptResponse(payload: EncryptedPayload): Promise<string> {
    if (!this.mlkemKeyPair) {
      throw new Error('ML-KEM not initialized. Call initializeMLKEM() first.');
    }
    return decryptWithPrivateKey(payload, this.mlkemKeyPair.privateKey);
  }
}
```

#### 1.4 Add to w3pk Public API

**File:** `src/index.ts` (existing file in w3pk)

```typescript
// Export ML-KEM utilities
export {
  generateMLKEMKeypair,
  encryptForRecipient,
  decryptWithPrivateKey,
  type MLKEMKeyPair,
  type EncryptedPayload,
} from './crypto/mlkem';
```

#### 1.5 Update w3pk Documentation

**File:** `docs/POST_QUANTUM.md` (existing file in w3pk)

Add section:

```markdown
## ML-KEM Encryption (Available Now)

w3pk now supports ML-KEM-1024 encryption for quantum-resistant data protection:

```typescript
import { createWeb3Passkey } from 'w3pk';

const w3pk = createWeb3Passkey();
await w3pk.login();

// Initialize ML-KEM
await w3pk.initializeMLKEM();

// Get your public key to share with servers
const myPublicKey = w3pk.getMLKEMPublicKey();

// Encrypt data for a server
const encrypted = await w3pk.encryptForServer(
  'my secret data',
  serverPublicKey
);

// Decrypt responses from server
const decrypted = await w3pk.decryptResponse(encryptedPayload);
```
```

### Phase 2: Wulong Server Implementation (1 week)

**Owner:** Wulong maintainer
**Goal:** Implement bilateral ML-KEM encryption on server side

#### 2.1 Update DTOs

**File:** `src/secret/dto/store-request.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class EncryptedPayloadDto {
  @ApiProperty({
    description: 'ML-KEM-1024 ciphertext (base64, 1568 bytes when decoded)',
    example: 'k3VARNFcS4hWl6AfR0DMylys...',
  })
  @IsString()
  @IsNotEmpty()
  ciphertext: string;

  @ApiProperty({
    description: 'AES-256-GCM encrypted data (base64)',
    example: 'J8kl2mN9oP3qR...',
  })
  @IsString()
  @IsNotEmpty()
  encryptedData: string;

  @ApiProperty({
    description: 'AES-256-GCM initialization vector (base64, 12 bytes)',
    example: 'Xy9Zb1cA...',
  })
  @IsString()
  @IsNotEmpty()
  iv: string;

  @ApiProperty({
    description: 'AES-256-GCM authentication tag (base64, 16 bytes)',
    example: 'Mn4Op8Qr...',
  })
  @IsString()
  @IsNotEmpty()
  authTag: string;
}

export class StoreRequestDto {
  @ApiProperty({
    description: 'Encrypted secret payload (ML-KEM + AES-256-GCM)',
    type: EncryptedPayloadDto,
  })
  @ValidateNested()
  @Type(() => EncryptedPayloadDto)
  secret: EncryptedPayloadDto;

  @ApiProperty({
    description: "Client's ML-KEM public key for encrypted responses (base64, 1568 bytes)",
    example: 'hdGVzdF9wdWJsaWNfa2V5X2hlcmU...',
  })
  @IsString()
  @IsNotEmpty()
  clientPublicKey: string;

  @ApiProperty({
    description: 'Ethereum addresses allowed to access this secret',
    example: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  publicAddresses: string[];
}
```

**File:** `src/secret/dto/access-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

class EncryptedPayloadDto {
  @ApiProperty({
    description: 'ML-KEM-1024 ciphertext (base64, 1568 bytes when decoded)',
  })
  ciphertext: string;

  @ApiProperty({
    description: 'AES-256-GCM encrypted data (base64)',
  })
  encryptedData: string;

  @ApiProperty({
    description: 'AES-256-GCM initialization vector (base64, 12 bytes)',
  })
  iv: string;

  @ApiProperty({
    description: 'AES-256-GCM authentication tag (base64, 16 bytes)',
  })
  authTag: string;
}

export class AccessResponseDto {
  @ApiProperty({
    description: 'Encrypted secret (encrypted with client\'s ML-KEM public key)',
    type: EncryptedPayloadDto,
  })
  secret: EncryptedPayloadDto;
}
```

#### 2.2 Update Secret Service

**File:** `src/secret/secret.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { isAddress } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { TeePlatformService } from '../attestation/tee-platform.service';
import { MlKemEncryptionService, EncryptedPayload } from '../encryption/mlkem-encryption.service';
import { AttestationResponseDto } from './dto/attestation-response.dto';

interface SecretEntry {
  encryptedSecret: EncryptedPayload; // Stored encrypted
  clientPublicKey: string;           // For encrypting responses
  publicAddresses: string[];
}

interface SecretData {
  [slot: string]: SecretEntry;
}

@Injectable()
export class SecretService {
  private readonly secretPath: string;

  constructor(
    private readonly teePlatformService: TeePlatformService,
    private readonly mlkemEncryptionService: MlKemEncryptionService,
  ) {
    this.secretPath = path.join(process.cwd(), 'chest.json');
  }

  /**
   * Stores an encrypted secret
   */
  async store(
    encryptedSecret: EncryptedPayload,
    clientPublicKey: string,
    publicAddresses: string[],
  ): Promise<string> {
    // Validate ML-KEM encryption is available
    if (!this.mlkemEncryptionService.isAvailable()) {
      throw new BadRequestException(
        'ML-KEM encryption not configured on server. Contact administrator.',
      );
    }

    // Validate client public key size (1568 bytes for ML-KEM-1024)
    const clientPubKeyBytes = Buffer.from(clientPublicKey, 'base64');
    if (clientPubKeyBytes.length !== 1568) {
      throw new BadRequestException(
        `Invalid client ML-KEM public key size: ${clientPubKeyBytes.length} (expected 1568)`,
      );
    }

    // Validate ciphertext size
    const ciphertextBytes = Buffer.from(encryptedSecret.ciphertext, 'base64');
    if (ciphertextBytes.length !== 1568) {
      throw new BadRequestException(
        `Invalid ML-KEM ciphertext size: ${ciphertextBytes.length} (expected 1568)`,
      );
    }

    // Validate addresses
    if (!publicAddresses || publicAddresses.length === 0) {
      throw new BadRequestException('At least one public address must be provided');
    }

    for (const address of publicAddresses) {
      if (!isAddress(address)) {
        throw new BadRequestException(`Invalid Ethereum address: ${String(address)}`);
      }
    }

    // Normalize addresses
    const normalizedAddresses = publicAddresses.map((addr) => addr.toLowerCase());

    // Generate unique slot
    const slot = this.generateSlot();

    // Load existing data
    const secretData = await this.loadSecret();

    // Store encrypted entry (data remains encrypted at rest)
    secretData[slot] = {
      encryptedSecret,
      clientPublicKey,
      publicAddresses: normalizedAddresses,
    };

    // Save to file
    await this.saveSecret(secretData);

    return slot;
  }

  /**
   * Accesses a secret and returns it encrypted for the client
   */
  async access(slot: string, callerAddress: string): Promise<EncryptedPayload> {
    if (!slot || slot.trim().length === 0) {
      throw new BadRequestException('Slot cannot be empty');
    }

    if (!callerAddress || !isAddress(callerAddress)) {
      throw new BadRequestException('Invalid caller address');
    }

    if (!this.mlkemEncryptionService.isAvailable()) {
      throw new BadRequestException('ML-KEM encryption not configured on server');
    }

    // Load secret data
    const secretData = await this.loadSecret();

    // Check if slot exists
    const entry = secretData[slot];
    if (!entry) {
      throw new NotFoundException(`Slot not found: ${slot}`);
    }

    // Normalize caller address
    const normalizedCaller = callerAddress.toLowerCase();

    // Check if caller is an owner
    if (!entry.publicAddresses.includes(normalizedCaller)) {
      throw new ForbiddenException(
        'Access denied: caller is not an owner of this secret',
      );
    }

    // Decrypt the stored secret (server-side processing)
    let plaintextSecret: string;
    try {
      plaintextSecret = this.mlkemEncryptionService.decrypt(entry.encryptedSecret);
    } catch (error) {
      throw new BadRequestException(
        `Failed to decrypt secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // TODO: Process the secret here (e.g., use it, transform it, etc.)
    // For now, we just re-encrypt and return it
    const processedSecret = plaintextSecret;

    // Re-encrypt for the client using their public key
    const clientPublicKeyBytes = Buffer.from(entry.clientPublicKey, 'base64');

    try {
      // Encrypt the response for the client
      const encryptedResponse = this.mlkemEncryptionService.encryptForRecipient(
        processedSecret,
        clientPublicKeyBytes,
      );

      return encryptedResponse;
    } catch (error) {
      throw new BadRequestException(
        `Failed to encrypt response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getAttestation(): Promise<AttestationResponseDto> {
    const attestation = await this.teePlatformService.generateAttestationReport();
    const mlkemPublicKey = this.mlkemEncryptionService.getPublicKey();

    return {
      platform: attestation.platform,
      report: attestation.report,
      measurement: attestation.measurement,
      timestamp: attestation.timestamp,
      publicKey: attestation.publicKey,
      mlkemPublicKey: mlkemPublicKey || undefined,
    };
  }

  private generateSlot(): string {
    return randomBytes(32).toString('hex');
  }

  private async loadSecret(): Promise<SecretData> {
    try {
      if (!fs.existsSync(this.secretPath)) {
        return {};
      }
      const data = await fs.promises.readFile(this.secretPath, 'utf-8');
      return JSON.parse(data) as SecretData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new Error(
        `Failed to load secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    }
  }

  private async saveSecret(data: SecretData): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.secretPath,
        JSON.stringify(data, null, 2),
        'utf-8',
      );
    } catch (error) {
      throw new Error(
        `Failed to save secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    }
  }
}
```

#### 2.3 Add Encryption Helper to ML-KEM Service

**File:** `src/encryption/mlkem-encryption.service.ts`

Add new method:

```typescript
/**
 * Encrypt data for a recipient's public key
 * (Used for encrypting responses to clients)
 */
encryptForRecipient(plaintext: string, recipientPublicKey: Uint8Array): EncryptedPayload {
  if (!this.mlkem) {
    throw new Error('ML-KEM encryption not initialized');
  }

  // Validate public key size
  if (recipientPublicKey.length !== 1568) {
    throw new Error(
      `Invalid ML-KEM public key size: ${recipientPublicKey.length} (expected 1568)`,
    );
  }

  try {
    // Encapsulate with recipient's public key
    const [ciphertext, sharedSecret] = this.mlkem.encap(recipientPublicKey);

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
    this.logger.error('Encryption for recipient failed:', error);
    throw new Error('Failed to encrypt data for recipient', { cause: error });
  }
}
```

#### 2.4 Update Controller

**File:** `src/secret/secret.controller.ts`

```typescript
@Post('store')
@ApiOperation({
  summary: 'Store an encrypted secret',
  description:
    'Stores a secret encrypted with ML-KEM-1024. The secret must be encrypted ' +
    'with the server\'s ML-KEM public key (obtained from /chest/attestation). ' +
    'Include your client ML-KEM public key for receiving encrypted responses.',
})
@ApiResponse({
  status: 201,
  description: 'Secret stored successfully',
  type: StoreResponseDto,
})
async store(@Body() dto: StoreRequestDto): Promise<StoreResponseDto> {
  const slot = await this.secretService.store(
    dto.secret,
    dto.clientPublicKey,
    dto.publicAddresses,
  );
  return { slot };
}

@Get('access/:slot')
@UseGuards(SiweGuard)
@ApiSecurity('SIWE')
@ApiOperation({
  summary: 'Access a secret',
  description:
    'Retrieves a secret encrypted with your ML-KEM public key. ' +
    'You must decrypt the response with your ML-KEM private key.',
})
@ApiResponse({
  status: 200,
  description: 'Encrypted secret (decrypt with your ML-KEM private key)',
  type: AccessResponseDto,
})
async access(
  @Param('slot') slot: string,
  @Req() req: { user: { address: string } },
): Promise<AccessResponseDto> {
  const encryptedSecret = await this.secretService.access(slot, req.user.address);
  return { secret: encryptedSecret };
}
```

### Phase 3: Testing & Documentation (1 week)

#### 3.1 Unit Tests

**File:** `src/secret/secret.service.spec.ts`

Add tests for:
- Storing encrypted secrets with client public key
- Validating ML-KEM payload sizes
- Decrypting and re-encrypting responses
- Error handling for invalid keys

#### 3.2 Integration Tests

**File:** `test/mlkem-bilateral.e2e-spec.ts` (new file)

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createMlKem1024 } from 'mlkem';
import { AppModule } from '../src/app.module';

describe('ML-KEM Bilateral Encryption (e2e)', () => {
  let app: INestApplication;
  let serverPublicKey: string;
  let clientMlkem: any;
  let clientPublicKey: Uint8Array;
  let clientPrivateKey: Uint8Array;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Generate client ML-KEM keypair
    clientMlkem = await createMlKem1024();
    [clientPublicKey, clientPrivateKey] = clientMlkem.keygen();

    // Get server's public key
    const attestation = await request(app.getHttpServer())
      .get('/chest/attestation')
      .expect(200);

    serverPublicKey = attestation.body.mlkemPublicKey;
    expect(serverPublicKey).toBeDefined();
  });

  it('should encrypt, store, and decrypt a secret end-to-end', async () => {
    // 1. Client encrypts secret for server
    const secret = 'my-quantum-safe-secret';
    const [ciphertext, sharedSecret] = clientMlkem.encap(
      Buffer.from(serverPublicKey, 'base64')
    );

    // Encrypt with AES-256-GCM
    // ... (full encryption logic)

    // 2. Store encrypted secret
    const storeResponse = await request(app.getHttpServer())
      .post('/chest/store')
      .send({
        secret: {
          ciphertext: Buffer.from(ciphertext).toString('base64'),
          encryptedData: '...',
          iv: '...',
          authTag: '...',
        },
        clientPublicKey: Buffer.from(clientPublicKey).toString('base64'),
        publicAddresses: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
      })
      .expect(201);

    const { slot } = storeResponse.body;

    // 3. Access secret (with SIWE auth)
    // ... (SIWE authentication)

    // 4. Decrypt response with client private key
    // ... (decryption logic)

    expect(decryptedSecret).toBe(secret);
  });
});
```

#### 3.3 Update CLIENT_ENCRYPTION.md

Replace existing content with bilateral encryption flow using w3pk.

#### 3.4 Create Example App

**File:** `examples/w3pk-bilateral-encryption/` (new directory)

Create a complete example showing:
1. w3pk wallet initialization with ML-KEM
2. Getting server attestation
3. Encrypting and storing secrets
4. SIWE authentication
5. Accessing and decrypting responses

## Migration Path

### For Existing Users (Phase 4)

**Goal:** Migrate plaintext secrets to ML-KEM encrypted storage

1. **Deprecation Notice** (Week 1)
   - Add warning to `/chest/store` API when accepting plaintext
   - Document migration deadline

2. **Dual-Mode Support** (Weeks 2-4)
   - Server accepts both plaintext and encrypted secrets
   - Plaintext stored with warning flag
   - Encrypted secrets marked as "quantum-safe"

3. **Migration Script** (Week 5)
   ```bash
   pnpm ts-node scripts/migrate-to-mlkem.ts
   ```
   - Re-encrypt existing plaintext secrets with server ML-KEM key
   - Prompt for client public keys to enable response encryption

4. **Deprecate Plaintext** (Week 6+)
   - Reject plaintext secrets
   - Require ML-KEM encryption for all new secrets

## Performance Considerations

### Encryption Overhead

| Operation | Time | Notes |
|-----------|------|-------|
| ML-KEM Keygen | ~0.5ms | One-time per user |
| ML-KEM Encap | ~1ms | Per encryption |
| ML-KEM Decap | ~1ms | Per decryption |
| AES-256-GCM | ~0.1ms/KB | Symmetric encryption |
| **Total per request** | **~2ms** | Negligible for API calls |

### Storage Overhead

- Ciphertext: 1568 bytes (ML-KEM)
- IV: 12 bytes
- Auth tag: 16 bytes
- Total overhead: ~1.6KB per secret (acceptable)

## Security Audit Checklist

- [ ] ML-KEM implementation uses official NIST parameters
- [ ] Random IV generation uses cryptographically secure source
- [ ] Private keys never logged or exposed
- [ ] Attestation measurement verification documented
- [ ] Side-channel attack mitigations reviewed
- [ ] Key rotation strategy defined
- [ ] Backup and recovery procedures tested
- [ ] Error messages don't leak sensitive information

## Success Metrics

1. **Security:**
   - ✅ 100% of secrets encrypted at rest with ML-KEM
   - ✅ Zero plaintext storage
   - ✅ Attestation verification in client library

2. **Performance:**
   - ✅ API latency increase <5ms
   - ✅ Client-side encryption <50ms

3. **Adoption:**
   - ✅ w3pk integration complete
   - ✅ Documentation with working examples
   - ✅ Migration path for existing users

## References

- [NIST FIPS 203 (ML-KEM)](https://csrc.nist.gov/pubs/fips/203/final)
- [mlkem npm package](https://www.npmjs.com/package/mlkem)
- [w3pk SDK](https://github.com/Web3-Wallet/web3-passkey-sdk)
- [Phala Network TEE Documentation](https://docs.phala.network/)

## Timeline

| Phase | Duration | Owner | Deliverables |
|-------|----------|-------|--------------|
| Phase 1: w3pk Helpers | 1-2 weeks | w3pk maintainer | ML-KEM crypto utilities, Web3Passkey integration |
| Phase 2: Wulong Server | 1 week | Wulong maintainer | Updated DTOs, service logic, controller |
| Phase 3: Testing & Docs | 1 week | Both | Unit tests, e2e tests, documentation |
| Phase 4: Migration | 6 weeks | Wulong maintainer | Migration script, dual-mode support |

**Total estimated time:** 9-10 weeks for complete implementation and migration.
