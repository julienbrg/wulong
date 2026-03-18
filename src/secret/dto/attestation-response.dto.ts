import { ApiProperty } from '@nestjs/swagger';

export class AttestationResponseDto {
  @ApiProperty({
    description: 'TEE platform type',
    enum: ['amd-sev-snp', 'intel-tdx', 'aws-nitro', 'phala', 'none'],
    example: 'amd-sev-snp',
  })
  platform: string;

  @ApiProperty({
    description: 'Base64-encoded attestation report/quote from TEE',
    example: 'eyJhdHRlc3RhdGlvbiI6ICIuLi4ifQ==',
  })
  report: string;

  @ApiProperty({
    description: 'Measurement/hash of the code running in the TEE',
    example: 'a1b2c3d4e5f6...',
  })
  measurement: string;

  @ApiProperty({
    description: 'Timestamp when the attestation was generated',
    example: '2026-03-18T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Public key of the TEE (if applicable)',
    required: false,
    example: '0x1234567890abcdef...',
  })
  publicKey?: string;
}
