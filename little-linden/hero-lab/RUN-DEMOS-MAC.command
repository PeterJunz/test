#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Little Linden hero lab at http://localhost:5173 (close this Terminal window to stop)"
( sleep 1; open "http://localhost:5173/" ) &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 5173
elif command -v npx >/dev/null 2>&1; then
  npx --yes http-server . -p 5173 -c-1
else
  echo "Python 3 or Node.js not found. Install from https://www.python.org/downloads/ or https://nodejs.org/"
  read -n 1
fi
