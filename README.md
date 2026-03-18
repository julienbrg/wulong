# Wulong

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Test](https://github.com/julienbrg/wulong/actions/workflows/test.yml/badge.svg)](https://github.com/julienbrg/wulong/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/julienbrg/wulong/branch/main/graph/badge.svg)](https://codecov.io/gh/julienbrg/wulong)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.23-F69220?logo=pnpm)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing.

## What is a TEE?

The server runs inside a hardware-isolated enclave (AMD SEV-SNP, Intel TDX, AWS Nitro, or Phala Network's Intel TDX). The host OS — including the operator — cannot read the enclave's memory. TLS terminates inside the enclave, so plaintext never passes through host-controlled infrastructure. Users can verify the exact code running via the `/attestation` endpoint and compare it against this repository.

**Note on Phala Network**: Wulong can run on Phala Network's Intel TDX infrastructure. Phala also supports Intel SGX, but Wulong does not currently support SGX. See [docs/TEE_SETUP.md](docs/TEE_SETUP.md#phala-network-intel-tdxsgx) for deployment details.

## Features

- ✅ **Hardware-isolated execution** - Code runs in a TEE enclave
- ✅ **TLS termination inside enclave** - Host never sees plaintext
- ✅ **Remote attestation** - Cryptographic proof of running code
- ✅ **SIWE authentication** - Sign-In with Ethereum for Web3 auth
- ✅ **Sanitized logging** - No sensitive data in logs
- ✅ **KMS integration** - Secrets fetched after attestation
- ✅ **Rate limiting** - DoS protection
- ✅ **Security headers** - Helmet.js integration
- ✅ **Input validation** - All requests validated
- ✅ **Health checks** - `/health`, `/health/ready`, `/health/live`
- ✅ **API documentation** - Swagger/OpenAPI integration

## Security Model

### Threat Model

**Protected against:**
- Malicious host operator reading memory
- Network eavesdropping (TLS in enclave)
- Log-based data exfiltration
- Stack trace information leakage

**NOT protected against:**
- Side-channel attacks (timing, cache) - See [docs/SIDE_CHANNEL_ATTACKS.md](docs/SIDE_CHANNEL_ATTACKS.md) for mitigations
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

4. Access the API documentation:
```
https://localhost:3000
```
(Accept the self-signed certificate warning in your browser)

## Production Deployment

> **📖 For detailed platform-specific deployment instructions, see [docs/TEE_SETUP.md](docs/TEE_SETUP.md)**

### Prerequisites

- TEE-enabled hardware (AMD SEV-SNP, Intel TDX, AWS Nitro, or Phala Network)
- KMS endpoint configured to verify attestation
- Production TLS certificates generated inside the enclave

### Environment Variables

```bash
NODE_ENV=production
KMS_URL=https://your-kms.example.com/release
```

### TEE Platform Integration

The application now includes full attestation support for:

1. **AMD SEV-SNP** - Uses `snpguest` or `sev-guest-get-report` tools
   - Reads attestation reports from `/dev/sev-guest` device
   - Extracts measurement hash for verification
   - Install: `apt-get install snpguest` or build from AMD's sev-guest tools

2. **Intel TDX** - Uses `tdx-attest` tool or direct `/dev/tdx-guest` access
   - Generates TDX quotes containing MRTD measurements
   - Install: `apt-get install tdx-attest` or build from Intel TDX SDK
   - ✅ **Production Ready** - Compatible with Phala Network's Dstack infrastructure

3. **AWS Nitro Enclaves** - Uses Nitro Security Module (NSM)
   - Generates CBOR-encoded attestation documents with PCR measurements
   - Requires: `nitro-cli` and NSM device (`/dev/nsm`)

4. **Phala Network** - Deploy via [Dstack](https://docs.phala.com/dstack/getting-started) on Intel TDX
   - Docker-based deployment to TEE infrastructure
   - Supports Phala Cloud managed service or self-hosted
   - See [docs/TEE_SETUP.md#phala-network-intel-tdxsgx](docs/TEE_SETUP.md#phala-network-intel-tdxsgx) for details

5. **Development Mode** - Automatically detects non-TEE environments
   - Returns mock attestation with clear warnings
   - Platform field set to 'none' for easy detection
   - Safe for local development and testing

### Platform Detection

The service automatically detects the TEE platform at startup:
- Checks for `/dev/sev-guest` → AMD SEV-SNP
- Checks for `/dev/tdx-guest` → Intel TDX
- Checks for `/dev/nsm` → AWS Nitro
- Otherwise → Development mode (no TEE)

### Installation of Platform Tools

**AMD SEV-SNP:**
```bash
# Install from package (Ubuntu/Debian)
apt-get install snpguest

# Or build from source
git clone https://github.com/virtee/snpguest
cd snpguest && cargo build --release
```

**Intel TDX:**
```bash
# Install Intel TDX tools
wget https://download.01.org/intel-sgx/latest/linux-latest/distro/ubuntu22.04-server/tdx-attest.deb
dpkg -i tdx-attest.deb
```

**AWS Nitro:**
```bash
# Install AWS Nitro CLI
amazon-linux-extras install aws-nitro-enclaves-cli
# Or for Ubuntu:
wget https://github.com/aws/aws-nitro-enclaves-cli/releases/latest/download/nitro-cli.deb
dpkg -i nitro-cli.deb
```

**Phala Network:**
```bash
# Deploy via Docker to Dstack
# See detailed guide: https://docs.phala.com/dstack/getting-started

# Phala Cloud CLI (for managed deployments)
phala cvms attestation  # View attestation reports
phala cvms list         # List your CVMs
```

## API Endpoints

Full API documentation is available via Swagger UI at `https://localhost:3000` (development) or your production URL.

### Authentication

**Sign-In with Ethereum (SIWE)** - Guard-based Web3 authentication

- `POST /auth/nonce` - Generate a cryptographically secure nonce for SIWE authentication
  - Returns nonce with 5-minute expiration
  - Single-use nonces (consumed after verification)

- Protected endpoints use `SiweGuard` for authentication
  - Credentials passed via `x-siwe-message` and `x-siwe-signature` headers
  - Guard validates signature, checks nonce, and attaches address to request
  - Returns 401 Unauthorized if validation fails

**Example Flow:**
```bash
# 1. Get nonce
curl -X POST https://localhost:3000/auth/nonce

# 2. Sign SIWE message with your wallet (using w3pk, MetaMask, etc.)

# 3. Access protected endpoint with authentication headers
curl -X POST https://localhost:3000/hello \
  -H "x-siwe-message: localhost wants you to sign in..." \
  -H "x-siwe-signature: 0x..."
```

**Security Features:**
- **No JWT required** - Direct signature verification on each request
- **Header-based credentials** - Clean separation from request body
- **Guard pattern** - Declarative protection with `@UseGuards(SiweGuard)`
- **Request decoration** - Verified address available at `req.user.address`

> **📖 For detailed SIWE usage, client examples (w3pk, MetaMask, ethers), and troubleshooting, see [docs/SIWE.md](docs/SIWE.md)**

### Core Endpoints

#### `GET /`
Health check - returns greeting message.

#### `GET /attestation`
Returns the TEE attestation report. Clients should:
1. Fetch this endpoint
2. Verify the report signature with TEE platform verification service
3. Compare measurement hash against published Docker image SHA
4. Only send sensitive data if verification succeeds

#### `GET /health`
Basic health check for load balancers.

#### `GET /health/ready`
Readiness probe - indicates if service is ready to accept traffic.

#### `GET /health/live`
Liveness probe - indicates if service is alive.

## Verifying the Deployment

```bash
# Get attestation report
curl -k https://your-server.com/attestation

# Example response:
# {
#   "platform": "amd-sev-snp",  // or "intel-tdx", "aws-nitro", "none"
#   "report": "base64-encoded-attestation-report",
#   "measurement": "hex-encoded-measurement-hash",
#   "timestamp": "2026-03-17T...",
#   "instructions": "Verify this report at..."
# }

# If platform is "none", you're NOT in a TEE (development mode)
# If platform is a TEE type, verify the report cryptographically
```

### Verification Steps

1. **Check Platform**: Ensure `platform` is not `"none"`
2. **Verify Signature**: Use platform-specific verification service
   - AMD SEV-SNP: Use AMD's KDS service
   - Intel TDX: Use Intel's attestation verification API
   - AWS Nitro: Use `aws-nitro-enclaves-cose` library
3. **Compare Measurement**: Match against published Docker image SHA256
4. **Trust Decision**: Only send sensitive data if verification passes

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

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
