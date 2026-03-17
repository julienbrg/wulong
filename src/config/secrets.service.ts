import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger('SecretsService');
  private secrets: Record<string, string> = {};

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') {
      await this.loadFromKms();
    } else {
      // Dev: fall back to process.env (never do this in production)
      this.logger.warn('DEV MODE: loading secrets from process.env');
      this.secrets = process.env as Record<string, string>;
    }
  }

  get(key: string): string {
    const val = this.secrets[key];
    if (!val) throw new Error(`Secret "${key}" not found`);
    return val;
  }

  private async loadFromKms() {
    const attestationReport = await this.getAttestationReport();

    const response = await fetch(process.env.KMS_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attestation: attestationReport }),
    });

    if (!response.ok) {
      throw new Error('KMS refused to release secrets — attestation failed');
    }

    this.secrets = await response.json();
    this.logger.log('Secrets loaded from KMS');
  }

  private async getAttestationReport(): Promise<string> {
    // TODO: implement for your TEE platform
    // AMD SEV-SNP  → read from /dev/sev-guest
    // Intel TDX    → use tdx-guest library
    // AWS Nitro    → use nsm-api bindings
    throw new Error('getAttestationReport() not implemented');
  }
}
