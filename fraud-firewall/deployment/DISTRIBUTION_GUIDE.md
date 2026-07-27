# Verum Omnis Fraud Firewall — Distribution & Download Guide

**Version:** 6.0.0  
**Publication:** www.verumglobal.foundation  
**Date:** 23 July 2026

---

## Download Locations

### Primary Distribution

**Website:** https://www.verumglobal.foundation/downloads/

**Available Files:**

1. **fraud-firewall-6.0.0.tar.gz** (~2-5 GB)
   - Complete deployment package
   - Includes bundled AI models (Gemma3, Gemma4, Mistral Instruct)
   - SHA-512 checksum included
   - Installation guide included

2. **fraud-firewall-6.0.0.zip** (~2-5 GB)
   - Windows-compatible archive
   - Same contents as .tar.gz
   - Recommended for Windows Server deployments

3. **INSTALLATION_GUIDE.md**
   - Step-by-step bank deployment
   - System requirements
   - Troubleshooting

4. **BANK_CONFIG_TEMPLATE.env**
   - Configuration template
   - All security settings pre-filled
   - Customize for your institution

5. **constitution-v6.0.0.pdf**
   - Constitutional constraints documentation
   - Court admissibility standards
   - Evidence sealing specifications

### Backup Distribution

For redundancy and geographic distribution:

- **AWS S3 + CloudFront CDN:**
  - S3 bucket: `fraud-firewall-releases.s3.amazonaws.com`
  - CloudFront: `d-xxx.cloudfront.net` (cached globally)
  - Recommended: 99.9% availability SLA

- **GitHub Releases:**
  - Repository: `anthropics/verum-omnis-firewall`
  - Release: v6.0.0
  - Alternative if website down

- **Google Drive (Institutional):**
  - For backup/archive purposes
  - Not recommended for production download
  - Requires institutional Google Workspace account

---

## File Integrity Verification

### SHA-512 Checksum

Every release is signed with SHA-512 hash:

```bash
# Download package
wget https://www.verumglobal.foundation/downloads/fraud-firewall-6.0.0.tar.gz
wget https://www.verumglobal.foundation/downloads/fraud-firewall-6.0.0.SHA512

# Verify integrity
sha512sum -c fraud-firewall-6.0.0.SHA512

# Expected output:
# fraud-firewall-6.0.0.tar.gz: OK
```

### GPG Signature (Production)

For production deployments, verify GPG signature:

```bash
# Import Verum Omnis public key
gpg --keyserver keyserver.ubuntu.com --recv-keys 0x<VERUM_GPG_KEY>

# Download signature
wget https://www.verumglobal.foundation/downloads/fraud-firewall-6.0.0.tar.gz.asc

# Verify signature
gpg --verify fraud-firewall-6.0.0.tar.gz.asc fraud-firewall-6.0.0.tar.gz

# Expected output:
# gpg: Signature made [date]
# gpg: Good signature from "Verum Omnis <security@verumglobal.foundation>"
```

---

## Bandwidth & Download Time Estimates

| Connection | Speed | Time | Notes |
|-----------|-------|------|-------|
| **1 Gbps** | ~125 MB/s | ~20-40 sec | Enterprise datacenter |
| **100 Mbps** | ~12.5 MB/s | ~3-4 min | Corporate broadband |
| **10 Mbps** | ~1.25 MB/s | ~30-40 min | Standard internet |
| **1 Mbps** | ~125 KB/s | ~5-7 hours | Mobile/remote |

**Recommendation:** Download on corporate network (100+ Mbps) for fastest installation.

---

## Deployment Scenarios

### Scenario 1: Single Bank (Greenfield)

```
1. Download package (~5 GB)        [4-5 minutes at 100 Mbps]
2. Extract to /opt/verum-firewall  [2-3 minutes]
3. Configure .env template         [10-15 minutes]
4. Run health check                [1-2 minutes]
5. Start service                   [3-5 minutes for model warmup]
6. Integration testing             [30-60 minutes]

Total: ~1-2 hours first-time deployment
```

### Scenario 2: Bank Network (10-50 institutions)

**Recommended approach:**

```
1. Download once to central repository
2. Host on internal CDN or S3-compatible storage
3. Push to each bank via:
   - VPN deployment script
   - Internal package manager (apt/yum)
   - Configuration management (Ansible/Terraform)
4. Monitor all instances via centralized dashboard

Deployment parallelization: O(n) where n = number of banks
```

**Infrastructure:**

