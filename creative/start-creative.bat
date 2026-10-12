@echo off
rem Creative Intelligence Agent. Keys are optional: see .env.example. Dashboard at http://localhost:3200
cd /d %~dp0
rem set GEMINI_API_KEY=
rem set ANTHROPIC_API_KEY=
node server.js
pause
