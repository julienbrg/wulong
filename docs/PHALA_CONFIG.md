# Phala Cloud Deployment Guide

This guide covers deploying the Wulong API to Phala Cloud's Trusted Execution Environment (TEE).

## Overview

Phala Cloud provides confidential computing infrastructure using Intel TDX (Trust Domain Extensions). Your application runs inside a hardware-isolated Trusted Execution Environment where:

- Secrets are encrypted end-to-end in your browser before being sent to the TEE
- Only your application inside the TEE can decrypt the secrets
- The cloud provider cannot access your secrets or application data
- Full attestation is available to verify the TEE environment

## Prerequisites

1. **Phala CLI installed**
   ```bash
   npm install -g @phala/cli
   ```

2. **Docker Hub account** for hosting your container images

3. **Phala Cloud account** at https://cloud.phala.network

4. **Authentication**
   ```bash
   phala login
   ```

## Docker Image Requirements

### Architecture

Phala Cloud runs on **AMD64/x86_64** architecture. If building on Apple Silicon (ARM64), you must cross-compile:

```bash
docker buildx build --platform linux/amd64 -t YOUR_DOCKERHUB_USERNAME/wulong:latest --push .
```

For this project:
```bash
docker buildx build --platform linux/amd64 -t julienberanger/wulong:latest --push .
```

### Image Configuration

The [Dockerfile](../Dockerfile) uses a multi-stage build:
1. **Builder stage**: Compiles TypeScript with all dependencies
2. **Production stage**: Runs with production dependencies only, starts with `node dist/src/main.js`

Key points:
- Port 3000 is exposed for HTTP traffic (Phala handles TLS termination)
- Production mode uses HTTP, not HTTPS (configured in [src/main.ts](../src/main.ts:15))
- All secrets are loaded from environment variables injected by Phala

## Configuration Files

### docker-compose.yml

Environment variables must use the `${VAR}` syntax for Phala's encrypted secrets system:

```yaml
version: '3.8'

services:
  wulong:
    image: julienberanger/wulong:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=${NODE_ENV}
      - KMS_URL=${KMS_URL}
      - ADMIN_MLKEM_PUBLIC_KEY=${ADMIN_MLKEM_PUBLIC_KEY}
      - ADMIN_MLKEM_PRIVATE_KEY=${ADMIN_MLKEM_PRIVATE_KEY}
    restart: unless-stopped
```

### .env.prod

Create a local file with your production secrets (used during deployment):

```bash
NODE_ENV=production
KMS_URL=http://localhost:8001/prpc/PhactoryAPI.GetRuntimeInfo
ADMIN_MLKEM_PUBLIC_KEY=<your-public-key>
ADMIN_MLKEM_PRIVATE_KEY=<your-private-key>
```

**Important**: Add `.env.prod` to [.gitignore](../.gitignore) to prevent committing secrets.

### Generating ML-KEM Keys

Generate quantum-resistant ML-KEM-1024 keypairs:

```bash
pnpm ts-node scripts/generate-admin-keypair.ts
```

Copy the output keys to your `.env.prod` file.

## Deployment Process

### Initial Deployment

1. **Build and push Docker image**:
   ```bash
   pnpm build
   docker buildx build --platform linux/amd64 -t julienberanger/wulong:latest --push .
   ```

2. **Deploy to Phala Cloud**:
   ```bash
   phala deploy --interactive
   ```

   Follow the prompts:
   - Docker Compose file: `docker-compose.yml`
   - Environment file: `.env.prod`
   - Select instance type (e.g., `tdx.small`)
   - Choose region
   - Configure storage

3. **Wait for deployment**:
   ```bash
   phala cvms list
   ```

### Updating Deployment

To update an existing deployment:

1. **Rebuild and push new image**:
   ```bash
   pnpm build
   docker buildx build --platform linux/amd64 -t julienberanger/wulong:latest --push .
   ```

2. **Update deployment**:
   ```bash
   phala deploy --interactive
   # Select existing CVM to update
   ```

3. **Or restart to pull latest image**:
   ```bash
   phala cvms restart --interactive
   ```

## Useful Commands

### Instance Management

```bash
# List all CVMs
phala cvms list
phala apps

# Get CVM details
phala cvms get --interactive

# Restart CVM
phala cvms restart --interactive

# Stop CVM
phala cvms stop --interactive

# Start stopped CVM
phala cvms start --interactive

# Delete CVM
phala cvms delete --interactive
```

### Logs and Debugging

```bash
# View application logs
phala logs --interactive

# SSH into CVM
phala ssh --interactive

# Inside SSH session:
docker ps -a
docker logs dstack-wulong-1
docker inspect dstack-wulong-1
```

### SSH Key Management

```bash
# Add SSH key
phala ssh-keys add

# List SSH keys
phala ssh-keys list

# Remove SSH key
phala ssh-keys remove
```

### Instance Information

```bash
# View attestation
phala cvms attestation --interactive

# View runtime config
phala runtime-config --interactive
```

## Accessing Your Deployment

### Endpoint URL Format

Your application is accessible at:
```
https://<APP_ID>-<PORT>.<CLUSTER>.phala.network
```

For example:
```
https://0214f0d80bd3b81d61c79653590789ac38979c43-3000.dstack-pha-prod9.phala.network
```

### Finding Your Endpoint

1. **Via CLI**:
   ```bash
   phala cvms list
   # Shows APP_ID
   ```

