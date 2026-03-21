import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MlKemEncryptionService } from './mlkem-encryption.service';

describe('MlKemEncryptionService', () => {
  let service: MlKemEncryptionService;
  let configService: ConfigService;

  // Generate test keys with correct sizes: 1568 bytes (public) and 3168 bytes (private)
  const validPublicKey = Buffer.from(new Uint8Array(1568).fill(1)).toString(
    'base64',
  );
  const validPrivateKey = Buffer.from(new Uint8Array(3168).fill(2)).toString(
    'base64',
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MlKemEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ADMIN_MLKEM_PUBLIC_KEY') return validPublicKey;
              if (key === 'ADMIN_MLKEM_PRIVATE_KEY') return validPrivateKey;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MlKemEncryptionService>(MlKemEncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize with valid keys', async () => {
      await service.onModuleInit();
      expect(service.isAvailable()).toBe(true);
    });

    it('should warn when keys are not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ML-KEM keys not configured'),
      );
      expect(service.isAvailable()).toBe(false);
    });

    it('should throw error for invalid public key size', async () => {
      const invalidPublicKey = Buffer.from('invalid').toString('base64');
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string) =>
          key === 'ADMIN_MLKEM_PUBLIC_KEY' ? invalidPublicKey : validPrivateKey,
        );

      await expect(service.onModuleInit()).rejects.toThrow(
        'Invalid ML-KEM-1024 public key size',
      );
    });

    it('should throw error for invalid private key size', async () => {
      const invalidPrivateKey = Buffer.from('invalid').toString('base64');
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string) =>
          key === 'ADMIN_MLKEM_PRIVATE_KEY'
            ? invalidPrivateKey
            : validPublicKey,
        );

      await expect(service.onModuleInit()).rejects.toThrow(
        'Invalid ML-KEM-1024 private key size',
      );
    });
  });

  describe('getPublicKey', () => {
    it('should return null when not initialized', () => {
      expect(service.getPublicKey()).toBeNull();
    });

    it('should return base64 public key when initialized', async () => {
      await service.onModuleInit();
      const publicKey = service.getPublicKey();
      expect(publicKey).toBe(validPublicKey);
    });
  });

  describe('isAvailable', () => {
    it('should return false when not initialized', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await service.onModuleInit();
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should encrypt and generate proper structure', () => {
      const plaintext = 'secret message';

      const encrypted = service.encrypt(plaintext);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');

      // Verify ciphertext is correct size (1568 bytes for ML-KEM-1024)
      const ciphertextBuffer = Buffer.from(encrypted.ciphertext, 'base64');
      expect(ciphertextBuffer.length).toBe(1568);
    });

    it('should encrypt different data differently', () => {
      const plaintext1 = 'message 1';
      const plaintext2 = 'message 2';

      const encrypted1 = service.encrypt(plaintext1);
      const encrypted2 = service.encrypt(plaintext2);

      // Different ciphertexts should be generated
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should throw error when encrypting without initialization', () => {
      const uninitializedService = new MlKemEncryptionService(configService);
      expect(() => uninitializedService.encrypt('test')).toThrow(
        'ML-KEM encryption not initialized',
      );
    });

    it('should throw error when decrypting without initialization', () => {
      const uninitializedService = new MlKemEncryptionService(configService);
      const mockPayload = {
        ciphertext: 'test',
        encryptedData: 'test',
        iv: 'test',
        authTag: 'test',
      };
      expect(() => uninitializedService.decrypt(mockPayload)).toThrow(
        'ML-KEM encryption not initialized',
      );
    });

    it('should throw error for invalid ciphertext size', () => {
      const invalidPayload = {
        ciphertext: Buffer.from('invalid').toString('base64'),
        encryptedData: Buffer.from('data').toString('base64'),
        iv: Buffer.from('123456789012').toString('base64'),
        authTag: Buffer.from('1234567890123456').toString('base64'),
      };

      expect(() => service.decrypt(invalidPayload)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should throw error for tampering with encrypted data', () => {
      const encrypted = service.encrypt('test');
      // Tamper with encrypted data
      encrypted.encryptedData = Buffer.from('corrupted').toString('base64');

      // Decryption should fail due to tampering
      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it('should throw error for tampering with auth tag', () => {
      const encrypted = service.encrypt('test');
      // Tamper with auth tag
      encrypted.authTag = Buffer.from('0000000000000000').toString('base64');

      // Decryption should fail due to tampering
      expect(() => service.decrypt(encrypted)).toThrow();
    });
  });
});
