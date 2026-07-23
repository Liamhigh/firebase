# Verum Omnis Fraud Firewall — Deployment Checklist

**Version:** 6.0.0  
**Last Updated:** 23 July 2026  
**Constitution:** v6.0.0

---

## Pre-Deployment Checklist (Bank IT)

Use this checklist to verify readiness before deploying to production.

### 1. Infrastructure Readiness

- [ ] **Server Hardware**
  - [ ] CPU: 8+ cores (16+ recommended)
  - [ ] RAM: 32+ GB (64+ recommended)
  - [ ] Storage: 200+ GB available (500+ GB recommended)
  - [ ] Network: 100+ Mbps connection

- [ ] **Software Requirements**
  - [ ] Node.js 20.x or 22.x installed
  - [ ] npm 10.x or later installed
  - [ ] Linux (Ubuntu 22.04+) or Windows Server 2022
  - [ ] Git (optional, for version tracking)

- [ ] **Network Configuration**
  - [ ] Port 8787 is available and not in use
  - [ ] Firewall allows port 8787 (internal only)
  - [ ] No public internet exposure to Firewall port
  - [ ] VPN/internal network access configured

### 2. Pre-Installation

- [ ] **Download Package**
  - [ ] Downloaded fraud-firewall-6.0.0.tar.gz or .zip
  - [ ] Size verified (~2-5 GB)
  - [ ] SHA-512 checksum verified
  - [ ] GPG signature verified (if signed)

- [ ] **Disk Space**
  - [ ] `/opt/verum-firewall`: 200+ GB available
  - [ ] Temp directory: 10 GB available
  - [ ] Audit log directory: 100+ GB available

- [ ] **Documentation Review**
  - [ ] Read BANK_INSTALLATION_GUIDE.md
  - [ ] Read DISTRIBUTION_GUIDE.md
  - [ ] Understand Constitutional constraints
  - [ ] Review commission structure (20% hard-coded)

### 3. Installation Preparation

- [ ] **User & Permissions**
  - [ ] Created `firewall-user` service account
  - [ ] Created `firewall-group` service group
  - [ ] Assigned proper directory permissions
  - [ ] Restricted .env file (mode 600)

- [ ] **Directory Structure**
  - [ ] `/opt/verum-firewall/` created
  - [ ] `./app/` directory ready
  - [ ] `./models/` directory ready
  - [ ] `./vault/` directory structure ready

- [ ] **Configuration Preparation**
  - [ ] Copied `.env.template` to `.env`
  - [ ] INSTITUTION_NAME configured
  - [ ] JURISDICTION configured
  - [ ] FRAUD_DEPARTMENT_EMAIL configured
  - [ ] Generated strong ADMIN_KEY

### 4. Model Deployment

- [ ] **AI Models**
  - [ ] Gemma3 ONNX model installed
  - [ ] Gemma4 ONNX model installed
  - [ ] Mistral Instruct ONNX model installed
  - [ ] All models in correct directory structure

- [ ] **Model Verification**
  - [ ] Ran: `npm run verify-models`
  - [ ] All 3 models reported as loaded
  - [ ] No missing model errors

### 5. Pre-Deployment Verification

- [ ] **Health Checks**
  - [ ] Ran: `npm run validate-config`
  - [ ] Configuration validation passed
  - [ ] Ran: `npm run health-check`
  - [ ] All health checks passed (✓ READY)

- [ ] **Constitution Verification**
  - [ ] Ran: `npm run verify-constitution`
  - [ ] Constitution v6.0.0 confirmed
  - [ ] Constraints list verified

- [ ] **Storage Verification**
  - [ ] Vault directory is writable
  - [ ] Audit logs directory accessible
  - [ ] Evidence directory accessible
  - [ ] Sufficient disk space confirmed

---

## Deployment Steps

### Step 1: Installation (One-Time)

```bash
# Run installation script
sudo bash deployment/install.sh /opt/verum-firewall 8787

# Verify installation completed successfully
ls -la /opt/verum-firewall/
```

**Expected Output:**
- ✓ All directories created
- ✓ Dependencies installed
- ✓ Systemd service configured
- ✓ No errors reported

### Step 2: Configuration

