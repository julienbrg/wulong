# Wulong

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Test](https://github.com/julienbrg/wulong/actions/workflows/test.yml/badge.svg)](https://github.com/julienbrg/wulong/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/julienbrg/wulong/branch/main/graph/badge.svg)](https://codecov.io/gh/julienbrg/wulong)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.23-F69220?logo=pnpm)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing.

## Features

- Quantum-resistant encryption ([ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final), see [client guide](docs/CLIENT_ENCRYPTION.md))
- TEE attestation ([AMD SEV-SNP](https://www.amd.com/en/developer/sev.html), [Intel TDX](https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html), [AWS Nitro](https://aws.amazon.com/ec2/nitro/), [Phala](https://phala.network/), see [setup guide](docs/TEE_SETUP.md))
- Web3 authentication ([SIWE](https://login.xyz), see [auth guide](docs/SIWE.md))
- Zero-trust security model (see [overview](docs/OVERVIEW.md))
- [TypeScript](https://www.typescriptlang.org/) with [NestJS](https://nestjs.com/)

## Install

```bash
pnpm i
```

## Run

Copy environment template:
```bash
cp .env.template .env
```

Generate self-signed TLS certificates:
```bash
mkdir -p secrets
openssl req -x509 -newkey rsa:4096 -keyout secrets/tls.key -out secrets/tls.cert -days 365 -nodes -subj "/CN=localhost"
```

Generate ML-KEM-1024 keypair:
```bash
node scripts/generate-mlkem-keypair.mjs
```

> ⚠️ The private key will be stored in `secrets/mlkem.key`. Never commit this file!

Start the dev server:
```bash
pnpm start:dev
```

Access the API documentation:
```
https://localhost:3000
```

__Accept the self-signed certificate warning in your browser. Please note the 's' in 'https'.__

## Docs

- [**API Reference**](docs/API_REFERENCE.md) - Complete REST API endpoint documentation
- [**Overview**](docs/OVERVIEW.md) - Project overview, architecture, and security model
- [**Client-Side Encryption**](docs/CLIENT_ENCRYPTION.md) - Quantum-resistant ML-KEM encryption guide
- [**TEE Setup**](docs/TEE_SETUP.md) - Platform-specific deployment (AMD SEV-SNP, Intel TDX, AWS Nitro, Phala)
- [**SIWE Authentication**](docs/SIWE.md) - Ethereum wallet authentication guide
- [**Side Channel Attacks**](docs/SIDE_CHANNEL_ATTACKS.md) - Security considerations and mitigations

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
