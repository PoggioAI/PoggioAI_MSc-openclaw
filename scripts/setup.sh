#!/usr/bin/env bash
# setup.sh — One-command installer for pAI/MSc-openclaw plugin.
#
# Usage:
#   git clone https://github.com/PoggioAI/PoggioAI_MSc-openclaw.git
#   cd PoggioAI_MSc-openclaw
#   bash scripts/setup.sh
#
# What it does:
#   1. Checks prerequisites (Node.js >= 20, Python >= 3.11, git)
#   2. Installs Python 3.11 if missing (auto-detects OS)
#   3. Builds the TypeScript plugin (npm install && npm run build)
#   4. Symlinks into ~/.openclaw/plugins/
#   5. Registers the plugin in ~/.openclaw/openclaw.json
#   6. Sets agent timeout to 2700s (45 min) for multi-pass phases
#   7. Restarts OpenClaw gateway

set -euo pipefail

PLUGIN_NAME="pai-msc-openclaw"
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="$HOME/.openclaw"
OPENCLAW_CONFIG="$OPENCLAW_DIR/openclaw.json"
PLUGINS_DIR="$OPENCLAW_DIR/plugins"
MIN_NODE_MAJOR=20
MIN_PYTHON_MINOR=11

# ── Helpers ───────────────────────────────────────────────────────

log()  { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*"; exit 1; }
step() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }

# ── Step 1: Check prerequisites ──────────────────────────────────

step "Checking prerequisites"

# Git
command -v git &>/dev/null || fail "git not found. Install git first."
log "git: $(git --version)"

# Node.js
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
    fail "Node.js >= $MIN_NODE_MAJOR required (found v$NODE_MAJOR). Update: https://nodejs.org"
  fi
  log "node: $(node --version)"
else
  fail "Node.js not found. Install Node.js >= $MIN_NODE_MAJOR: https://nodejs.org"
fi

# npm
command -v npm &>/dev/null || fail "npm not found. Install Node.js >= $MIN_NODE_MAJOR."
log "npm: $(npm --version)"

# ── Step 2: Check/install Python 3.11+ ───────────────────────────

step "Checking Python 3.11+"

find_python() {
  # Try python3.11, python3.12, ..., then python3
  for cmd in python3.11 python3.12 python3.13 python3; do
    if command -v "$cmd" &>/dev/null; then
      local minor
      minor=$($cmd -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo "0")
      if [ "$minor" -ge "$MIN_PYTHON_MINOR" ]; then
        echo "$cmd"
        return 0
      fi
    fi
  done
  return 1
}

PYTHON_CMD=""
if PYTHON_CMD=$(find_python); then
  log "Python: $($PYTHON_CMD --version)"
else
  warn "Python >= 3.11 not found. Attempting to install..."

  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      amzn)
        echo "  Detected Amazon Linux. Installing python3.11..."
        sudo dnf install -y python3.11 python3.11-pip 2>/dev/null \
          || sudo yum install -y python3.11 2>/dev/null \
          || fail "Could not install Python 3.11. Install manually: sudo dnf install python3.11"
        # Make python3.11 the default python3
        sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
        ;;
      ubuntu|debian)
        echo "  Detected Ubuntu/Debian. Installing python3.11..."
        sudo apt-get update -qq
        sudo apt-get install -y python3.11 python3.11-venv python3.11-pip 2>/dev/null \
          || sudo apt-get install -y python3.11 python3.11-venv 2>/dev/null \
          || fail "Could not install Python 3.11. Try: sudo add-apt-repository ppa:deadsnakes/ppa && sudo apt install python3.11"
        ;;
      fedora|rhel|centos|rocky|alma)
        echo "  Detected RHEL/Fedora. Installing python3.11..."
        sudo dnf install -y python3.11 python3.11-pip 2>/dev/null \
          || fail "Could not install Python 3.11. Install manually."
        ;;
      *)
        fail "Unknown Linux distro '$ID'. Install Python >= 3.11 manually, then re-run this script."
        ;;
    esac
  elif [ "$(uname)" = "Darwin" ]; then
    if command -v brew &>/dev/null; then
      echo "  Detected macOS + Homebrew. Installing python@3.11..."
      brew install python@3.11
    else
      fail "Install Python >= 3.11 via https://python.org or Homebrew, then re-run."
    fi
  else
    fail "Could not detect OS. Install Python >= 3.11 manually, then re-run."
  fi

  # Re-check
  PYTHON_CMD=$(find_python) || fail "Python 3.11+ still not found after install attempt. Install manually."
  log "Python: $($PYTHON_CMD --version)"
fi

# ── Step 3: Build the plugin ─────────────────────────────────────

step "Building plugin"

cd "$PLUGIN_DIR"
npm install --no-audit --no-fund 2>&1 | tail -1
npm run build 2>&1
log "Plugin built successfully"

# ── Step 4: Symlink into plugins directory ───────────────────────

step "Registering plugin"

