import { Module } from '@nestjs/common';
import { SecretController } from './secret.controller';
import { SecretService } from './secret.service';
import { AuthModule } from '../auth/auth.module';
import { TeePlatformService } from '../attestation/tee-platform.service';

@Module({
  imports: [AuthModule],
  controllers: [SecretController],
  providers: [SecretService, TeePlatformService],
})
export class SecretModule {}
