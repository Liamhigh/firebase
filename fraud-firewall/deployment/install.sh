#!/bin/bash

##############################################################################
# Verum Omnis Fraud Firewall — Bank Server Installation Script
#
# Automated installation for Linux servers (Ubuntu 22.04+, CentOS 8+)
#
# Usage:
#   sudo bash install.sh [installation-directory] [port]
#
# Examples:
#   sudo bash install.sh /opt/verum-firewall 8787
#   sudo bash install.sh
#     (Uses defaults: /opt/verum-firewall, port 8787)
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${1:-/opt/verum-firewall}"
PORT="${2:-8787}"
SERVICE_USER="firewall-user"
SERVICE_GROUP="firewall-group"

# Utility functions
print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  print_error "This script must be run as root (use: sudo)"
fi

print_header "VERUM OMNIS FRAUD FIREWALL — INSTALLATION"

echo ""
echo "Configuration:"
echo "  Installation Directory: ${INSTALL_DIR}"
echo "  Port: ${PORT}"
echo "  Service User: ${SERVICE_USER}"
echo ""

# Step 1: Check prerequisites
echo -e "${BLUE}[1/10] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js not found. Install Node.js 20.x or later"
fi
NODE_VERSION=$(node -v)
print_success "Node.js found: ${NODE_VERSION}"

# Check npm
if ! command -v npm &> /dev/null; then
  print_error "npm not found"
fi
NPM_VERSION=$(npm -v)
print_success "npm found: ${NPM_VERSION}"

# Step 2: Create service user
echo ""
echo -e "${BLUE}[2/10] Creating service user...${NC}"
if ! id "${SERVICE_USER}" &>/dev/null; then
  useradd -m -s /bin/false "${SERVICE_USER}"
  print_success "Created user: ${SERVICE_USER}"
else
  print_warning "User ${SERVICE_USER} already exists"
fi

# Step 3: Create directories
echo ""
echo -e "${BLUE}[3/10] Creating directories...${NC}"
mkdir -p "${INSTALL_DIR}"/{app,vault/evidence,vault/audit-logs,vault/seized-transactions,vault/outbound-email,models/{gemma3,gemma4,mistral-instruct}}
print_success "Directories created"

# Step 4: Extract application
echo ""
echo -e "${BLUE}[4/10] Extracting application...${NC}"
# The script assumes it's being run from within the extracted package
if [ -d "app" ]; then
  cp -r app/* "${INSTALL_DIR}/app/"
  print_success "Application extracted"
else
  print_warning "app/ directory not found in package"
fi

# Step 5: Install dependencies
echo ""
echo -e "${BLUE}[5/10] Installing Node.js dependencies...${NC}"
cd "${INSTALL_DIR}/app"
npm ci --production
print_success "Dependencies installed"
cd - > /dev/null

# Step 6: Verify models
echo ""
echo -e "${BLUE}[6/10] Verifying AI models...${NC}"
MODEL_COUNT=0
for model in gemma3 gemma4 mistral-instruct; do
  if [ -f "${INSTALL_DIR}/models/${model}/"*.onnx 2>/dev/null ]; then
    SIZE=$(du -sh "${INSTALL_DIR}/models/${model}" | cut -f1)
    print_success "Model found: ${model} (${SIZE})"
    ((MODEL_COUNT++))
  else
    print_warning "Model not found: ${model}"
  fi
done

if [ ${MODEL_COUNT} -lt 3 ]; then
  print_warning "Only ${MODEL_COUNT}/3 models found"
  echo "  Install missing models to: ${INSTALL_DIR}/models/{model_name}/*.onnx"
fi

# Step 7: Set permissions
echo ""
echo -e "${BLUE}[7/10] Setting permissions...${NC}"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${INSTALL_DIR}"
chmod 755 "${INSTALL_DIR}"
chmod 755 "${INSTALL_DIR}/app"
chmod 700 "${INSTALL_DIR}/vault"
chmod 600 "${INSTALL_DIR}/.env" 2>/dev/null || true
print_success "Permissions set"

# Step 8: Create configuration
echo ""
echo -e "${BLUE}[8/10] Creating configuration...${NC}"
if [ ! -f "${INSTALL_DIR}/.env" ]; then
  # Create .env from template if available
  if [ -f "${INSTALL_DIR}/.env.template" ]; then
    cp "${INSTALL_DIR}/.env.template" "${INSTALL_DIR}/.env"
  else
    # Create minimal .env
    cat > "${INSTALL_DIR}/.env" <<EOF
INSTITUTION_NAME=My Bank
FIREWALL_PORT=${PORT}
FIREWALL_MODELS_DIR=${INSTALL_DIR}/models
FIREWALL_VAULT_DIR=${INSTALL_DIR}/vault
ADMIN_KEY=$(openssl rand -hex 32)
EOF
  fi

  # Generate unique admin key (CRITICAL: must not be demo key)
  GENERATED_KEY=$(openssl rand -hex 32)
  sed -i "s/^ADMIN_KEY=.*/ADMIN_KEY=${GENERATED_KEY}/" "${INSTALL_DIR}/.env"

  # Update port if needed
  sed -i "s/^FIREWALL_PORT=.*/FIREWALL_PORT=${PORT}/" "${INSTALL_DIR}/.env"

  chmod 600 "${INSTALL_DIR}/.env"
  print_success "Configuration created: ${INSTALL_DIR}/.env"
  print_success "Generated unique ADMIN_KEY: ${GENERATED_KEY:0:16}... (full key in .env)"
  echo "  IMPORTANT: Edit .env with your institution details before startup"
  echo "  IMPORTANT: Protect ADMIN_KEY - it authenticates all admin API requests"
