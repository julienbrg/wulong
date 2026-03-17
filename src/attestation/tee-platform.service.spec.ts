import { Test, TestingModule } from '@nestjs/testing';
import { TeePlatformService } from './tee-platform.service';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('child_process');

describe('TeePlatformService', () => {
  let service: TeePlatformService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no TEE devices exist
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  describe('platform detection', () => {
    it('should detect AMD SEV-SNP platform', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === '/dev/sev-guest';
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.getPlatform()).toBe('amd-sev-snp');
      expect(service.isInTee()).toBe(true);
    });

    it('should detect Intel TDX platform', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === '/dev/tdx-guest';
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.getPlatform()).toBe('intel-tdx');
      expect(service.isInTee()).toBe(true);
    });

    it('should detect AWS Nitro platform', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === '/dev/nsm';
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.getPlatform()).toBe('aws-nitro');
      expect(service.isInTee()).toBe(true);
    });

    it('should default to none when no TEE detected', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.getPlatform()).toBe('none');
      expect(service.isInTee()).toBe(false);
    });
  });

  describe('generateAttestationReport', () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);
    });

    it('should generate mock attestation for none platform', () => {
      const result = service.generateAttestationReport();

      expect(result.platform).toBe('none');
      expect(result.report).toBeDefined();
      expect(result.measurement).toBe('MOCK_MEASUREMENT_NOT_SECURE');
      expect(result.timestamp).toBeDefined();

      // Verify the report contains warning
      const decoded = JSON.parse(
        Buffer.from(result.report, 'base64').toString(),
      ) as { warning: string };
      expect(decoded.warning).toBe('MOCK_ATTESTATION_FOR_DEVELOPMENT_ONLY');
    });

    it('should include timestamp in mock attestation', () => {
      const result = service.generateAttestationReport();

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should accept optional user data parameter', () => {
      const userData = Buffer.from('test-user-data');
      const result = service.generateAttestationReport(userData);

      expect(result).toBeDefined();
      expect(result.platform).toBe('none');
    });
  });

  describe('getPlatform', () => {
    it('should return the detected platform', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.getPlatform()).toBe('none');
    });
  });

  describe('isInTee', () => {
    it('should return false when platform is none', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.isInTee()).toBe(false);
    });

    it('should return true when platform is detected', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === '/dev/sev-guest';
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [TeePlatformService],
      }).compile();

      service = module.get<TeePlatformService>(TeePlatformService);

      expect(service.isInTee()).toBe(true);
    });
  });
});
