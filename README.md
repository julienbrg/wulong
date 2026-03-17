# Wulong

A NestJS API designed to run inside a Trusted Execution Environment (TEE), giving users cryptographic guarantees that the operator cannot access their data during processing.

## What that means

The server runs inside a hardware-isolated enclave (AMD SEV-SNP, Intel TDX, or similar). The host OS — including the operator — cannot read the enclave's memory. TLS terminates inside the enclave, so plaintext never passes through host-controlled infrastructure. Users can verify the exact code running via the `/attestation` endpoint and compare it against this repository.

## Install

```bash
pnpm i
```

## Run

```bash
pnpm start:dev
```

## Attestation

```bash
curl -k https://localhost:3000/attestation
```

Returns the enclave measurement. Compare it against the commit SHA published in each release to verify nothing has been tampered with.

## Contact

**Julien Béranger** ([GitHub](https://github.com/julienbrg))

- Element: [@julienbrg:matrix.org](https://matrix.to/#/@julienbrg:matrix.org)
- Farcaster: [julien-](https://warpcast.com/julien-)
- Telegram: [@julienbrg](https://t.me/julienbrg)

<img src="https://bafkreid5xwxz4bed67bxb2wjmwsec4uhlcjviwy7pkzwoyu5oesjd3sp64.ipfs.w3s.link" alt="built-with-ethereum-w3hc" width="100"/>
