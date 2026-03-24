@echo off
chcp 65001 > nul
echo ========================================
echo  PITBRAIN デモ環境 起動
echo ========================================
echo.
echo Docker Desktop が起動していることを確認してください。
echo.

cd /d %~dp0

docker compose up --build

pause
