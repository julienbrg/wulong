# Wulong

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Test](https://github.com/julienbrg/wulong/actions/workflows/test.yml/badge.svg)](https://github.com/julienbrg/wulong/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/julienbrg/wulong/branch/main/graph/badge.svg)](https://codecov.io/gh/julienbrg/wulong)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.23-F69220?logo=pnpm)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing.

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

- [**Overview**](docs/OVERVIEW.md) - Complete project overview, features, installation, and API endpoints
- [**TEE Setup**](docs/TEE_SETUP.md) - Platform-specific deployment instructions for AMD SEV-SNP, Intel TDX, AWS Nitro, and Phala Network
- [**SIWE Authentication**](docs/SIWE.md) - Sign-In with Ethereum integration guide and client examples
- [**Side Channel Attacks**](docs/SIDE_CHANNEL_ATTACKS.md) - Security considerations and mitigation strategies

## License

GPL-3.0

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