else
  print_warning "Configuration already exists"
  # Verify ADMIN_KEY is set and not empty
  if grep -q "^ADMIN_KEY=$" "${INSTALL_DIR}/.env" 2>/dev/null; then
    print_error "ADMIN_KEY is empty in configuration. Edit .env and set a strong random key:"
    echo "  ADMIN_KEY=$(openssl rand -hex 32)"
  fi
fi

# Step 9: Create systemd service
echo ""
echo -e "${BLUE}[9/10] Creating systemd service...${NC}"
cat > /etc/systemd/system/verum-firewall.service <<EOF
[Unit]
Description=Verum Omnis Fraud Firewall
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/app
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
print_success "Systemd service created: verum-firewall"

# Step 10: Verification
echo ""
echo -e "${BLUE}[10/10] Verifying installation...${NC}"

# Check application files
if [ -f "${INSTALL_DIR}/app/dist/index.js" ]; then
  print_success "Application files verified"
else
  print_warning "Application binary not found at ${INSTALL_DIR}/app/dist/index.js"
fi

# Check vault directory
if [ -d "${INSTALL_DIR}/vault" ]; then
  print_success "Vault directory verified"
else
  print_error "Vault directory not found"
fi

# Check port availability
if netstat -tuln 2>/dev/null | grep -q ":${PORT} "; then
  print_warning "Port ${PORT} may already be in use"
else
  print_success "Port ${PORT} is available"
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Installation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. CONFIGURE YOUR INSTITUTION"
echo "   Edit: ${INSTALL_DIR}/.env"
echo "   Set:  INSTITUTION_NAME, FRAUD_DEPARTMENT_EMAIL, etc."
echo ""
echo "2. VERIFY MODELS"
echo "   Ensure all AI models are installed:"
echo "     - ${INSTALL_DIR}/models/gemma3/*.onnx"
echo "     - ${INSTALL_DIR}/models/gemma4/*.onnx"
echo "     - ${INSTALL_DIR}/models/mistral-instruct/*.onnx"
echo ""
echo "3. RUN HEALTH CHECK"
echo "   cd ${INSTALL_DIR}/app"
echo "   npm run health-check"
echo ""
echo "4. START SERVICE"
echo "   sudo systemctl start verum-firewall"
echo "   sudo systemctl enable verum-firewall"
echo ""
echo "5. VERIFY SERVICE"
echo "   sudo systemctl status verum-firewall"
echo "   sudo journalctl -u verum-firewall -f"
echo ""
echo "6. TEST API"
echo "   curl -H \"X-Admin-Key: \$(grep ADMIN_KEY ${INSTALL_DIR}/.env | cut -d= -f2)\" \\"
echo "        http://localhost:${PORT}/api/v1/admin/health"
echo ""
echo "Documentation:"
echo "  Installation Guide: ${INSTALL_DIR}/BANK_INSTALLATION_GUIDE.md"
echo "  Configuration Template: ${INSTALL_DIR}/.env.template"
echo ""
echo "Support:"
echo "  Email: support@verumglobal.foundation"
echo "  Website: https://www.verumglobal.foundation"
echo ""
