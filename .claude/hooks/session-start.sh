#!/bin/bash
# Installs REA (Reverse Engineer Anything, https://github.com/morluto/rea)
# and registers its MCP server and skill with Claude Code in cloud sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v rea >/dev/null 2>&1; then
  npm install --global rea-agents >/dev/null 2>&1
fi

rea setup --client claude_code --yes --json >/dev/null