2. **Via Phala Cloud UI**:
   - Go to instance details
   - Click "Network" tab
   - View "Ingress" URLs

### API Documentation

The Swagger UI is available at the root path:
```
https://<your-endpoint>.phala.network/
```

## Security Architecture

### Encrypted Secrets

Phala Cloud uses end-to-end encryption for secrets:

1. **Browser-side encryption**: When you deploy via UI or CLI, secrets are encrypted in your browser
2. **TEE-only decryption**: Only your application inside the TEE can decrypt the secrets
3. **No provider access**: Phala Cloud cannot access your decrypted secrets

From [src/config/secrets.service.ts](../src/config/secrets.service.ts:25):
```typescript
// In production, check if secrets are injected as environment variables (Phala Cloud)
// or if we need to fetch from external KMS
if (process.env.KMS_URL && !process.env.ADMIN_MLKEM_PUBLIC_KEY) {
  await this.loadFromKms();
} else {
  // Load from environment (encrypted secrets in TEE)
  this.logger.log('Loading secrets from TEE environment variables');
  // ...
}
```

### ML-KEM Encryption

The application uses ML-KEM-1024 (NIST FIPS 203) for quantum-resistant encryption:

- **Public key**: Exposed via `/chest/attestation` endpoint
- **Private key**: Kept secret inside the TEE, never exposed
- **Security level**: NIST Level 5 (256-bit classical security)
- **Key sizes**: 1568 bytes (public), 3168 bytes (private)

See [docs/ENCRYPTION.md](./ENCRYPTION.md) for more details.

### Attestation

Verify the TEE environment by accessing:
```
https://<your-endpoint>.phala.network/attestation
```

This returns:
- TEE platform information (TDX)
- Measurement registers (MRTD, RTMR)
- Event log
- App configuration hash

## Troubleshooting

### "No logs available"

This usually means the container isn't starting. SSH into the CVM and check:

```bash
phala ssh --interactive
docker logs dstack-wulong-1
```

Common issues:
- **exec format error**: Wrong architecture (must be AMD64, not ARM64)
- **Missing secrets**: Environment variables not properly configured
- **KMS errors**: Check KMS_URL or secret loading logic

### "exec format error"

Your Docker image was built for the wrong architecture. Rebuild with:

```bash
docker buildx build --platform linux/amd64 -t julienberanger/wulong:latest --push .
```

### Container keeps restarting

Check logs via SSH:
```bash
phala ssh --interactive
docker logs dstack-wulong-1
```

Verify secrets are properly injected:
```bash
docker exec dstack-wulong-1 env | grep ADMIN_MLKEM
```

### Cannot SSH into CVM

1. Add your SSH public key:
   ```bash
   phala ssh-keys add
   ```

2. Restart the CVM:
   ```bash
   phala cvms restart --interactive
   ```

3. Try connecting again:
   ```bash
   phala ssh --interactive
   ```

## Cost Estimation

Pricing varies by instance type and region. Example for `tdx.small`:

- **Compute**: ~$0.058/hour
- **Storage**: $0.003/hour per 20GB
- **Monthly estimate**: ~$44 for small instance

Check current pricing at https://cloud.phala.network/pricing

## Resources

### Documentation

- [Phala Cloud Docs](https://docs.phala.com/phala-cloud)
- [Getting Started Guide](https://docs.phala.com/phala-cloud/getting-started/start-from-cloud-ui)
- [Secure Environment Variables](https://docs.phala.com/phala-cloud/cvm/set-secure-environment-variables)
- [CLI Reference](https://docs.phala.com/phala-cloud/cli)

### Phala Network

- [Phala Cloud Dashboard](https://cloud.phala.network)
- [Phala Network](https://phala.network)
- [GitHub](https://github.com/Phala-Network)
- [Discord](https://discord.gg/phala)

### This Project

- [Main README](../README.md)
- [Local Setup](./LOCAL_SETUP.md)
- [Docker Guide](./DOCKER.md)
- [API Reference](./API_REFERENCE.md)

## Next Steps

After successful deployment:

1. **Test the API**: Make requests to your endpoints
2. **Monitor logs**: Use `phala logs --interactive` to monitor activity
3. **Set up monitoring**: Consider external monitoring for production
4. **Configure custom domain**: Set up custom DNS if needed
5. **Scale**: Adjust instance type or create replicas as needed

For production deployments, review [Phala's best practices](https://docs.phala.com/phala-cloud/best-practices).

## Comparison with Other Deployment Modes

| Feature | Local (No Docker) | Local (Docker) | Phala Cloud |
|---------|------------------|----------------|-------------|
| **Setup Complexity** | Low | Medium | Medium |
| **Hot Reload** | ✅ Yes | ✅ Yes (dev mode) | ❌ No |
| **TEE Environment** | ❌ No | ❌ No | ✅ Yes (Intel TDX) |
| **Attestation** | ❌ No | ❌ No | ✅ Yes |
| **TLS** | ✅ Self-signed | ❌ HTTP | ✅ Phala-managed |
| **Secret Encryption** | ⚠️  Manual | ⚠️  Manual | ✅ Browser-to-TEE |
| **Best For** | Development | Testing | Production |

See:
- [Local Setup Guide](./LOCAL_SETUP.md) - Run without Docker
- [Docker Guide](./DOCKER.md) - Run with Docker locally
