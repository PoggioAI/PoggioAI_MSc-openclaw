#!/usr/bin/env bash
# check-prereqs.sh — Verify system prerequisites for the consortium pipeline.

set -euo pipefail

echo "=== PoggioAI/MSc Prerequisite Check ==="
echo ""

ERRORS=0
WARNINGS=0

# Required: git
if command -v git &> /dev/null; then
  echo "[OK] git: $(git --version)"
else
  echo "[FAIL] git not found. Install git."
  ERRORS=$((ERRORS + 1))
fi

# Required: Python 3.11+
if command -v python3 &> /dev/null; then
  PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  echo "[OK] python3: $PY_VERSION"
else
  echo "[FAIL] python3 not found."
  ERRORS=$((ERRORS + 1))
fi

# Recommended: conda
if command -v conda &> /dev/null; then
  echo "[OK] conda: $(conda --version)"
else
  echo "[WARN] conda not found. Will use venv (limited GPU support)."
  WARNINGS=$((WARNINGS + 1))
fi

# Recommended: Node.js 20+
if command -v node &> /dev/null; then
  echo "[OK] node: $(node --version)"
else
  echo "[FAIL] node not found. Required for the OpenClaw plugin."
  ERRORS=$((ERRORS + 1))
fi

# Optional: pdflatex
if command -v pdflatex &> /dev/null; then
  echo "[OK] pdflatex: available"
else
  echo "[WARN] pdflatex not found. LaTeX output will degrade to markdown."
  echo "       Install: brew install --cask mactex-no-gui"
  WARNINGS=$((WARNINGS + 1))
fi

# Optional: bibtex
if command -v bibtex &> /dev/null; then
  echo "[OK] bibtex: available"
else
  echo "[WARN] bibtex not found. Bibliography compilation may fail."
  WARNINGS=$((WARNINGS + 1))
fi

# Check API keys
echo ""
echo "=== API Keys ==="
KEYS_FOUND=0
for key in ANTHROPIC_API_KEY OPENAI_API_KEY GOOGLE_API_KEY; do
  if [ -n "${!key:-}" ]; then
    echo "[OK] $key: configured"
    KEYS_FOUND=$((KEYS_FOUND + 1))
  else
    echo "[--] $key: not set"
  fi
done

if [ $KEYS_FOUND -eq 0 ]; then
  echo "[FAIL] No LLM API keys found. Set at least one in your OpenClaw config."
  ERRORS=$((ERRORS + 1))
fi

if [ $KEYS_FOUND -ge 3 ]; then
  echo "[OK] Counsel mode available (3 providers configured)"
else
  echo "[INFO] Counsel mode requires all 3 provider keys (Anthropic, OpenAI, Google)"
fi

echo ""
echo "=== Summary ==="
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
  echo "Fix the errors above before using the plugin."
  exit 1
else
  echo "All prerequisites met. Ready to use /research."
  exit 0
fi
