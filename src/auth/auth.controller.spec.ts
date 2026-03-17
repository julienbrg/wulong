import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { SiweService } from './siwe.service';

describe('AuthController', () => {
  let authController: AuthController;
  let siweService: SiweService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [SiweService],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    siweService = module.get<SiweService>(SiweService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  it('should have SiweService injected', () => {
    expect(siweService).toBeDefined();
  });

  describe('generateNonce', () => {
    it('should generate a nonce', () => {
      const result = authController.generateNonce();

      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('issuedAt');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBe(64); // 32 bytes hex = 64 chars
    });

    it('should generate unique nonces', () => {
      const nonce1 = authController.generateNonce();
      const nonce2 = authController.generateNonce();

      expect(nonce1.nonce).not.toBe(nonce2.nonce);
    });

    it('should set expiration to 5 minutes from issuedAt', () => {
      const result = authController.generateNonce();
      const issuedAt = new Date(result.issuedAt);
      const expiresAt = new Date(result.expiresAt);
      const diffMs = expiresAt.getTime() - issuedAt.getTime();

      expect(diffMs).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('verify', () => {
    it('should return success false for invalid signature', async () => {
      const result = await authController.verify({
        message: 'invalid message',
        signature: '0xinvalid',
      });

      expect(result.success).toBe(false);
      expect(result.address).toBeNull();
    });

    it('should return success false for message without valid nonce', async () => {
      const result = await authController.verify({
        message:
          'localhost wants you to sign in with your Ethereum account:\n0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\n\n\nURI: https://localhost:3000\nVersion: 1\nChain ID: 1\nNonce: invalid-nonce\nIssued At: 2026-03-17T16:49:38.495Z',
        signature:
          '0x45b04def8150c21468dc656bfa1c25cb029fef8cee4895b371412a6a0e48e9174722873b6f4a070f1f3a6731ac5dd91d02b236465c14859e8793bbfb2b3ad94e1b',
      });

      expect(result.success).toBe(false);
      expect(result.address).toBeNull();
    });
  });
});
