#!/bin/bash

##############################################################################
# Collect Fraud Firewall Diagnostics for Support
#
# Creates a diagnostic bundle with:
# - Configuration (sanitized)
# - Recent logs
# - System information
# - Model information
#
# Usage:
#   npm run collect-diagnostics > diagnostics.tar.gz
##############################################################################

set -e

INSTALL_DIR="${FIREWALL_VAULT_DIR:-.}/../../"
TEMP_DIR=$(mktemp -d)
BUNDLE_NAME="verum-firewall-diagnostics-$(date +%Y%m%d-%H%M%S)"

trap "rm -rf ${TEMP_DIR}" EXIT

# Create diagnostic directory structure
mkdir -p "${TEMP_DIR}/${BUNDLE_NAME}/"{system,config,logs,models,audit}

# System Information
echo "Collecting system information..."
{
  echo "=== SYSTEM INFO ==="
  uname -a
  echo ""
  echo "=== NODE.JS VERSION ==="
  node --version
  npm --version
  echo ""
  echo "=== DISK USAGE ==="
  df -h "${INSTALL_DIR}" 2>/dev/null || echo "N/A"
  echo ""
  echo "=== MEMORY ==="
  free -h 2>/dev/null || echo "N/A"
} > "${TEMP_DIR}/${BUNDLE_NAME}/system/info.txt"

# Configuration (sanitized)
echo "Collecting configuration..."
if [ -f "${INSTALL_DIR}/.env" ]; then
  # Remove sensitive values
  sed 's/=.*/=***REDACTED***/g' "${INSTALL_DIR}/.env" > \
    "${TEMP_DIR}/${BUNDLE_NAME}/config/.env.sanitized"
fi

# Recent logs
echo "Collecting recent logs..."
if [ -f "${INSTALL_DIR}/vault/audit-logs/audit.jsonl" ]; then
  tail -100 "${INSTALL_DIR}/vault/audit-logs/audit.jsonl" > \
    "${TEMP_DIR}/${BUNDLE_NAME}/logs/audit-recent.log"
fi

# Model information
echo "Collecting model information..."
{
  echo "=== MODELS INSTALLED ==="
  ls -la "${INSTALL_DIR}/models/" 2>/dev/null || echo "No models directory found"
  echo ""
  for model in gemma3 gemma4 mistral-instruct; do
    if [ -d "${INSTALL_DIR}/models/${model}" ]; then
      echo "${model}:"
      ls -lh "${INSTALL_DIR}/models/${model}/" | head -5
    fi
  done
} > "${TEMP_DIR}/${BUNDLE_NAME}/models/manifest.txt"

# Package contents
echo "Collecting package information..."
{
  echo "=== APPLICATION FILES ==="
  ls -la "${INSTALL_DIR}/app/" 2>/dev/null | head -20 || echo "N/A"
  echo ""
  echo "=== PACKAGE.JSON ==="
  cat "${INSTALL_DIR}/app/package.json" 2>/dev/null || echo "N/A"
} > "${TEMP_DIR}/${BUNDLE_NAME}/config/package-info.txt"

# Vault structure
echo "Collecting vault structure..."
{
  echo "=== VAULT STRUCTURE ==="
  du -sh "${INSTALL_DIR}/vault/"* 2>/dev/null || echo "N/A"
} > "${TEMP_DIR}/${BUNDLE_NAME}/audit/vault-summary.txt"

# Create archive
echo "Creating diagnostic bundle..."
cd "${TEMP_DIR}"
tar czf "${BUNDLE_NAME}.tar.gz" "${BUNDLE_NAME}"
cat "${BUNDLE_NAME}.tar.gz"

echo "" >&2
echo "Diagnostic bundle created successfully." >&2
echo "Size: $(du -h ${BUNDLE_NAME}.tar.gz | cut -f1)" >&2
echo "" >&2
echo "To send to support:" >&2
echo "  npm run collect-diagnostics > diagnostics.tar.gz" >&2
echo "  Send diagnostics.tar.gz to: support@verumglobal.foundation" >&2
