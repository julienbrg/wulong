# TEE Platform Deployment Guide

This guide provides step-by-step instructions for deploying Wulong to various Trusted Execution Environment (TEE) platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Platform-Specific Setup](#platform-specific-setup)
  - [AMD SEV-SNP](#amd-sev-snp)
  - [Intel TDX](#intel-tdx)
  - [AWS Nitro Enclaves](#aws-nitro-enclaves)
- [General TEE Configuration](#general-tee-configuration)
- [Verification and Testing](#verification-and-testing)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying to any TEE platform, ensure you have:

1. **Built the application**:
   ```bash
   pnpm install
   pnpm build
   ```

2. **Docker installed** (recommended for production):
   ```bash
   docker --version
   ```

3. **Environment variables configured**:
   ```bash
   cp .env.template .env
   # Edit .env with production values
   NODE_ENV=production
   KMS_URL=https://your-kms.example.com/release
   ```

4. **TLS certificates ready**: In production, certificates should be generated inside the enclave to ensure the host never sees the private key.

## Platform-Specific Setup

### AMD SEV-SNP

AMD Secure Encrypted Virtualization - Secure Nested Paging provides VM-level isolation with encrypted memory and attestation.

#### Hardware Requirements
- AMD EPYC 3rd Gen (Milan) or newer processor
- SEV-SNP enabled in BIOS
- Host OS with SEV-SNP support (Linux kernel 5.19+)

#### Installation Steps

1. **Enable SEV-SNP on the host**:
   ```bash
   # Check if SEV-SNP is available
   dmesg | grep -i sev

   # Should show: AMD Memory Encryption Features active: SEV SEV-ES SEV-SNP
   ```

2. **Install SEV-SNP guest tools**:
   ```bash
   # Ubuntu/Debian
   apt-get update
   apt-get install -y snpguest

   # Or build from source
   git clone https://github.com/virtee/snpguest
   cd snpguest
   cargo build --release
   cp target/release/snpguest /usr/local/bin/
   ```

3. **Verify device access**:
   ```bash
   ls -l /dev/sev-guest
   # Should show: crw------- 1 root root

   # Grant access to the application user if needed
   usermod -a -G sev <app-user>
   ```

4. **Launch the VM with SEV-SNP**:
   ```bash
   qemu-system-x86_64 \
     -enable-kvm \
     -cpu EPYC-v4 \
     -machine q35,confidential-guest-support=sev0,memory-backend=ram1 \
     -object memory-backend-memfd,id=ram1,size=4G,share=true,prealloc=false \
     -object sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1 \
     -m 4G \
     -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE.fd \
     -drive if=pflash,format=raw,file=/path/to/OVMF_VARS.fd \
     -drive file=disk.qcow2,if=none,id=disk0,format=qcow2 \
     -device virtio-scsi-pci,id=scsi0,disable-legacy=on,iommu_platform=true \
     -device scsi-hd,drive=disk0 \
     -netdev user,id=vmnic,hostfwd=tcp::3443-:443 \
     -device virtio-net-pci,disable-legacy=on,iommu_platform=true,netdev=vmnic \
     -nographic
   ```

5. **Inside the VM, verify SEV-SNP is active**:
   ```bash
   snpguest report /tmp/test.bin
   # Should succeed without errors
   ```

6. **Deploy the application**:
   ```bash
   # Copy application files to the VM
   cd /app/wulong

   # Generate TLS certificates inside the enclave
   mkdir -p /run/secrets
   openssl req -x509 -newkey rsa:4096 \
     -keyout /run/secrets/tls.key \
     -out /run/secrets/tls.cert \
     -days 365 -nodes \
     -subj "/CN=your-domain.com"

   # Start the application
   NODE_ENV=production node dist/main.js
   ```

#### Attestation Verification

```bash
# Get attestation report
curl -k https://your-server:443/attestation > attestation.json

# Extract and verify the report
cat attestation.json | jq -r '.report' | base64 -d > report.bin

# Verify with AMD KDS (Key Distribution Server)
snpguest verify report.bin --platform amd-sev-snp
```

### Intel TDX

Intel Trust Domain Extensions provides VM-level isolation with hardware-enforced confidentiality.

#### Hardware Requirements
- Intel Xeon Scalable 4th Gen (Sapphire Rapids) or newer
- TDX enabled in BIOS
- Host OS with TDX support (Linux kernel 5.19+)

#### Installation Steps

1. **Verify TDX support**:
   ```bash
   # Check CPU capabilities
   grep -o 'tdx_guest' /proc/cpuinfo

   # Check kernel module
   lsmod | grep tdx
   ```

2. **Install TDX tools**:
   ```bash
   # Ubuntu/Debian
   wget https://download.01.org/intel-sgx/latest/linux-latest/distro/ubuntu22.04-server/tdx-attest.deb
   dpkg -i tdx-attest.deb

   # Or build from source
   git clone https://github.com/intel/SGXDataCenterAttestationPrimitives
   cd QuoteGeneration/linux
   make
   make install
   ```

3. **Verify TDX device access**:
   ```bash
   ls -l /dev/tdx-guest
   # or
   ls -l /dev/tdx_guest

   # Check TDX module info
   cat /sys/firmware/tdx_seam/version
   ```

4. **Launch TD (Trust Domain)**:
   ```bash
   # Using QEMU with TDX support
   qemu-system-x86_64 \
     -accel kvm \
     -m 4G \
     -smp 4 \
     -object tdx-guest,id=tdx0 \
     -machine q35,kernel_irqchip=split,confidential-guest-support=tdx0,memory-backend=ram1 \
     -object memory-backend-memfd,id=ram1,size=4G,prealloc=true \
     -cpu host,-kvm-steal-time \
     -bios /usr/share/qemu/OVMF.fd \
     -drive file=disk.qcow2,if=virtio \
     -netdev user,id=vmnic,hostfwd=tcp::3443-:443 \
     -device virtio-net-pci,netdev=vmnic \
     -nographic
   ```

5. **Inside the TD, verify TDX is active**:
   ```bash
   # Generate test quote
   tdx-attest quote /tmp/test-quote.dat

   # Check MRTD (Measurement Register for TD)
   tdx-attest info
   ```

6. **Deploy the application**:
   ```bash
   cd /app/wulong

   # Generate TLS certificates inside the TD
   mkdir -p /run/secrets
   openssl req -x509 -newkey rsa:4096 \
     -keyout /run/secrets/tls.key \
     -out /run/secrets/tls.cert \
     -days 365 -nodes \
     -subj "/CN=your-domain.com"

   # Start the application
   NODE_ENV=production node dist/main.js
   ```

#### Attestation Verification

```bash
# Get attestation report
curl -k https://your-server:443/attestation > attestation.json

# Extract quote
cat attestation.json | jq -r '.report' | base64 -d > quote.dat

# Verify with Intel Attestation Service
# Use Intel's DCAP (Data Center Attestation Primitives) verification library
```

### AWS Nitro Enclaves

AWS Nitro Enclaves provide isolated compute environments on EC2 instances.

#### Prerequisites
- EC2 instance with Nitro Enclaves support (M5, M5d, M6i, C5, C5d, C6i, R5, R5d, R6i, etc.)
- Amazon Linux 2 or Ubuntu 20.04+
- At least 4 vCPUs (2 for enclave, 2 for parent)

#### Installation Steps

1. **Install Nitro CLI**:
   ```bash
   # Amazon Linux 2
   sudo amazon-linux-extras install aws-nitro-enclaves-cli -y
   sudo yum install aws-nitro-enclaves-cli-devel -y

   # Ubuntu
   wget https://github.com/aws/aws-nitro-enclaves-cli/releases/latest/download/nitro-cli_$(uname -m).deb
   sudo dpkg -i nitro-cli_$(uname -m).deb
   ```

2. **Configure the instance**:
   ```bash
   # Allocate resources for enclaves (2 vCPUs, 2048 MB memory)
   sudo sed -i 's/^cpu_count:.*/cpu_count: 2/' /etc/nitro_enclaves/allocator.yaml
   sudo sed -i 's/^memory_mib:.*/memory_mib: 2048/' /etc/nitro_enclaves/allocator.yaml

   # Enable and start the allocator service
   sudo systemctl enable --now nitro-enclaves-allocator.service
   sudo systemctl enable --now docker

   # Add user to docker and ne groups
   sudo usermod -aG docker $USER
   sudo usermod -aG ne $USER

   # Re-login for group changes to take effect
   ```

3. **Build enclave image**:
   ```bash
   # Create Dockerfile for enclave
   cat > Dockerfile.enclave <<EOF
   FROM node:20-slim

   WORKDIR /app

   # Copy application files
   COPY package*.json pnpm-lock.yaml ./
   COPY dist ./dist

   # Install dependencies
   RUN npm install -g pnpm && pnpm install --prod

   # Generate TLS certificates
   RUN mkdir -p /run/secrets && \
       openssl req -x509 -newkey rsa:4096 \
       -keyout /run/secrets/tls.key \
       -out /run/secrets/tls.cert \
       -days 365 -nodes \
       -subj "/CN=enclave.local"

   # Set environment
   ENV NODE_ENV=production

   EXPOSE 443

   CMD ["node", "dist/main.js"]
   EOF

   # Build Docker image
   docker build -f Dockerfile.enclave -t wulong-enclave:latest .

   # Build Nitro Enclave Image File (EIF)
   nitro-cli build-enclave \
     --docker-uri wulong-enclave:latest \
     --output-file wulong.eif

   # Save PCR values for attestation verification
   nitro-cli describe-eif --eif-path wulong.eif > pcr-values.json
   ```

4. **Run the enclave**:
   ```bash
   # Start the enclave
   nitro-cli run-enclave \
     --eif-path wulong.eif \
     --cpu-count 2 \
     --memory 2048 \
     --enclave-cid 16 \
     --debug-mode

   # Check enclave status
   nitro-cli describe-enclaves

   # View enclave console (debug mode only)
   nitro-cli console --enclave-id $(nitro-cli describe-enclaves | jq -r '.[0].EnclaveID')
   ```

5. **Set up parent instance proxy** (to forward traffic to enclave):
   ```bash
   # Install vsock-proxy
   sudo yum install socat -y

   # Forward port 443 to enclave
   socat TCP-LISTEN:443,fork VSOCK-CONNECT:16:443 &
   ```

#### Attestation Verification

```bash
# Get attestation report
curl https://your-server:443/attestation > attestation.json

# Extract and parse attestation document (CBOR format)
cat attestation.json | jq -r '.report' | base64 -d > attestation.cbor

# Verify using aws-nitro-enclaves-cose
# Install verification tools
pip install cbor2 cryptography

# Python script to verify attestation
python3 <<EOF
import cbor2
import base64
from cryptography import x509
from cryptography.hazmat.backends import default_backend

# Load attestation document
with open('attestation.cbor', 'rb') as f:
    attestation = cbor2.load(f)

# Verify signature and certificate chain
# Extract PCRs and compare with expected values
print(f"PCR0: {attestation['pcrs'][0].hex()}")
print(f"PCR1: {attestation['pcrs'][1].hex()}")
print(f"PCR2: {attestation['pcrs'][2].hex()}")

# Compare with values from pcr-values.json
EOF
```

## General TEE Configuration

### Environment Variables

Create a production `.env` file inside the TEE:

```bash
NODE_ENV=production
PORT=443
KMS_URL=https://your-kms.example.com/release
TLS_KEY_PATH=/run/secrets/tls.key
TLS_CERT_PATH=/run/secrets/tls.cert
```

### KMS Integration

Configure your Key Management Service to release secrets only after attestation verification:

1. **KMS should verify**:
   - Platform-specific attestation report signature
   - Measurement hash matches expected value
   - Timestamp is recent (within acceptable time window)
   - Platform is a legitimate TEE (AMD SEV-SNP, Intel TDX, or AWS Nitro)

2. **Expected measurement calculation**:
   ```bash
   # For Docker images
   docker inspect wulong:latest | jq -r '.[0].RootFS.Layers[]' | sha256sum

   # For AWS Nitro
   cat pcr-values.json | jq -r '.Measurements.PCR0'
   ```

3. **KMS endpoint example**:
   ```bash
   curl -X POST https://your-kms.example.com/release \
     -H "Content-Type: application/json" \
     -d '{
       "attestation_report": "base64-encoded-report",
       "platform": "amd-sev-snp",
       "measurement": "hex-measurement"
     }'
   ```

## Verification and Testing

### 1. Test Attestation Endpoint

```bash
# Check if attestation is working
curl -k https://your-server:443/attestation | jq .

# Expected response:
# {
#   "platform": "amd-sev-snp" | "intel-tdx" | "aws-nitro",
#   "report": "base64-encoded-attestation",
#   "measurement": "hex-measurement-hash",
#   "timestamp": "2026-03-17T..."
# }

# If platform is "none", you're NOT in a TEE
```

### 2. Verify TLS Termination Inside TEE

```bash
# Confirm TLS private key never touched the host
# The key should only exist inside the TEE memory
# Check host filesystem - key should NOT be there
sudo find /var /tmp /root -name "tls.key" 2>/dev/null

# Should return no results
```

### 3. Test Health Endpoints

```bash
# Health check
curl -k https://your-server:443/health

# Readiness probe
curl -k https://your-server:443/health/ready

# Liveness probe
curl -k https://your-server:443/health/live
```

### 4. Verify Logging is Sanitized

```bash
# Check application logs - should NOT contain sensitive data
# Test by sending a request with sensitive data
curl -k -X POST https://your-server:443/api/test \
  -H "Content-Type: application/json" \
  -d '{"secret": "my-password-123", "data": "sensitive info"}'

# Check logs - should NOT show "my-password-123" or "sensitive info"
# Only sanitized entries like: "Request received" without actual data
```

## Security Considerations

### Best Practices

1. **Never share TLS private keys**: Generate certificates inside the TEE, never import from outside
2. **Verify attestation before sending data**: Clients must verify attestation reports before transmitting sensitive information
3. **Use secure KMS**: Implement attestation-based key release in your KMS
4. **Monitor for side-channel attacks**: See [SIDE_CHANNEL_ATTACKS.md](SIDE_CHANNEL_ATTACKS.md) for mitigations
5. **Regular security updates**: Keep TEE firmware and guest OS patched
6. **Implement rate limiting**: Protect against DoS attacks (already configured in the app)
7. **Log monitoring**: Review logs for unusual patterns while ensuring no sensitive data is logged

### Threat Model Reminder

**Protected against**:
- Malicious host operator reading memory
- Network eavesdropping (TLS terminates in enclave)
- Log-based data exfiltration
- Stack trace information leakage

**NOT protected against**:
- Side-channel attacks (timing, cache, power analysis)
- Physical access to hardware
- Compromised TEE firmware/hardware
- Application logic vulnerabilities
- Social engineering

### Trust Assumptions

You MUST trust:
1. TEE hardware vendor (AMD/Intel/AWS)
2. This application code (verify source and attestation)
3. KMS that releases secrets
4. Build process integrity

You do NOT need to trust:
1. Host OS or cloud provider operator
2. Network infrastructure
3. Storage backend (if properly encrypted)

## Troubleshooting

### Common Issues

#### "No TEE detected" in production

**Problem**: Application shows `platform: "none"` in attestation endpoint.

**Solution**:
```bash
# Check device files exist
ls -l /dev/sev-guest /dev/tdx-guest /dev/nsm

# Check kernel modules loaded
lsmod | grep -E 'sev|tdx|nsm'

# Check BIOS settings - ensure TEE is enabled

# For VMs, ensure launched with proper parameters
```

#### Attestation generation fails

**Problem**: Error logs show "Failed to generate X attestation".

**Solution**:
```bash
# Verify platform tools are installed
which snpguest  # For AMD SEV-SNP
which tdx-attest  # For Intel TDX
which nitro-cli  # For AWS Nitro

# Check permissions
ls -l /dev/sev-guest  # Should be readable by app user

# Test tool directly
snpguest report /tmp/test.bin  # AMD
tdx-attest quote /tmp/test.dat  # Intel
nitro-cli describe-enclaves  # AWS
```

#### TLS certificate errors

**Problem**: "ENOENT: no such file or directory, open '/run/secrets/tls.key'"

**Solution**:
```bash
# Ensure secrets directory exists
mkdir -p /run/secrets

# Generate certificates inside TEE
openssl req -x509 -newkey rsa:4096 \
  -keyout /run/secrets/tls.key \
  -out /run/secrets/tls.cert \
  -days 365 -nodes \
  -subj "/CN=your-domain.com"

# Check permissions
chmod 600 /run/secrets/tls.key
chmod 644 /run/secrets/tls.cert
```

#### Performance issues

**Problem**: Application runs slowly inside TEE.

**Solution**:
```bash
# Allocate more resources
# For AMD/Intel VMs: increase vCPUs and memory
# For AWS Nitro: adjust enclave configuration

# Check for side-channel mitigations overhead
# Some mitigations can impact performance

# Monitor resource usage
top
free -h
```

### Getting Help

- Check application logs (sanitized, safe to share)
- Review platform-specific documentation
- File issues at the Wulong repository
- Consult TEE platform vendor support

### Useful Commands Reference

```bash
# AMD SEV-SNP
snpguest report /tmp/report.bin
snpguest verify /tmp/report.bin

# Intel TDX
tdx-attest quote /tmp/quote.dat
tdx-attest info

# AWS Nitro
nitro-cli describe-enclaves
nitro-cli console --enclave-id <ID>
nitro-cli describe-eif --eif-path <path>

# Application
curl -k https://localhost:443/attestation
curl -k https://localhost:443/health
NODE_ENV=production node dist/main.js
```

## Next Steps

After successful deployment:

1. **Integrate with your KMS**: Configure attestation-based secret release
2. **Set up monitoring**: Track attestation verification attempts, error rates
3. **Implement client verification**: Ensure clients verify attestation before sending data
4. **Document your deployment**: Record measurement hashes, PCR values for verification
5. **Plan for updates**: Develop a strategy for updating code while maintaining attestation

For more information:
- [README.md](../README.md) - General project information
- [SIDE_CHANNEL_ATTACKS.md](SIDE_CHANNEL_ATTACKS.md) - Side-channel attack mitigations
- Platform documentation: AMD SEV-SNP, Intel TDX, AWS Nitro Enclaves
