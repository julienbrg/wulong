import { Test, TestingModule } from '@nestjs/testing';
import { AttestationController } from './attestation.controller';
import { TeePlatformService } from './tee-platform.service';

describe('AttestationController', () => {
  let controller: AttestationController;
  let teePlatformService: TeePlatformService;

  const mockAttestationReport = {
    platform: 'none' as const,
    report: 'mock-report-base64',
    measurement: 'mock-measurement',
    timestamp: '2026-03-17T00:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttestationController],
      providers: [
        {
          provide: TeePlatformService,
          useValue: {
            generateAttestationReport: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AttestationController>(AttestationController);
    teePlatformService = module.get<TeePlatformService>(TeePlatformService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAttestation', () => {
    it('should return attestation with instructions for mock platform', () => {
      jest
        .spyOn(teePlatformService, 'generateAttestationReport')
        .mockReturnValue(mockAttestationReport);

      const result = controller.getAttestation();

      expect(result).toHaveProperty('platform', 'none');
      expect(result).toHaveProperty('report', 'mock-report-base64');
      expect(result).toHaveProperty('measurement', 'mock-measurement');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('instructions');
      expect(result.instructions).toContain('WARNING');
      expect(result.instructions).toContain('MOCK');
      expect(
        jest
          .spyOn(teePlatformService, 'generateAttestationReport')
          .getMockImplementation(),
      ).toBeDefined();
    });

    it('should return AMD SEV-SNP verification instructions', () => {
      const sevReport = {
        ...mockAttestationReport,
        platform: 'amd-sev-snp' as const,
      };
      jest
        .spyOn(teePlatformService, 'generateAttestationReport')
        .mockReturnValue(sevReport);

      const result = controller.getAttestation();

      expect(result.platform).toBe('amd-sev-snp');
      expect(result.instructions).toContain('SEV-SNP');
      expect(result.instructions).toContain('AMD');
      expect(result.instructions).toContain('kdsintf.amd.com');
    });

    it('should return Intel TDX verification instructions', () => {
      const tdxReport = {
        ...mockAttestationReport,
        platform: 'intel-tdx' as const,
      };
      jest
        .spyOn(teePlatformService, 'generateAttestationReport')
        .mockReturnValue(tdxReport);

      const result = controller.getAttestation();

      expect(result.platform).toBe('intel-tdx');
      expect(result.instructions).toContain('TDX');
      expect(result.instructions).toContain('Intel');
      expect(result.instructions).toContain('MRTD');
      expect(result.instructions).toContain('trustedservices.intel.com');
    });

    it('should return AWS Nitro verification instructions', () => {
      const nitroReport = {
        ...mockAttestationReport,
        platform: 'aws-nitro' as const,
      };
      jest
        .spyOn(teePlatformService, 'generateAttestationReport')
        .mockReturnValue(nitroReport);

      const result = controller.getAttestation();

      expect(result.platform).toBe('aws-nitro');
      expect(result.instructions).toContain('Nitro');
      expect(result.instructions).toContain('PCR0');
      expect(result.instructions).toContain('aws-nitro-enclaves-cose');
    });

    it('should handle errors from TeePlatformService', () => {
      jest
        .spyOn(teePlatformService, 'generateAttestationReport')
        .mockImplementation(() => {
          throw new Error('TEE error');
        });

      expect(() => controller.getAttestation()).toThrow('TEE error');
    });
  });
});