```bash
# Edit configuration
nano /opt/verum-firewall/.env

# Key fields to customize:
# - INSTITUTION_NAME
# - INSTITUTION_ID
# - JURISDICTION
# - FRAUD_DEPARTMENT_EMAIL
# - FIREWALL_PORT (if not 8787)
```

- [ ] **Required Fields Set**
  - [ ] INSTITUTION_NAME
  - [ ] JURISDICTION
  - [ ] FRAUD_DEPARTMENT_EMAIL

- [ ] **Security Configured**
  - [ ] ADMIN_KEY is strong (random hex string)
  - [ ] .env file permissions: 600
  - [ ] No credentials in version control

### Step 3: Model Verification

```bash
# Verify all models loaded
npm run verify-models

# Expected: All 3 models loaded (✓)
```

- [ ] **Gemma3** loaded
- [ ] **Gemma4** loaded
- [ ] **Mistral Instruct** loaded

### Step 4: Constitutional Verification

```bash
# Verify Constitution embedding
npm run verify-constitution

# Expected: Constitution v6.0.0 found and verified
```

- [ ] Constitution v6.0.0 confirmed
- [ ] Constitutional constraints enforced

### Step 5: System Health Check

```bash
# Run comprehensive health check
npm run health-check

# Expected: All systems ready (✓ READY FOR DEPLOYMENT)
```

**Check Components:**
- [ ] Storage writable
- [ ] Models loaded
- [ ] Constitution embedded
- [ ] Audit logs accessible
- [ ] Port available

---

## Production Deployment

### Start Service

```bash
# Start the Firewall service
sudo systemctl start verum-firewall

# Enable to start on boot
sudo systemctl enable verum-firewall

# Verify running
sudo systemctl status verum-firewall
```

- [ ] Service started successfully
- [ ] No errors in startup logs
- [ ] Enabled for auto-start on reboot

### Monitor Startup

```bash
# Watch real-time logs
sudo journalctl -u verum-firewall -f

# Expected output:
# [timestamp] Verum Omnis Fraud Firewall v6.0.0 initialized
# [timestamp] Constitution v6.0.0 loaded
# [timestamp] Mistral agents ready for deployment
# [timestamp] Server listening on port 8787
```

- [ ] Service started without errors
- [ ] Constitution loaded
- [ ] Models initialized
- [ ] API listening on configured port

### Test API

```bash
# Get health status
curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  http://localhost:8787/api/v1/admin/health

# Expected response:
# {
#   "healthy": true,
#   "components": {
#     "storage_writable": true,
#     "models_loaded": true,
#     "constitution_embedded": true
#   }
# }
```

- [ ] API responds successfully
- [ ] Health status reports all green
- [ ] Admin authentication working

### Integration Testing

```bash
# Generate test fraud alert
npm run test-alert -- --amount=100000 --type=anomaly

# Verify alert recorded
tail -10 /opt/verum-firewall/vault/audit-logs/audit.jsonl

# Verify email generated
ls -la /opt/verum-firewall/vault/outbound-email/
```

- [ ] Test alert generated successfully
- [ ] Alert logged in audit trail
- [ ] Email dispatch created
- [ ] Mistral agents responding

---

## Post-Deployment Validation

### Evidence Sealing

- [ ] Fraud alerts are sealed with SHA-512
- [ ] Seals are recorded in audit trail
- [ ] Evidence vault is on-premises only
- [ ] No customer data in emails to Verum

### Commission Processing

- [ ] Commission invoices calculated (20% hard-coded)
- [ ] Invoices sent to Verum only (no evidence)
- [ ] Commission amount matches fraud_amount * 0.2
- [ ] All commission invoices logged and audited

### Audit Trail

- [ ] All actions logged with timestamps
- [ ] GPS coordinates recorded where applicable
- [ ] Chain of custody maintained
- [ ] Logs are immutable (append-only)

### Compliance

- [ ] Constitutional constraints enforced
- [ ] No suppression of findings possible
- [ ] Triple AI verification working
- [ ] Court-admissible evidence format

---

## Operational Checklist (Ongoing)

### Daily Operations

