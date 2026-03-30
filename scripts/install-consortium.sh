#!/usr/bin/env bash
# install-consortium.sh — Manual installer for the PoggioAI/MSc consortium backend.
# Normally called automatically by the plugin on first use.
# Run this directly if you want to pre-install.

set -euo pipefail

REPO_URL="https://github.com/PoggioAI/PoggioAI_MSc.git"
INSTALL_DIR="${1:-$HOME/.openclaw/poggioai-msc/repo}"
ENV_NAME="${2:-poggioai-msc}"

echo "=== PoggioAI/MSc Consortium Installer ==="
echo "Install dir: $INSTALL_DIR"
echo "Conda env:   $ENV_NAME"
echo ""

# Step 1: Clone
if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "[1/5] Cloning repository..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
else
  echo "[1/5] Repository already exists. Pulling updates..."
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null || echo "  (offline or diverged, using existing)"
fi

# Step 2: Create conda env
if command -v conda &> /dev/null; then
  if ! conda env list | grep -q "^$ENV_NAME "; then
    echo "[2/5] Creating conda environment '$ENV_NAME'..."
    conda create -n "$ENV_NAME" python=3.11 -y
  else
    echo "[2/5] Conda environment '$ENV_NAME' already exists."
  fi
  PIP_CMD="conda run -n $ENV_NAME pip"
  PYTHON_CMD="conda run -n $ENV_NAME python"
else
  echo "[2/5] Conda not found. Creating venv..."
  if [ ! -d "$INSTALL_DIR/.venv" ]; then
    python3 -m venv "$INSTALL_DIR/.venv"
  fi
  PIP_CMD="$INSTALL_DIR/.venv/bin/pip"
  PYTHON_CMD="$INSTALL_DIR/.venv/bin/python"
  echo "  Warning: venv mode may have limited torch/CUDA support."
fi

# Step 3: Install dependencies
echo "[3/5] Installing Python dependencies..."
cd "$INSTALL_DIR"
$PIP_CMD install -e ".[core,web]"

# Step 4: Preflight check
echo "[4/5] Running preflight checks..."
$PYTHON_CMD scripts/preflight_check.py 2>/dev/null || echo "  (some checks had warnings, non-fatal)"

# Step 5: Write sentinel
echo "[5/5] Writing installation marker..."
cat > "$INSTALL_DIR/.installed" << EOF
{
  "version": "0.1.0",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "condaEnv": "$(command -v conda &> /dev/null && echo "$ENV_NAME" || echo "null")",
  "venvPath": "$(command -v conda &> /dev/null && echo "null" || echo "$INSTALL_DIR/.venv")"
}
EOF

echo ""
echo "=== Installation Complete ==="
echo "The research pipeline is ready. Use /research in OpenClaw to start."
