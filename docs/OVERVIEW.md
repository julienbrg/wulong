# Wulong Overview

## Purpose

Wulong is a confidential computing API framework that provides cryptographic guarantees about data privacy during server-side processing. Built on NestJS, it enables developers to build APIs where even the infrastructure operator cannot access user data—a trust model verified through hardware attestation rather than organizational policy.

## Core Concepts

### Trusted Execution Environments (TEEs)

Wulong leverages hardware-based isolation provided by modern CPU security features. The application executes within a cryptographically sealed enclave where:

- **Memory isolation**: The host OS and operator cannot read enclave memory
- **Encrypted I/O**: TLS termination occurs inside the enclave, preventing plaintext exposure
- **Remote attestation**: Clients receive cryptographic proof of the exact code executing
- **Sealed secrets**: Cryptographic keys and sensitive configuration are only released after attestation verification

### Supported TEE Platforms

- **AMD SEV-SNP**: Secure Encrypted Virtualization with memory integrity
- **Intel TDX**: Trust Domain Extensions for VM-level isolation
- **AWS Nitro**: Amazon's proprietary enclave technology
- **Phala Network**: Decentralized TEE infrastructure on Intel TDX

### Architecture Philosophy

Wulong follows a **zero-trust operator model**. Traditional API security relies on trusting the infrastructure provider not to access data. Wulong inverts this: the operator is explicitly untrusted, and hardware isolation enforces confidentiality. Clients verify the running code through attestation before transmitting sensitive data.

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

**Trusted Components:**
1. TEE hardware vendor (AMD/Intel/AWS)
2. Application code (verifiable via attestation)
3. Key Management Service (KMS) attestation verification logic

**Explicitly Untrusted:**
- Host operating system
- Cloud provider operators
- Network infrastructure between client and enclave

## Key Features

### Attestation & Verification
The `/attestation` endpoint exposes cryptographic evidence of the running code. Clients verify this evidence against known measurements before transmitting sensitive data. This creates a trustless verification model where code identity is proven mathematically rather than asserted.

### Web3 Authentication
Sign-In with Ethereum (SIWE) provides decentralized authentication without traditional credentials. Users prove identity through cryptographic signatures, eliminating password management and centralized identity providers. See [docs/SIWE.md](docs/SIWE.md) for implementation details.

### Confidentiality Controls
- **Sanitized logging**: Structured log filtering prevents accidental data leakage
- **TLS-in-enclave**: Network plaintext never touches host infrastructure
- **KMS integration**: Secrets provisioned post-attestation, not at deploy time
- **Input validation**: Schema-based request validation prevents injection attacks

### Operational Features
- Rate limiting and DoS protection
- Health check endpoints for orchestration systems
- Swagger/OpenAPI documentation generation
- Platform-agnostic TEE detection at runtime

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                TEE Enclave Boundary             │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │       NestJS Application Layer          │   │
│  │  ┌──────────────┐  ┌─────────────────┐ │   │
│  │  │  Controllers │  │  Business Logic │ │   │
│  │  └──────────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────┘   │
│                      ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │          Security Services              │   │
│  │  • Attestation Generation               │   │
│  │  • SIWE Authentication                  │   │
│  │  • TLS Termination                      │   │
│  │  • Secrets Management                   │   │
│  └─────────────────────────────────────────┘   │
│                      ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │         Hardware Isolation              │   │
│  │  • Encrypted Memory                     │   │
│  │  • Attestation Primitives               │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       ↕ (encrypted channel)
              ┌────────────────────┐
              │   External KMS     │
              │ (attestation gate) │
              └────────────────────┘
```

### Data Flow

1. **Client Request**: TLS connection established directly with enclave
2. **Attestation**: Client verifies `/attestation` endpoint before sending sensitive data
3. **Authentication**: SIWE signature validated against Ethereum address
4. **Processing**: Business logic executes within hardware-isolated memory
5. **Response**: Encrypted response sent through TLS tunnel

### Component Layers

**Application Layer**: Standard NestJS controllers and services, with TEE-awareness for attestation and secrets handling

**Security Layer**: Enforces confidentiality guarantees through sanitized logging, header-based authentication, and KMS integration

**Hardware Layer**: Platform-specific TEE implementations (SEV-SNP, TDX, Nitro) provide memory encryption and attestation

## Use Cases

### Private Data APIs
APIs processing personal data (health records, financial information) where regulatory compliance requires operator-proof confidentiality. Attestation provides auditable evidence of data handling.

### Web3 Oracles
Trusted computation for blockchain applications requiring off-chain data or complex calculations. TEEs prevent oracle manipulation by infrastructure providers.

### Multi-party Computation
Neutral computation zones where multiple parties contribute data but no single party (including the operator) can access inputs. Attestation proves fair execution.

### Confidential AI Inference
ML model inference where both the model and user inputs must remain confidential. TEEs prevent model extraction and input logging.

## Getting Started

This overview covers architectural concepts and security properties. For practical implementation:

- **Setup & Deployment**: See [README.md](../README.md) for installation and development setup
- **TEE Platform Configuration**: See [docs/TEE_SETUP.md](TEE_SETUP.md) for platform-specific deployment
- **Authentication Integration**: See [docs/SIWE.md](SIWE.md) for Web3 authentication
- **Security Considerations**: See [docs/SIDE_CHANNEL_ATTACKS.md](SIDE_CHANNEL_ATTACKS.md) for threat modeling

## Technical Stack

- **Runtime**: Node.js 20+ with NestJS 11
- **Language**: TypeScript 5.7
- **Package Manager**: pnpm
- **TEE Platforms**: AMD SEV-SNP, Intel TDX, AWS Nitro, Phala Network
- **Authentication**: SIWE (Sign-In with Ethereum)
- **API Documentation**: Swagger/OpenAPI
- **License**: GPL v3
