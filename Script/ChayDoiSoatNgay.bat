@echo off
title Doi Soat Xuat Hang Ngay - Antigravity
echo Dang chay doi soat, cap nhat du lieu va gui bao cao...
call "%~dp0RunReconcile.bat.bat"
if %ERRORLEVEL% equ 0 (
    powershell -Command "Write-Host '=== HOAN THANH ! ===' -ForegroundColor Green"
) else (
    powershell -Command "Write-Host '=== THAT BAI / ERROR ! ===' -ForegroundColor Red"
)
pause
