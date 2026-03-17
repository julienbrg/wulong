import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SiweService } from './siwe.service';

/**
 * SIWE authentication guard
 * Expects SIWE message and signature in request headers:
 * - X-SIWE-Message: The SIWE message string
 * - X-SIWE-Signature: The signature hex string
 */
@Injectable()
export class SiweGuard implements CanActivate {
  constructor(private readonly siweService: SiweService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { 'x-siwe-message'?: string; 'x-siwe-signature'?: string };
      user?: { address: string };
    }>();

    const message = request.headers['x-siwe-message'];
    const signature = request.headers['x-siwe-signature'];

    if (!message || !signature) {
      throw new UnauthorizedException(
        'Missing SIWE authentication headers (x-siwe-message, x-siwe-signature)',
      );
    }

    const address = await this.siweService.verifySignature(message, signature);

    if (!address) {
      throw new UnauthorizedException(
        'Invalid SIWE signature or expired nonce',
      );
    }

    // Attach verified address to request for use in controllers
    request.user = { address };

    return true;
  }
}
