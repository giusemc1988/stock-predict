#!/bin/bash
# Makes the Jarvis home agent start by itself on a Mac (MacBook or Mac mini), also after a restart.
#   bash agent/mac-autostart.sh          turn on
#   bash agent/mac-autostart.sh off      turn off
# Logs: ~/.jarvis-agent/agent.log
set -euo pipefail
LABEL=com.jarvis.agent
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NPM="$(command -v npm || true)"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "off" ]; then rm -f "$PLIST"; echo "Jarvis agent auto-start is off."; exit 0; fi
[ -n "$NPM" ] || { echo "npm not found. Install Node first: brew install node"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.jarvis-agent"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NPM</string><string>run</string><string>agent</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NPM"):/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.jarvis-agent/agent.log</string>
  <key>StandardErrorPath</key><string>$HOME/.jarvis-agent/agent.log</string>
</dict></plist>
PL
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Jarvis agent will now start by itself. Token: $(sleep 8; cat "$HOME/.jarvis-agent/token" 2>/dev/null || echo 'see ~/.jarvis-agent/agent.log')"
