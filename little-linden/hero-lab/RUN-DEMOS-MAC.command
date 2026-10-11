#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Little Linden hero lab… (keep this Terminal window open while viewing)"
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
elif command -v npx >/dev/null 2>&1; then
  ( sleep 4; open "http://localhost:5173/" ) &
  npx --yes http-server . -p 5173 -c-1
else
  echo "Python 3 or Node.js not found. Install from: https://www.python.org/downloads/  /  https://nodejs.org/"
  read -n 1
fi
