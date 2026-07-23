# Verum Omnis Fraud Firewall — Bank Server Installation Guide

**Version:** 6.0.0  
**Document Date:** 23 July 2026  
**Compliance Framework:** SA Constitutional Court  
**Constitution:** v6.0.0

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Verification](#pre-installation-verification)
3. [Installation Steps](#installation-steps)
4. [Model Deployment](#model-deployment)
5. [Configuration](#configuration)
6. [Health Check & Validation](#health-check--validation)
7. [Startup & Operations](#startup--operations)
8. [Troubleshooting](#troubleshooting)
9. [Regulatory Compliance](#regulatory-compliance)
10. [Support & Escalation](#support--escalation)

---

## System Requirements

### Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 8 cores | 16+ cores |
| **RAM** | 32 GB | 64+ GB |
| **Storage** | 200 GB | 500 GB+ |
| **Network** | 100 Mbps | 1 Gbps |

### Software

| Component | Version |
|-----------|---------|
| **Node.js** | 20.x or 22.x |
| **OS** | Linux (Ubuntu 22.04+) or Windows Server 2022 |
| **Disk Type** | SSD recommended |
| **File System** | ext4 (Linux) or NTFS (Windows) |

### Network

- **Outbound connectivity** (optional, for external fraud data):
  - OpenTimestamps: `a.opentimestamps.org:80` (evidence blockchain anchoring)
  - News APIs: Your configured external data sources
  - Regulatory feeds: Your configured compliance feeds

- **NO connection to Verum Omnis infrastructure required**
  - System is completely offline-capable
  - Evidence vault remains entirely on-premises
  - No customer data leaves your servers

### Security

- **Admin access** to target server
- **Ability to create directories** under `/opt` (or equivalent on Windows)
- **Ability to manage ports** (default: 8787)
- **Firewall rules** to block public internet access to Firewall port

---

## Pre-Installation Verification

### 1. Check Node.js Installation

```bash
node --version  # Should be v20.0.0 or higher
npm --version   # Should be 10.0.0 or higher
```

### 2. Verify Disk Space

```bash
# Check available space
df -h /opt

# You need at least 200 GB available
# Recommendation: 500 GB+ for 2+ years of audit logs
```

### 3. Verify Port Availability

```bash
# Check if port 8787 is available
netstat -an | grep 8787
# Should return empty (no results)

# If in use, configure FIREWALL_PORT in .env before installation
```

### 4. Download the Fraud Firewall Package

```bash
# Package location: https://www.verumglobal.foundation/downloads/fraud-firewall-6.0.0.tar.gz
# Size: ~2-5 GB (includes bundled AI models)

cd /tmp
wget https://www.verumglobal.foundation/downloads/fraud-firewall-6.0.0.tar.gz

# Verify SHA-512 checksum (provided separately)
sha512sum fraud-firewall-6.0.0.tar.gz
# Should match: [CHECKSUM_PROVIDED_BY_VERUM]
```

---

## Installation Steps

### Step 1: Extract Package

```bash
# Create installation directory
sudo mkdir -p /opt/verum-firewall
cd /opt/verum-firewall

# Extract package (as root or with sudo)
sudo tar xzf /tmp/fraud-firewall-6.0.0.tar.gz

# Verify extraction
ls -la /opt/verum-firewall
# Should show: app/, models/, vault/, config/, etc.
```

### Step 2: Set Permissions

```bash
# Ensure correct ownership
sudo chown -R firewall-user:firewall-group /opt/verum-firewall

# Set secure permissions
sudo chmod 755 /opt/verum-firewall
sudo chmod 755 /opt/verum-firewall/app
sudo chmod 700 /opt/verum-firewall/vault
sudo chmod 600 /opt/verum-firewall/.env

# Create firewall-user if not exists
sudo useradd -m -s /bin/false firewall-user
```

### Step 3: Install Node.js Dependencies

```bash
cd /opt/verum-firewall/app

# Install npm packages
npm ci --production

# Verify installation
npm list | grep -E "(mistral|gemma|verum)"
# Should show key dependencies
```

### Step 4: Initialize Directories

```bash
# Create vault structure (will be created during init)
npm run init-deployment

# This will:
# - Create /opt/verum-firewall/vault/evidence
# - Create /opt/verum-firewall/vault/audit-logs
# - Create /opt/verum-firewall/vault/seized-transactions
# - Create /opt/verum-firewall/vault/outbound-email
# - Verify Constitution v6.0.0 embedding
# - Load all AI models
```

---

## Model Deployment

### Bundled Models

The package includes three AI models in ONNX format:

| Model | Size | Purpose | Loaded By |
|-------|------|---------|-----------|
| **Gemma3** | ~2.0 GB | Forensic validation, evidence integrity | Evidence Sealing Engine |
| **Gemma4** | ~1.5 GB | Pattern detection, anomaly analysis | Fraud Detection Pipeline |
| **Mistral Instruct** | ~1.0 GB | Real-time fraud prevention agents | Transaction Blocking |

### Verify Models Loaded

```bash
cd /opt/verum-firewall/app

# Check model integrity
npm run verify-models

# Output should show:
# ✓ Gemma3 loaded (ONNX, 2048 MB)
# ✓ Gemma4 loaded (ONNX, 1536 MB)
# ✓ Mistral Instruct loaded (ONNX, 1024 MB)
```

### Model Performance Notes

- **First startup**: Models load into memory (~5-10 minutes)
- **Subsequent startups**: ~2-3 minutes (warm start)
- **Memory usage**: ~12-16 GB for all three models
- **CPU usage**: Varies by transaction volume (typically 20-40%)

---

## Configuration

### Step 1: Copy Configuration Template

```bash
cd /opt/verum-firewall

# Copy the template
cp deployment/bank-config-template.env .env

# Edit for your institution
nano .env
# (or use your preferred editor)
```

### Step 2: Configure Key Fields

```bash
# Edit these critical fields:

INSTITUTION_NAME=Your Bank Name
INSTITUTION_ID=bank-XXX
JURISDICTION=ZA

FRAUD_DEPARTMENT_EMAIL=fraud@yourbank.com
SUPPORT_EMAIL=support@yourbank.com

FIREWALL_PORT=8787
FIREWALL_VAULT_DIR=/opt/verum-firewall/vault

# Generate strong admin key (for MVP)
# In production: Use JWT/OAuth
ADMIN_KEY=$(openssl rand -hex 32)
echo "ADMIN_KEY=$ADMIN_KEY" >> .env

# External data (optional)
ENABLE_EXTERNAL_DATA=false  # Set to true if you have internet + APIs
```

### Step 3: Verify Configuration

```bash
cd /opt/verum-firewall/app

# Validate configuration
npm run validate-config

# Should output:
# ✓ Configuration valid
# ✓ All required fields present
# ✓ Directories writable
# ✓ Constitution v6.0.0 found
```

---

## Health Check & Validation

### Pre-Deployment Health Check

```bash
cd /opt/verum-firewall/app

npm run health-check

# Output:
# =====================================
# VERUM OMNIS FIREWALL HEALTH CHECK
# =====================================
# 
# Storage:        ✓ WRITABLE
# Models:         ✓ LOADED (3/3)
# Constitution:   ✓ v6.0.0
# Audit Logs:     ✓ ACCESSIBLE
# Port 8787:      ✓ AVAILABLE
# Vault Space:    ✓ 450 GB available
# 
# Overall:        ✓ READY FOR DEPLOYMENT
```

### Constitution Verification

The Constitution v6.0.0 is embedded in the deployment package and enforced at runtime:

```bash
# Verify Constitution is loaded
npm run verify-constitution

# Should output:
# ✓ Constitution v6.0.0 loaded
# ✓ Constraints enforced:
#   - Findings cannot be suppressed
#   - All contradictions reported
#   - Evidence always sealed
#   - Chain of custody maintained
```

---

## Startup & Operations

### Manual Startup (for testing)

```bash
cd /opt/verum-firewall/app

npm start

# Server starts on http://localhost:8787
# Press Ctrl+C to stop
```

### Systemd Service Setup (production)

```bash
# Create systemd service
sudo tee /etc/systemd/system/verum-firewall.service > /dev/null <<EOF
[Unit]
Description=Verum Omnis Fraud Firewall
After=network.target

[Service]
Type=simple
User=firewall-user
WorkingDirectory=/opt/verum-firewall/app
EnvironmentFile=/opt/verum-firewall/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload, enable, and start
sudo systemctl daemon-reload
sudo systemctl enable verum-firewall
sudo systemctl start verum-firewall

# Check status
sudo systemctl status verum-firewall
```

### View Logs

```bash
# Real-time logs
sudo journalctl -u verum-firewall -f

# Last 100 lines
sudo journalctl -u verum-firewall -n 100

# Audit logs (local vault)
tail -f /opt/verum-firewall/vault/audit-logs/audit.jsonl
```

### API Verification

```bash
# Test API (requires X-Admin-Key header)
curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  http://localhost:8787/api/v1/admin/health

# Should return:
# {
#   "healthy": true,
#   "components": {
#     "storage_writable": true,
#     "models_loaded": true,
#     "constitution_embedded": true,
#     "audit_logs_accessible": true
#   }
# }
```

---

## Troubleshooting

### Models Not Loading

```bash
# Check model directory
ls -la /opt/verum-firewall/models

# Should contain: gemma3/, gemma4/, mistral-instruct/

# Verify ONNX files
ls -la /opt/verum-firewall/models/gemma3/*.onnx
ls -la /opt/verum-firewall/models/gemma4/*.onnx
ls -la /opt/verum-firewall/models/mistral-instruct/*.onnx

# If missing, re-extract package:
sudo tar xzf /tmp/fraud-firewall-6.0.0.tar.gz -C /opt/verum-firewall
```

### Port Already in Use

```bash
# Find what's using port 8787
sudo lsof -i :8787

# Either:
# 1. Stop the other service
# 2. Change FIREWALL_PORT in .env to different port (e.g., 8788)
```

### Insufficient Disk Space

```bash
# Check vault size
du -sh /opt/verum-firewall/vault

# Options:
# 1. Expand partition/storage
# 2. Archive old audit logs:
#    gzip -9 /opt/verum-firewall/vault/audit-logs/audit-2026-Q1.jsonl
# 3. Extend retention (in .env): AUDIT_RETENTION_DAYS=1825 (5 years)
```

### Constitution Validation Fails

```bash
# Verify Constitution file
file /opt/verum-firewall/app/constitution-v6.0.0.json

# Re-extract if corrupted
sudo tar xzf /tmp/fraud-firewall-6.0.0.tar.gz -C /opt/verum-firewall \
  --wildcards '*/constitution-v6.0.0*'

# Restart service
sudo systemctl restart verum-firewall
```

---

## Regulatory Compliance

### Chain of Custody

All evidence is sealed and audited locally:

```bash
# View audit trail
tail -100 /opt/verum-firewall/vault/audit-logs/audit.jsonl | jq '.'

# Each entry contains:
# {
#   "log_id": "AL-XXXX",
#   "timestamp": "2026-07-23T...",
#   "agent_id": "TransactionMonitor-001-...",
#   "action": "BLOCKED_TRANSACTION_CRITICAL",
#   "target": "txn-123456",
#   "reason": "Fraud pattern detected",
#   "confidence": "HIGH",
#   "sha512": "<hash proof of integrity>",
#   "gps": { "latitude": ..., "longitude": ... }
# }
```

### Sealed Evidence

All evidence is sealed with SHA-512 + Bitcoin blockchain anchoring:

```bash
# View sealed evidence
ls -la /opt/verum-firewall/vault/evidence/

# Each seal file contains:
# - Document content (encrypted/hashed)
# - SHA-512 hash (FIPS 180-4)
# - OpenTimestamps anchor (Bitcoin block height)
# - Forensic metadata

# Verify seal integrity
npm run verify-seal -- seal-id-here

# If hash matches when verified at:
# https://www.verumglobal.foundation/verify
# → Evidence has not been tampered with
```

### Data Privacy

**Critical: Evidence remains on your servers and is NEVER transmitted to Verum.**

- ✓ Fraud alerts sent to your fraud department
- ✓ Commission invoice sent (amount only, no evidence)
- ✗ Customer data never leaves your servers
- ✗ Transaction details never leave your servers
- ✗ Evidence files never transmitted

---

## Support & Escalation

### Escalation Procedure

1. **Collect diagnostics:**
   ```bash
   cd /opt/verum-firewall/app
   npm run collect-diagnostics > diagnostics.tar.gz
   # Creates: institutions, models, config versions, recent logs
   ```

2. **Contact Verum Omnis Support:**
   - Email: support@verumglobal.foundation
   - Subject: `[Firewall Support] Your Bank Name — Issue Description`
   - Attach: `diagnostics.tar.gz`

3. **Include in Support Request:**
   - Your institution name and ID
   - Jurisdiction
   - Error message (from logs)
   - Steps to reproduce
   - Timestamp of issue

### Known Limitations

- **Authentication:** Currently uses admin key (MVP mode)
  - Production deployment needs: JWT/OAuth with institutional tokens
  
- **External data:** Optional, requires explicit configuration
  - No data transmitted without consent
  - Can be disabled at any time
  
- **Manual approval required** for:
  - Extreme alert situations (non-standard fraud patterns)
  - System configuration changes
  - Constitution updates (if ever released)

---

## Post-Installation

### Initial Operations

1. **Send test fraud alert:**
   ```bash
   # Create test transaction for detection
   npm run test-alert -- amount=100000 type=anomaly
   ```

2. **Verify email dispatch:**
   - Check `/opt/verum-firewall/vault/outbound-email/` for test email
   - Configure SMTP if enabled in .env
   - Test actual delivery before production

3. **Integration testing:**
   - Connect to your transaction system
   - Verify fraud scoring pipeline
   - Test Mistral agent blocking authority
   - Validate audit log recording

4. **Regulatory notification:**
   - Inform your compliance team of deployment
   - Share Constitution v6.0.0 document
   - Document in your compliance register

---

**Installation Complete**

Your Verum Omnis Fraud Firewall is now ready for operation. All evidence remains under your control, and the system enforces Constitutional constraints at the code level.

For questions or issues, contact: support@verumglobal.foundation

---

**Document Version:** 1.0  
**Date:** 23 July 2026  
**Constitution:** v6.0.0  
**Copyright © 2026 Verum Omnis. All rights reserved.**
