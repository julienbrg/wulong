# Wulong

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Test](https://github.com/julienbrg/wulong/actions/workflows/test.yml/badge.svg)](https://github.com/julienbrg/wulong/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/julienbrg/wulong/branch/main/graph/badge.svg)](https://codecov.io/gh/julienbrg/wulong)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.23-F69220?logo=pnpm)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing. Optimized for [Phala Network](https://phala.network/) deployment.

## Features

- Quantum-resistant encryption ([ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final), see [client guide](docs/CLIENT_ENCRYPTION.md))
- TEE attestation ([AMD SEV-SNP](https://www.amd.com/en/developer/sev.html), [Intel TDX](https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html), [AWS Nitro](https://aws.amazon.com/ec2/nitro/), [Phala](https://phala.network/), see [setup guide](docs/TEE_SETUP.md))
- Web3 authentication ([SIWE](https://login.xyz), see [auth guide](docs/SIWE.md))
- Zero-trust security model (see [overview](docs/OVERVIEW.md))
- [TypeScript](https://www.typescriptlang.org/) with [NestJS](https://nestjs.com/)

## Quick Start

### Local Development (without Docker)

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.template .env

# Generate TLS certificates
mkdir -p secrets
openssl req -x509 -newkey rsa:4096 -keyout secrets/tls.key -out secrets/tls.cert -days 365 -nodes -subj "/CN=localhost"

# Generate ML-KEM keypair
pnpm ts-node scripts/generate-admin-keypair.ts
# Copy the output keys to your .env file

# Start development server
pnpm start:dev
```

Access at `https://localhost:3000` (accept self-signed certificate warning)

### Docker Development

```bash
docker compose -f docker-compose.dev.yml up
```

Access at `https://localhost:3000`

### Phala Cloud (Production TEE)

```bash
# Build and push Docker image
docker buildx build --platform linux/amd64 -t YOUR_USERNAME/wulong:latest --push .

# Deploy to Phala Cloud
phala deploy --interactive
```

## Modes

Wulong can run in four different modes:

1. **[Local (without Docker)](docs/LOCAL_SETUP.md)** - Best for development and debugging
   - Hot reload with `pnpm start:dev`
   - HTTPS with self-signed certificates
   - Direct access to logs and debugging tools
   - Mock TEE attestation (no real hardware security)

2. **[Local (with Docker)](docs/DOCKER.md)** - Best for testing deployment configurations
   - Development mode with volume mounting and hot reload
   - Production mode with optimized multi-stage builds
   - Consistent environment across different machines
   - Mock TEE attestation (no real hardware security)

3. **[Standard (without TEE)](docs/DOCKER.md)** - Production deployment without TEE hardware
   - Production-ready configuration
   - No hardware attestation available (`platform: "none"`)
   - Suitable for environments where TEE is not required
   - Uses standard server infrastructure

4. **[Phala Cloud (TEE)](docs/PHALA_CONFIG.md)** - Production with hardware-backed security (recommended)
   - Intel TDX Trusted Execution Environment
   - End-to-end encrypted secrets
   - Full attestation support (`platform: "intel-tdx"`)
   - TLS termination by Phala
   - Cryptographic proof of code integrity

## Docs

### Setup & Deployment

- [**Local Setup**](docs/LOCAL_SETUP.md) - Run locally without Docker (development)
- [**Docker Setup**](docs/DOCKER.md) - Run with Docker (development & testing)
- [**Phala Deployment**](docs/PHALA_CONFIG.md) - Deploy to Phala Cloud TEE (production)

### API & Usage

- [**API Reference**](docs/API_REFERENCE.md) - Complete REST API endpoint documentation
- [**Client-Side Encryption**](docs/CLIENT_ENCRYPTION.md) - Quantum-resistant ML-KEM encryption guide
- [**SIWE Authentication**](docs/SIWE.md) - Ethereum wallet authentication guide

### Architecture & Security

- [**Overview**](docs/OVERVIEW.md) - Project overview, architecture, and security model
- [**TEE Setup**](docs/TEE_SETUP.md) - Platform-specific deployment (AMD SEV-SNP, Intel TDX, AWS Nitro, Phala)
- [**Side Channel Attacks**](docs/SIDE_CHANNEL_ATTACKS.md) - Security considerations and mitigations

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
