@echo off
chcp 65001 > nul
echo ========================================
echo  PITBRAIN デモ フロントエンド起動
echo  画面: http://localhost:3001
echo ========================================
echo.

cd /d %~dp0\frontend

npm start -- --port 3001

pause
