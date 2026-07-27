#!/bin/bash

##############################################################################
# Verum Omnis Fraud Firewall — Deployment Package Builder
#
# This script creates the complete downloadable package for bank deployment:
# - Bundles compiled application (TypeScript → JavaScript)
# - Includes configuration templates
# - Bundles AI models in ONNX format
# - Generates checksums
# - Creates GPG signatures (optional)
#
# Usage:
#   ./deployment/build-package.sh [version] [sign-key]
#
# Examples:
#   ./deployment/build-package.sh 6.0.0
#   ./deployment/build-package.sh 6.0.0 0x<GPG_KEY_ID>
##############################################################################

set -e

# Configuration
VERSION="${1:-6.0.0}"
SIGN_KEY="${2:-}"
BUILD_DIR="/tmp/fraud-firewall-${VERSION}"
DIST_DIR="dist"
PACKAGE_NAME="fraud-firewall-${VERSION}"

echo "=========================================="
echo "Verum Omnis Fraud Firewall Package Builder"
echo "=========================================="
echo "Version: ${VERSION}"
echo "Build Directory: ${BUILD_DIR}"
echo ""

# Step 1: Clean previous builds
echo "[1/8] Cleaning previous builds..."
rm -rf "${BUILD_DIR}"
rm -f "fraud-firewall-*.tar.gz" "fraud-firewall-*.zip"
mkdir -p "${BUILD_DIR}"

# Step 2: Compile TypeScript
echo "[2/8] Compiling TypeScript..."
npm run build

# Step 3: Copy application files
echo "[3/8] Copying application files..."
mkdir -p "${BUILD_DIR}/app"
cp -r "${DIST_DIR}"/* "${BUILD_DIR}/app/"
cp package.json package-lock.json "${BUILD_DIR}/app/"
cp -r web/ "${BUILD_DIR}/web"

# Step 4: Copy configuration templates
echo "[4/8] Copying configuration templates..."
mkdir -p "${BUILD_DIR}/config"
cp deployment/bank-config-template.env "${BUILD_DIR}/.env.template"
cp deployment/BANK_INSTALLATION_GUIDE.md "${BUILD_DIR}/"
cp deployment/DISTRIBUTION_GUIDE.md "${BUILD_DIR}/"

# Step 5: Prepare models directory structure
echo "[5/8] Preparing AI models directory structure..."
mkdir -p "${BUILD_DIR}/models/gemma3"
mkdir -p "${BUILD_DIR}/models/gemma4"
mkdir -p "${BUILD_DIR}/models/mistral-instruct"

# Note: Actual model files (*.onnx) should be added manually
# They are typically stored in: models/{gemma3,gemma4,mistral-instruct}/*.onnx
if [ -d "models" ]; then
  echo "  Copying pre-downloaded models..."
  cp -r models/* "${BUILD_DIR}/models/" 2>/dev/null || true
else
  echo "  WARNING: models/ directory not found"
  echo "  You must manually add model files to:"
  echo "    - ${BUILD_DIR}/models/gemma3/*.onnx"
  echo "    - ${BUILD_DIR}/models/gemma4/*.onnx"
  echo "    - ${BUILD_DIR}/models/mistral-instruct/*.onnx"
fi

# Step 6: Prepare vault directory
echo "[6/8] Preparing vault directory structure..."
mkdir -p "${BUILD_DIR}/vault/evidence"
mkdir -p "${BUILD_DIR}/vault/audit-logs"
mkdir -p "${BUILD_DIR}/vault/seized-transactions"
mkdir -p "${BUILD_DIR}/vault/outbound-email"

# Step 7: Create archives
echo "[7/8] Creating distribution archives..."

# TAR.GZ for Linux
echo "  Creating ${PACKAGE_NAME}.tar.gz..."
tar czf "${PACKAGE_NAME}.tar.gz" -C /tmp "fraud-firewall-${VERSION}"
echo "  ✓ Created: ${PACKAGE_NAME}.tar.gz ($(du -sh ${PACKAGE_NAME}.tar.gz | cut -f1))"

# ZIP for Windows
echo "  Creating ${PACKAGE_NAME}.zip..."
cd /tmp
zip -r -q "${OLDPWD}/${PACKAGE_NAME}.zip" "fraud-firewall-${VERSION}"
cd - > /dev/null
echo "  ✓ Created: ${PACKAGE_NAME}.zip ($(du -sh ${PACKAGE_NAME}.zip | cut -f1))"

# Step 8: Generate checksums and signatures
echo "[8/8] Generating checksums and signatures..."

# SHA-512 checksums
echo "  Generating SHA-512 checksums..."
sha512sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.SHA512"
sha512sum "${PACKAGE_NAME}.zip" >> "${PACKAGE_NAME}.SHA512"
echo "  ✓ SHA-512 checksums saved to ${PACKAGE_NAME}.SHA512"

# Optional GPG signature
if [ -n "${SIGN_KEY}" ]; then
  echo "  Signing with GPG key: ${SIGN_KEY}..."
  gpg --default-key "${SIGN_KEY}" --detach-sign --armor "${PACKAGE_NAME}.tar.gz"
  gpg --default-key "${SIGN_KEY}" --detach-sign --armor "${PACKAGE_NAME}.zip"
  echo "  ✓ GPG signatures created"
fi

# Cleanup
rm -rf "${BUILD_DIR}"

# Summary
echo ""
echo "=========================================="
echo "✓ Package Build Complete"
echo "=========================================="
echo ""
echo "Files ready for distribution:"
echo "  - ${PACKAGE_NAME}.tar.gz (Linux/macOS)"
echo "  - ${PACKAGE_NAME}.zip (Windows)"
echo "  - ${PACKAGE_NAME}.SHA512 (checksums)"
if [ -n "${SIGN_KEY}" ]; then
  echo "  - ${PACKAGE_NAME}.tar.gz.asc (GPG signature)"
  echo "  - ${PACKAGE_NAME}.zip.asc (GPG signature)"
fi
echo ""
echo "Next steps:"
echo "  1. Upload to www.verumglobal.foundation/downloads/"
echo "  2. Update checksums on website"
echo "  3. Publish release notes"
echo "  4. Notify banks via email"
echo ""
echo "Size Information:"
echo "  TAR.GZ:  $(du -sh ${PACKAGE_NAME}.tar.gz | cut -f1)"
echo "  ZIP:     $(du -sh ${PACKAGE_NAME}.zip | cut -f1)"
echo ""
echo "Installation guide: See BANK_INSTALLATION_GUIDE.md"
echo ""