```
AWS S3 Bucket (Regional)
    ↓
CloudFront CDN
    ↓
    ├─→ Bank A (ZA)
    ├─→ Bank B (UK)
    ├─→ Bank C (EU)
    └─→ Bank D (UAE)

Total cost: ~$50-200/month for typical distribution
```

### Scenario 3: Regulatory Distribution

For regulatory authorities requiring local deployment:

```
1. Package signed with GPG key
2. Published with compliance certificate
3. Distributed to:
   - Financial Intelligence Centre (SARB)
   - Prudential Authority (PA)
   - Court filing registry

Each institution verifies:
   ✓ SHA-512 hash matches
   ✓ GPG signature valid
   ✓ Constitution v6.0.0 embedded
   ✓ No modification since release
```

---

## Storage Architecture for Cloudflare Integration

### Current Setup

```
www.verumglobal.foundation
    ├─ Cloudflare DNS
    ├─ Cloudflare WAF (DDoS protection)
    └─ Cloudflare Workers (static file serving)
```

### Recommended Enhanced Setup (for deployment)

```
AWS S3 (Origin)
    ↓
Cloudflare R2 (S3-compatible, redundant)
    ↓
Cloudflare Pages / Workers (CDN + caching)
    ↓
www.verumglobal.foundation/downloads/
    ├─ fraud-firewall-6.0.0.tar.gz
    ├─ fraud-firewall-6.0.0.zip
    ├─ SHA512 checksums
    └─ Installation guide
```

### Cost Estimate

| Component | Service | Cost/month | Notes |
|-----------|---------|-----------|-------|
| **Storage** | R2 | $0.015/GB | 2-5 GB = $30-75/month |
| **Outbound** | R2 → Firewall | $0.02/GB | Depends on download volume |
| **CDN** | Cloudflare | Free tier | 200GB/day free → $0/month |
| **Domain** | Cloudflare | $0-14 | Included in current plan |
| **Total** | | **$50-200/month** | For 50+ banks downloading |

### Deployment Steps for Cloudflare

```
1. Create Cloudflare R2 bucket
   - Name: fraud-firewall-releases
   - Region: WORM (Write Once, Read Many)
   
2. Upload package
   - fraud-firewall-6.0.0.tar.gz
   - fraud-firewall-6.0.0.zip
   - SHA512 checksums
   
3. Configure Cloudflare Worker
   - Route: /downloads/*
   - Cache TTL: 30 days
   - Add Content-Disposition headers
   
4. DNS CNAME
   - downloads.verumglobal.foundation → R2 URL
```

---

## Alternative Storage Solutions

### Google Drive (Institutional)

**Pros:**
- No additional cost (included in Google Workspace)
- Familiar interface
- Audit logging included

**Cons:**
- Download speed limited (5-10 Mbps typical)
- Not ideal for 50+ simultaneous downloads
- Requires Google account

**Use case:** Internal backup, not primary distribution

```bash
# Upload to Google Drive
gcloud drive files upload fraud-firewall-6.0.0.tar.gz \
  --parents FOLDER_ID \
  --name "fraud-firewall-6.0.0.tar.gz"

# Share link
# https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

### GitHub Releases

**Pros:**
- Global CDN (via GitHub Pages)
- Built-in version control
- Automatic integrity verification

**Cons:**
- Soft limit: 2 GB per file (need to split)
- Rate limiting on large files
- Designed for source code, not large binaries

**Use case:** Secondary/backup distribution

```bash
# Create release
gh release create v6.0.0 \
  --title "Verum Omnis Fraud Firewall v6.0.0" \
  --notes "See INSTALLATION_GUIDE.md for deployment instructions"

# Upload files
gh release upload v6.0.0 fraud-firewall-6.0.0.tar.gz
gh release upload v6.0.0 fraud-firewall-6.0.0.zip
gh release upload v6.0.0 fraud-firewall-6.0.0.SHA512
```

### AWS S3 + CloudFront (Enterprise)

**Pros:**
- Unlimited storage
- Global CDN via CloudFront
- High availability (99.99% SLA)
- Cost-effective at scale

**Cons:**
- Requires AWS account
- More complex setup
- Additional cost (~$0.02/GB transfer)

**Use case:** Production distribution for 100+ banks

```bash
# Create S3 bucket
aws s3 mb s3://fraud-firewall-releases \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1

# Upload package
aws s3 cp fraud-firewall-6.0.0.tar.gz \
  s3://fraud-firewall-releases/ \
  --sse AES256 \
  --storage-class STANDARD_IA

