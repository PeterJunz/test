#!/bin/bash
cd "$(dirname "$0")"
echo "Đang khởi động demo tại http://localhost:5173 … (đóng cửa sổ Terminal để tắt)"
( sleep 1; open "http://localhost:5173/" ) &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 5173
elif command -v npx >/dev/null 2>&1; then
  npx --yes http-server . -p 5173 -c-1
else
  echo "Không tìm thấy Python 3 hoặc Node.js. Cài tại https://www.python.org/downloads/ hoặc https://nodejs.org/"
  read -n 1
fi
