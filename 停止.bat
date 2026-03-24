@echo off
chcp 65001 > nul
cd /d %~dp0
docker compose down
echo デモ環境を停止しました。
pause
