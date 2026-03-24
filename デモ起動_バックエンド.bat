@echo off
chcp 65001 > nul
echo ========================================
echo  PITBRAIN デモ バックエンド起動
echo  API: http://localhost:8001
echo ========================================
echo.

cd /d %~dp0

call C:\Users\ys-ot\prog\avarth\.venv\Scripts\activate.bat

cd backend
uvicorn app.main:app --port 8001

pause
