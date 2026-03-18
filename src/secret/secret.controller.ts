import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
} from '@nestjs/swagger';
import { SecretService } from './secret.service';
import { SiweGuard } from '../auth/siwe.guard';
import { StoreRequestDto } from './dto/store-request.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import { AccessResponseDto } from './dto/access-response.dto';
import { AttestationResponseDto } from './dto/attestation-response.dto';

@ApiTags('App')
@Controller('chest')
export class SecretController {
  constructor(private readonly secretService: SecretService) {}

  @Post('store')
  @ApiOperation({
    summary: 'Store a secret',
    description:
      'Stores a secret and returns a unique slot identifier. The secret can only be accessed by the specified public addresses.',
  })
  @ApiResponse({
    status: 201,
    description: 'Secret stored successfully',
    type: StoreResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - empty secret or invalid addresses',
  })
  async store(@Body() dto: StoreRequestDto): Promise<StoreResponseDto> {
    const slot = await this.secretService.store(
      dto.secret,
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
      'Retrieves a secret if the authenticated caller is one of the owners. ' +
      'Requires SIWE authentication via X-SIWE-Message and X-SIWE-Signature headers.',
  })
  @ApiHeader({
    name: 'x-siwe-message',
    description: 'The SIWE message string (base64 encoded)',
    required: true,
  })
  @ApiHeader({
    name: 'x-siwe-signature',
    description: 'The signature hex string',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Secret retrieved successfully',
    type: AccessResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid SIWE authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - caller is not an owner of this secret',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - slot does not exist',
  })
  async access(
    @Param('slot') slot: string,
    @Req() req: { user: { address: string } },
  ): Promise<AccessResponseDto> {
    const secret = await this.secretService.access(slot, req.user.address);
    return { secret };
  }

  @Get('attestation')
  @ApiOperation({
    summary: 'Get TEE attestation',
    description:
      'Returns a cryptographic attestation proving that this service is running in a genuine TEE ' +
      'and showing the measurement (hash) of the code. Users can verify the measurement matches ' +
      'the published source code to ensure the service cannot access their secrets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attestation report generated successfully',
    type: AttestationResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to generate attestation report',
  })
  async getAttestation(): Promise<AttestationResponseDto> {
    return await this.secretService.getAttestation();
  }
}
