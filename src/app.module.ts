import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SecretsService } from './config/secrets.service';
import { AttestationController } from './attestation/attestation.controller';

@Module({
  imports: [],
  controllers: [AppController, AttestationController],
  providers: [AppService, SecretsService],
  exports: [SecretsService],
})
export class AppModule {}