# Create CloudFront distribution
# → Automatic HTTPS
# → Global CDN (90+ edge locations)
# → Average download time: 10-30 seconds worldwide
```

---

## Recommended Strategy (Priority Order)

### Phase 1 (Immediate)

✅ **Use:** Cloudflare R2 + Workers  
✓ Cost: $50-200/month  
✓ Setup: ~2 hours  
✓ Capacity: 50-200 banks  
✓ Maintenance: Minimal  

```
www.verumglobal.foundation/downloads/
    ├─ fraud-firewall-6.0.0.tar.gz
    ├─ fraud-firewall-6.0.0.zip
    └─ checksums/
```

### Phase 2 (Growth to 500+ banks)

⏳ **Add:** AWS S3 + CloudFront  
- Cost: $200-500/month
- Setup: ~4 hours
- Benefits: Higher availability, faster global distribution
- Fallback if Cloudflare R2 unavailable

### Phase 3 (Regulatory Distribution)

⏳ **Add:** GitHub Releases (split files if needed)  
- Free backup distribution
- Published releases with signatures
- Regulatory filing trail

---

## Bank Download Instructions

### For Bank IT Department

```
1. Navigate to: https://www.verumglobal.foundation/downloads/

2. Download latest package:
   [ ] fraud-firewall-6.0.0.tar.gz
   [ ] fraud-firewall-6.0.0.SHA512

3. Verify integrity:
   sha512sum -c fraud-firewall-6.0.0.SHA512

4. Extract to deployment server:
   tar xzf fraud-firewall-6.0.0.tar.gz \
     -C /opt/verum-firewall

5. Follow INSTALLATION_GUIDE.md for setup

6. Contact support@verumglobal.foundation if issues
```

---

## Monitoring & Analytics

### Download Tracking (Cloudflare)

```
Analytics available via:
  - Cloudflare Dashboard
  - Download counts per file
  - Geographic distribution
  - Bandwidth usage
  - Error rates

Recommended alerts:
  - Download failures > 10/day
  - Bandwidth spike > 50 Gbps
  - New geographic regions
```

### Post-Download Health Monitoring

Banks report health via:

```bash
# Each bank can submit health check
curl -X POST \
  https://www.verumglobal.foundation/api/v1/deployment/health \
  -H "X-Bank-ID: bank-001" \
  -H "Content-Type: application/json" \
  -d '{
    "deployed_version": "6.0.0",
    "models_loaded": 3,
    "vault_size_gb": 45,
    "uptime_hours": 720,
    "transactions_monitored": 150000,
    "fraud_alerts": 23,
    "constitution_verified": true
  }'
```

---

## Version Management

### Compatibility Matrix

| Bank Version | Firewall Version | Compatible? | Notes |
|--------------|------------------|-----------|-------|
| Latest (6.0.0) | 6.0.0 | ✓ | Full support |
| Latest (6.0.0) | 5.9.x | ⚠ | Limited (no new models) |
| Latest (6.0.0) | 5.0.x | ✗ | Not supported |

### Update Procedure (Future)

When v6.1.0 released:

```bash
1. Download new package
2. Stop service: systemctl stop verum-firewall
3. Backup vault: tar czf vault-backup-6.0.0.tar.gz vault/
4. Extract new version
5. Migrate data if needed
6. Run health check
7. Restart: systemctl start verum-firewall
```

---

## Support for Downloads

### Common Issues

**Q: Download is slow**  
A: Try alternate download method:
- Use AWS S3 link if available
- Download at different time
- Contact support for regional mirror

**Q: SHA512 checksum doesn't match**  
A: File may be corrupted:
- Delete downloaded file
- Download again
- Verify internet connection stability
- Contact support with failed checksum

**Q: Cannot extract on Windows**  
A: Use .zip format instead:
- Download fraud-firewall-6.0.0.zip
- Extract using built-in Windows extraction
- Or use 7-Zip / WinRAR

---

## Summary

**Recommended Distribution Architecture:**

```
Phase 1 (Now):       Cloudflare R2 + Workers ($50-200/month)
Phase 2 (50+ banks): Add AWS S3 + CloudFront ($200-500/month)
Phase 3 (Regulatory): GitHub Releases (Free backup)

Result: 99.9% availability, 10-30 sec downloads worldwide
```

**Banks can deploy:**
- Completely offline (no Verum connection needed)
- In secure, isolated environments
- With full regulatory compliance
- And constitutional court admissibility

---

**Document:** Fraud Firewall Distribution & Download Guide  
**Version:** 1.0  
**Date:** 23 July 2026  
**Constitution:** v6.0.0  
**Copyright © 2026 Verum Omnis. All rights reserved.**