- [ ] Monitor service health
  ```bash
  sudo systemctl status verum-firewall
  ```

- [ ] Check for errors
  ```bash
  sudo journalctl -u verum-firewall -p err -n 20
  ```

- [ ] Verify disk usage
  ```bash
  df -h /opt/verum-firewall/vault
  ```

### Weekly

- [ ] Review fraud alerts
- [ ] Verify commission invoices generated
- [ ] Check audit log for completeness
- [ ] Confirm all evidence properly sealed

### Monthly

- [ ] Performance review (CPU, memory, disk I/O)
- [ ] Security audit (file permissions, access logs)
- [ ] Constitution compliance check
- [ ] Backup audit logs (if backup strategy in place)

### Quarterly

- [ ] Generate compliance report
  ```bash
  curl -H "X-Admin-Key: KEY" \
    "http://localhost:8787/api/v1/admin/compliance-report/pdf?start_date=2026-01-01&end_date=2026-03-31" \
    -o compliance-report-q1.pdf
  ```

- [ ] Export audit trail
  ```bash
  curl -H "X-Admin-Key: KEY" \
    "http://localhost:8787/api/v1/admin/audit-log/json?start_date=2026-01-01&end_date=2026-03-31" \
    -o audit-log-q1.json
  ```

- [ ] Verify Bitcoin anchor confirmations
- [ ] Report to compliance team

---

## Troubleshooting

### Service Won't Start

```bash
# Check for errors
sudo journalctl -u verum-firewall -n 50

# Common issues:
# - Port already in use: Change FIREWALL_PORT in .env
# - Models not found: Ensure all .onnx files in models/
# - Permissions error: Run: sudo chown -R firewall-user:firewall-group /opt/verum-firewall
```

- [ ] Errors understood and resolved
- [ ] Service started successfully

### Models Not Loading

```bash
# Verify models installed
npm run verify-models

# Check model files
ls -la /opt/verum-firewall/models/*/

# Should show .onnx files in each directory
```

- [ ] All models present and accounted for
- [ ] Model files are readable by service user

### Disk Space Issues

```bash
# Check usage
du -sh /opt/verum-firewall/vault/*

# Archive old audit logs if needed
cd /opt/verum-firewall/vault/audit-logs/
gzip audit.jsonl  # Compresses by ~90%
```

- [ ] Disk space freed or extended
- [ ] Service remains operational

### Constitution Verification Fails

```bash
# Re-extract Constitution from package
tar xzf fraud-firewall-6.0.0.tar.gz \
  -C /opt/verum-firewall --wildcards '*/constitution-v6.0.0*'

# Restart service
sudo systemctl restart verum-firewall
```

- [ ] Constitution re-validated
- [ ] Service restarted successfully

---

## Support & Escalation

### When to Contact Support

Contact support@verumglobal.foundation if:

- Service fails to start after following this guide
- Models won't load despite being installed
- Constitution verification fails
- Unexpected errors in audit logs
- Performance degradation
- Unusual fraud alert patterns

### Before Contacting Support

1. Collect diagnostics
   ```bash
   npm run collect-diagnostics > diagnostics.tar.gz
   ```

2. Gather recent logs
   ```bash
   sudo journalctl -u verum-firewall -n 500 > logs.txt
   ```

3. Document issue
   - When it occurred
   - What you were doing
   - Error messages
   - Steps to reproduce

4. Email to: support@verumglobal.foundation
   - Subject: `[Firewall Support] Your Bank Name — Issue Description`
   - Attach: diagnostics.tar.gz and logs.txt

---

## Deployment Sign-Off

**Bank Name:** ___________________________________

**Institution ID:** ________________________________

**Deployment Date:** ______________________________

**Deployed By:** _________________________________

**Reviewed By (IT Security):** _____________________

**Verified By (Fraud Department):** ________________

**Compliance Officer Sign-Off:** ____________________

**Notes:**
```
_____________________________________________________________

_____________________________________________________________

_____________________________________________________________
```

---

**Document:** Fraud Firewall Deployment Checklist  
**Version:** 1.0  
**Date:** 23 July 2026  
**Constitution:** v6.0.0  
**Copyright © 2026 Verum Omnis. All rights reserved.**
