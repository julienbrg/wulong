import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SiweService } from './siwe.service';
import { NonceResponseDto } from './dto/nonce-response.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly siweService: SiweService) {}

  @Post('nonce')
  @ApiOperation({
    summary: 'Generate a nonce for SIWE authentication',
    description:
      'Returns a random nonce that must be included in the SIWE message. ' +
      'The nonce is single-use and expires after 5 minutes.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nonce generated successfully',
    type: NonceResponseDto,
  })
  generateNonce(): NonceResponseDto {
    const nonce = this.siweService.generateNonce();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    return {
      nonce,
      issuedAt,
      expiresAt,
    };
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify SIWE signature and authenticate',
    description:
      'Verifies the SIWE message and signature. Returns true if valid, false otherwise. ' +
      'The nonce must be obtained from /auth/nonce and used within 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signature verification result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        address: { type: 'string', nullable: true },
      },
    },
  })
  async verify(
    @Body() verifyDto: VerifyRequestDto,
  ): Promise<{ success: boolean; address: string | null }> {
    const address = await this.siweService.verifySignature(
      verifyDto.message,
      verifyDto.signature,
    );

    return {
      success: address !== null,
      address,
    };
  }
}
