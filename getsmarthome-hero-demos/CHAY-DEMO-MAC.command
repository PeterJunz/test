#!/bin/bash
cd "$(dirname "$0")"
echo "Đang khởi động demo… (giữ cửa sổ Terminal mở trong lúc xem)"
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
elif command -v npx >/dev/null 2>&1; then
  ( sleep 4; open "http://localhost:5173/" ) &
  npx --yes http-server . -p 5173 -c-1
else
  echo "Không tìm thấy Python 3 hoặc Node.js. Cài tại: https://www.python.org/downloads/  /  https://nodejs.org/"
  read -n 1
fi
