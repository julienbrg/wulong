import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SecretService } from './secret.service';
import { TeePlatformService } from '../attestation/tee-platform.service';
import { MlKemEncryptionService } from '../encryption/mlkem-encryption.service';
import * as fs from 'fs';
import * as path from 'path';
import * as ethers from 'ethers';

// Mock fs module with promises
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

// Mock ethers module
jest.mock('ethers', () => ({
  isAddress: jest.fn(),
}));

describe('SecretService', () => {
  let service: SecretService;
  const testChestPath = path.join(process.cwd(), 'chest.json');

  const mockTeePlatformService = {
    generateAttestationReport: jest.fn(),
    getPlatform: jest.fn(),
    isInTee: jest.fn(),
  };

  const mockMlKemEncryptionService = {
    decrypt: jest.fn(),
    encrypt: jest.fn(),
    getPublicKey: jest.fn(),
    isAvailable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretService,
        {
          provide: TeePlatformService,
          useValue: mockTeePlatformService,
        },
        {
          provide: MlKemEncryptionService,
          useValue: mockMlKemEncryptionService,
        },
      ],
    }).compile();

    service = module.get<SecretService>(SecretService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('store', () => {
    beforeEach(() => {
      // Mock fs.existsSync to return false (no existing chest.json)
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      // Mock fs.promises.writeFile
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();
      // Mock isAddress
      (ethers.isAddress as unknown as jest.Mock).mockImplementation(
        (address: string) => {
          if (typeof address !== 'string' || !address.startsWith('0x')) {
            return false;
          }
          const hexPart = address.slice(2);
          return hexPart.length === 40 && /^[0-9a-fA-F]+$/.test(hexPart);
        },
      );
    });

    it('should store a secret and return a slot', async () => {
      const secret = 'my-secret';
      const publicAddresses = ['0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c'];

      const slot = await service.store(secret, publicAddresses);

      expect(slot).toBeDefined();
      expect(typeof slot).toBe('string');
      expect(slot).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex = 64 chars
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        testChestPath,
        expect.any(String),
        'utf-8',
      );
    });

    it('should throw BadRequestException if secret is empty', async () => {
      await expect(
        service.store('', ['0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c']),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.store('   ', ['0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if publicAddresses is empty', async () => {
      await expect(service.store('my-secret', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid Ethereum address', async () => {
      await expect(
        service.store('my-secret', ['invalid-address']),
      ).rejects.toThrow(BadRequestException);

      await expect(service.store('my-secret', ['0x123'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept multiple valid Ethereum addresses', async () => {
      const secret = 'my-secret';
      const publicAddresses = [
        '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c',
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      ];

      const slot = await service.store(secret, publicAddresses);

      expect(slot).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should normalize addresses to lowercase', async () => {
      const secret = 'my-secret';
      const publicAddresses = ['0xBFBAA5A59E3B6C06AFF9C975092B8705F804FA1C'];

      await service.store(secret, publicAddresses);

      const writeCall = (fs.promises.writeFile as jest.Mock).mock
        .calls[0] as unknown[];
      const writtenData = JSON.parse(writeCall[1] as string) as Record<
        string,
        { secret: string; publicAddresses: string[] }
      >;
      const slots = Object.values(writtenData);

      expect(slots[0].publicAddresses[0]).toBe(
        '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c',
      );
    });

    it('should load existing chest data before storing', async () => {
      const existingData = {
        existingSlot: {
          secret: 'existing-secret',
          publicAddresses: ['0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c'],
        },
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest
        .spyOn(fs.promises, 'readFile')
        .mockResolvedValue(JSON.stringify(existingData));

      const secret = 'new-secret';
      const publicAddresses = ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'];

      await service.store(secret, publicAddresses);

      const writeCall = (fs.promises.writeFile as jest.Mock).mock
        .calls[0] as unknown[];
      const writtenData = JSON.parse(writeCall[1] as string) as Record<
        string,
        unknown
      >;

      // Should contain both old and new entries
      expect(Object.keys(writtenData)).toContain('existingSlot');
      expect(Object.keys(writtenData).length).toBe(2);
    });

    it('should throw error if file write fails', async () => {
      jest
        .spyOn(fs.promises, 'writeFile')
        .mockRejectedValue(new Error('Write error'));

      await expect(
        service.store('my-secret', [
          '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c',
        ]),
      ).rejects.toThrow('Failed to save secret');
    });
  });

  describe('access', () => {
    const testSlot = 'a'.repeat(64);
    const testAddress = '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c';
    const testSecret = 'my-secret';

    beforeEach(() => {
      const mockData = {
        [testSlot]: {
          secret: testSecret,
          publicAddresses: [testAddress.toLowerCase()],
        },
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest
        .spyOn(fs.promises, 'readFile')
        .mockResolvedValue(JSON.stringify(mockData));
      // Mock isAddress
      (ethers.isAddress as unknown as jest.Mock).mockImplementation(
        (address: string) => {
          if (typeof address !== 'string' || !address.startsWith('0x')) {
            return false;
          }
          const hexPart = address.slice(2);
          return hexPart.length === 40 && /^[0-9a-fA-F]+$/.test(hexPart);
        },
      );
    });

    it('should return secret if caller is owner', async () => {
      const secret = await service.access(testSlot, testAddress);

      expect(secret).toBe(testSecret);
    });

    it('should be case-insensitive for address comparison', async () => {
      const upperCaseAddress = '0xBFBAA5A59E3B6C06AFF9C975092B8705F804FA1C';
      const secret = await service.access(testSlot, upperCaseAddress);

      expect(secret).toBe(testSecret);
    });

    it('should throw BadRequestException if slot is empty', async () => {
      await expect(service.access('', testAddress)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.access('   ', testAddress)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if caller address is invalid', async () => {
      await expect(service.access(testSlot, 'invalid-address')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if slot does not exist', async () => {
      const nonExistentSlot = 'b'.repeat(64);

      await expect(
        service.access(nonExistentSlot, testAddress),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if caller is not an owner', async () => {
      const unauthorizedAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

      await expect(
        service.access(testSlot, unauthorizedAddress),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access if caller is one of multiple owners', async () => {
      const address1 = '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c';
      const address2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

      const mockData = {
        [testSlot]: {
          secret: testSecret,
          publicAddresses: [address1.toLowerCase(), address2.toLowerCase()],
        },
      };

      jest
        .spyOn(fs.promises, 'readFile')
        .mockResolvedValue(JSON.stringify(mockData));

      // Both owners should be able to access
      const secret1 = await service.access(testSlot, address1);
      expect(secret1).toBe(testSecret);

      const secret2 = await service.access(testSlot, address2);
      expect(secret2).toBe(testSecret);
    });

    it('should throw error if file read fails', async () => {
      jest
        .spyOn(fs.promises, 'readFile')
        .mockRejectedValue(new Error('Read error'));

      await expect(service.access(testSlot, testAddress)).rejects.toThrow(
        'Failed to load secret',
      );
    });

    it('should return empty object if chest.json does not exist', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(service.access(testSlot, testAddress)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      // Mock isAddress for all edge case tests
      (ethers.isAddress as unknown as jest.Mock).mockImplementation(
        (address: string) => {
          if (typeof address !== 'string' || !address.startsWith('0x')) {
            return false;
          }
          const hexPart = address.slice(2);
          return hexPart.length === 40 && /^[0-9a-fA-F]+$/.test(hexPart);
        },
      );
    });

    it('should handle checksummed Ethereum addresses', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

      // This is a checksummed address (mixed case)
      const checksummedAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

      const slot = await service.store('secret', [checksummedAddress]);

      expect(slot).toBeDefined();
    });

    it('should handle special characters in secrets', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

      const specialSecret = 'my-secret!@#$%^&*()_+{}[]|\\:";\'<>?,./';
      const slot = await service.store(specialSecret, [
        '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c',
      ]);

      expect(slot).toBeDefined();

      // Verify the secret was stored correctly
      const writeCall = (fs.promises.writeFile as jest.Mock).mock
        .calls[0] as unknown[];
      const writtenData = JSON.parse(writeCall[1] as string) as Record<
        string,
        { secret: string; publicAddresses: string[] }
      >;
      expect(writtenData[slot].secret).toBe(specialSecret);
    });

    it('should handle very long secrets', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

      const longSecret = 'a'.repeat(10000);
      const slot = await service.store(longSecret, [
        '0xbfbaa5a59e3b6c06aff9c975092b8705f804fa1c',
      ]);

      expect(slot).toBeDefined();
    });
  });

  describe('getAttestation', () => {
    it('should return attestation from TEE platform service', async () => {
      const mockAttestation = {
        platform: 'amd-sev-snp' as const,
        report: 'base64-encoded-attestation-report',
        measurement: 'abc123measurement',
        timestamp: '2026-03-18T10:30:00.000Z',
        publicKey: '0x1234567890abcdef',
      };

      mockTeePlatformService.generateAttestationReport.mockResolvedValue(
        mockAttestation,
      );

      const result = await service.getAttestation();

      expect(result).toEqual(mockAttestation);
      expect(
        mockTeePlatformService.generateAttestationReport,
      ).toHaveBeenCalledTimes(1);
    });

    it('should return Intel TDX attestation', async () => {
      const mockAttestation = {
        platform: 'intel-tdx' as const,
        report: 'tdx-quote-base64',
        measurement: 'def456measurement',
        timestamp: '2026-03-18T10:35:00.000Z',
      };

      mockTeePlatformService.generateAttestationReport.mockResolvedValue(
        mockAttestation,
      );

      const result = await service.getAttestation();

      expect(result.platform).toBe('intel-tdx');
      expect(result.report).toBe('tdx-quote-base64');
      expect(result.measurement).toBe('def456measurement');
    });

    it('should return AWS Nitro attestation', async () => {
      const mockAttestation = {
        platform: 'aws-nitro' as const,
        report: 'nitro-attestation-cbor-base64',
        measurement: 'PCR0_MEASUREMENT',
        timestamp: '2026-03-18T10:40:00.000Z',
      };

      mockTeePlatformService.generateAttestationReport.mockResolvedValue(
        mockAttestation,
      );

      const result = await service.getAttestation();

      expect(result.platform).toBe('aws-nitro');
    });

    it('should return mock attestation in non-TEE environment', async () => {
      const mockAttestation = {
        platform: 'none' as const,
        report: 'MOCK_ATTESTATION_FOR_DEVELOPMENT_ONLY',
        measurement: 'MOCK_MEASUREMENT_NOT_SECURE',
        timestamp: '2026-03-18T10:45:00.000Z',
      };

      mockTeePlatformService.generateAttestationReport.mockResolvedValue(
        mockAttestation,
      );

      const result = await service.getAttestation();

      expect(result.platform).toBe('none');
      expect(result.measurement).toContain('MOCK');
    });

    it('should propagate errors from TEE platform service', async () => {
      mockTeePlatformService.generateAttestationReport.mockRejectedValue(
        new Error('TEE attestation generation failed'),
      );

      await expect(service.getAttestation()).rejects.toThrow(
        'TEE attestation generation failed',
      );
    });
  });
});
