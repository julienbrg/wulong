import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SecretsService } from './config/secrets.service';
import { AttestationController } from './attestation/attestation.controller';
import { TeePlatformService } from './attestation/tee-platform.service';
import { HealthController } from './health/health.controller';
import { AuthController } from './auth/auth.controller';
import { SiweService } from './auth/siwe.service';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    // Environment variable validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    // Rate limiting to prevent DoS attacks
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per minute per IP
      },
    ]),
  ],
  controllers: [
    AppController,
    AttestationController,
    HealthController,
    AuthController,
  ],
  providers: [AppService, SecretsService, TeePlatformService, SiweService],
  exports: [SecretsService, TeePlatformService, SiweService],
})
export class AppModule {}
