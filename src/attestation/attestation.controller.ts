import { Controller, Get } from '@nestjs/common';

/**
 * Attestation controller.
 * Provides cryptographic proof of the code running inside the TEE.
 *
 * Clients should:
 * 1. Fetch the attestation report from this endpoint
 * 2. Verify the report signature with the TEE platform's verification service
 * 3. Compare the measurement hash against the published Docker image SHA
 * 4. Only send sensitive data if verification succeeds
 */
@Controller('attestation')
export class AttestationController {
  /**
   * Returns the TEE attestation report and enclave measurement.
   * Clients must verify this cryptographically before trusting the service.
   *
   * @returns Attestation report, measurement, and verification instructions
   */
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
