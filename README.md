# Wulong

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing.

## What is a TEE?

The server runs inside a hardware-isolated enclave (AMD SEV-SNP, Intel TDX, or AWS Nitro). The host OS — including the operator — cannot read the enclave's memory. TLS terminates inside the enclave, so plaintext never passes through host-controlled infrastructure. Users can verify the exact code running via the `/attestation` endpoint and compare it against this repository.

## Features

- ✅ **Hardware-isolated execution** - Code runs in a TEE enclave
- ✅ **TLS termination inside enclave** - Host never sees plaintext
- ✅ **Remote attestation** - Cryptographic proof of running code
- ✅ **Sanitized logging** - No sensitive data in logs
- ✅ **KMS integration** - Secrets fetched after attestation
- ✅ **Rate limiting** - DoS protection
- ✅ **Security headers** - Helmet.js integration
- ✅ **Input validation** - All requests validated
- ✅ **Health checks** - `/health`, `/health/ready`, `/health/live`

## Security Model

### Threat Model

**Protected against:**
- Malicious host operator reading memory
- Network eavesdropping (TLS in enclave)
- Log-based data exfiltration
- Stack trace information leakage

**NOT protected against:**
- Side-channel attacks (timing, cache)
- Physical access to hardware
- Compromised TEE firmware
- Application logic bugs

### Trust Assumptions

You must trust:
1. The TEE hardware vendor (AMD/Intel/AWS)
2. This application code (verify via attestation)
3. The KMS that releases secrets

You do NOT need to trust:
- The host OS
- The cloud provider operator
- Network infrastructure

## Installation

```bash
pnpm install
```

## Development Setup

1. Copy environment template:
```bash
cp .env.template .env
```

2. Generate self-signed TLS certificates:
```bash
mkdir -p secrets
openssl req -x509 -newkey rsa:4096 -keyout secrets/tls.key -out secrets/tls.cert -days 365 -nodes -subj "/CN=localhost"
```

3. Start the dev server:
```bash
pnpm start:dev
```

## Production Deployment

### Prerequisites

- TEE-enabled hardware (AMD SEV-SNP, Intel TDX, or AWS Nitro)
- KMS endpoint configured to verify attestation
- Production TLS certificates generated inside the enclave

### Environment Variables

```bash
NODE_ENV=production
KMS_URL=https://your-kms.example.com/release
```

### TODO: Implement TEE Platform Integration

Before production use, you must implement:

1. **Attestation Generation** (`src/config/secrets.service.ts:66`)
   - AMD SEV-SNP: Read from `/dev/sev-guest`
   - Intel TDX: Use `tdx-guest` library
   - AWS Nitro: Use `nsm-api` bindings

2. **Attestation Endpoint** (`src/attestation/attestation.controller.ts:25`)
   - Replace placeholders with real attestation report
   - Include platform-specific measurement

## API Endpoints

### `GET /`
Health check - returns greeting message.

### `GET /attestation`
Returns the TEE attestation report. Clients should:
1. Fetch this endpoint
2. Verify the report signature with TEE platform verification service
3. Compare measurement hash against published Docker image SHA
4. Only send sensitive data if verification succeeds

### `GET /health`
Basic health check for load balancers.

### `GET /health/ready`
Readiness probe - indicates if service is ready to accept traffic.

### `GET /health/live`
Liveness probe - indicates if service is alive.

## Verifying the Deployment

```bash
# Get attestation report
curl -k https://your-server.com/attestation

# Verify with your TEE platform's verification service
# Compare measurement against published release SHA
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm start:dev

# Build for production
pnpm build

# Run production build
pnpm start:prod

# Lint code
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test
```

## Architecture

```
┌─────────────────────────────────────────┐
│           TEE Enclave                   │
│  ┌───────────────────────────────────┐  │
│  │   NestJS Application              │  │
│  │   - Attestation Controller        │  │
│  │   - Business Logic                │  │
│  │   - TLS Termination               │  │
│  └───────────────────────────────────┘  │
│              ↕                          │
│  ┌───────────────────────────────────┐  │
│  │   Secrets Service                 │  │
│  │   (KMS integration)               │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↕ (encrypted)
      ┌──────────────┐
      │     KMS      │
      │  (external)  │
      └──────────────┘
```

## License

See [LICENSE](LICENSE) file.

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
