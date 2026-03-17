import { Controller, Get } from '@nestjs/common';

@Controller('attestation')
export class AttestationController {
  @Get()
  async getAttestation() {
    return {
      // TODO: replace stubs with real TEE platform calls
      report: 'ATTESTATION_REPORT_PLACEHOLDER',
      measurement: 'ENCLAVE_MEASUREMENT_PLACEHOLDER',
      timestamp: new Date().toISOString(),
      instructions:
        'Verify this report at your TEE platform verification endpoint. ' +
        'Compare the measurement against the published Docker image SHA.',
    };
  }
}