mkdir -p "$PLUGINS_DIR"
ln -sf "$PLUGIN_DIR" "$PLUGINS_DIR/$PLUGIN_NAME"
log "Symlinked $PLUGIN_DIR -> $PLUGINS_DIR/$PLUGIN_NAME"

# ── Step 5: Patch openclaw.json ──────────────────────────────────

step "Configuring OpenClaw"

if [ ! -f "$OPENCLAW_CONFIG" ]; then
  warn "No openclaw.json found at $OPENCLAW_CONFIG"
  warn "OpenClaw may not be installed yet. The plugin is built and ready —"
  warn "once OpenClaw is installed, re-run: bash scripts/setup.sh"
else
  # Backup
  cp "$OPENCLAW_CONFIG" "${OPENCLAW_CONFIG}.bak.$(date +%s)"
  log "Backed up openclaw.json"

  # Patch using Python (no jq dependency needed)
  $PYTHON_CMD - "$OPENCLAW_CONFIG" "$PLUGIN_DIR" <<'PYEOF'
import json, sys

config_path = sys.argv[1]
plugin_path = sys.argv[2]

with open(config_path) as f:
    cfg = json.load(f)

changed = False

# 1. Register plugin in plugins.entries
plugins = cfg.setdefault("plugins", {})
entries = plugins.setdefault("entries", {})
if "pai-msc-openclaw" not in entries or not entries["pai-msc-openclaw"].get("enabled"):
    entries["pai-msc-openclaw"] = {
        "enabled": True
    }
    changed = True
    print("[OK] Plugin registered in plugins.entries")
else:
    print("[OK] Plugin already registered")

# 2. Set agent timeout to 2700s
agents = cfg.setdefault("agents", {})
defaults = agents.setdefault("defaults", {})
if defaults.get("timeoutSeconds", 0) < 2700:
    defaults["timeoutSeconds"] = 2700
    changed = True
    print("[OK] Set agents.defaults.timeoutSeconds = 2700")
else:
    print("[OK] Agent timeout already >= 2700s")

# 3. Set subagent timeout to 2700s
subagents = defaults.setdefault("subagents", {})
if subagents.get("runTimeoutSeconds", 0) < 2700:
    subagents["runTimeoutSeconds"] = 2700
    changed = True
    print("[OK] Set subagents.runTimeoutSeconds = 2700")
else:
    print("[OK] Subagent timeout already >= 2700s")

if changed:
    with open(config_path, "w") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    print("[OK] openclaw.json updated")
else:
    print("[OK] No changes needed")
PYEOF
fi

# ── Step 6: Restart OpenClaw ─────────────────────────────────────

step "Restarting OpenClaw"

RESTARTED=false

# Try user-level systemd (most common: openclaw installed via curl | bash)
if systemctl --user is-active --quiet openclaw-gateway 2>/dev/null; then
  systemctl --user restart openclaw-gateway
  RESTARTED=true
  log "Restarted via 'systemctl --user restart openclaw-gateway'"
fi

# Try system-level systemd
if ! $RESTARTED && systemctl is-active --quiet openclaw 2>/dev/null; then
  sudo systemctl restart openclaw
  RESTARTED=true
  log "Restarted via systemctl"
fi

# Try pm2
if ! $RESTARTED && command -v pm2 &>/dev/null; then
  if pm2 list 2>/dev/null | grep -qi openclaw; then
    pm2 restart openclaw 2>/dev/null
    RESTARTED=true
    log "Restarted via pm2"
  fi
fi

if ! $RESTARTED; then
  warn "Could not auto-restart OpenClaw."
  echo "       Try: systemctl --user restart openclaw-gateway"
  echo "       The plugin will be available after restart."
fi

# ── Step 7: Optional deps ────────────────────────────────────────

step "Checking optional dependencies"

if command -v pdflatex &>/dev/null; then
  log "pdflatex: available (PDF output enabled)"
else
  warn "pdflatex not found — paper output will be markdown instead of PDF."
  if [ "$(uname)" = "Darwin" ]; then
    echo "       Install: brew install --cask mactex-no-gui"
  elif [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      amzn|fedora|rhel|centos|rocky|alma)
        echo "       Install: sudo dnf install texlive-scheme-basic -y" ;;
      ubuntu|debian)
        echo "       Install: sudo apt install texlive-latex-base -y" ;;
    esac
  fi
fi

if command -v conda &>/dev/null; then
  log "conda: available"
else
  warn "conda not found — using python3 venv (limited GPU support)."
fi

# ── Done ─────────────────────────────────────────────────────────

step "Setup Complete"
echo ""
echo "  Plugin: $PLUGIN_DIR"
echo "  Symlink: $PLUGINS_DIR/$PLUGIN_NAME"
echo "  Config: $OPENCLAW_CONFIG"
echo ""
echo "  Usage:"
echo "    /pai-msc \"Investigate whether batch normalization implicitly regularizes spectral norm\""
echo ""
echo "  First run will auto-install the Python research backend (~5 minutes)."
echo "  After that, every /pai-msc command goes straight to running."
echo ""
log "Ready to use!"
