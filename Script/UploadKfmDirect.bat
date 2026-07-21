@echo off
setlocal
set "DATE_ARG=%1"
if "%DATE_ARG%"=="" (
    echo.
    set /p "DATE_ARG=Nhap ngay can update (dinh dang DDMMYYYY, vi du 19072026): "
)

if "%DATE_ARG%"=="" (
    echo.
    powershell -Command "Write-Host 'Ban da khong nhap ngay!' -ForegroundColor Red"
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
for %%I in ("%~dp0..") do set "BASE_DIR=%%~fI"

echo.
echo ==================================================
echo   Bat dau tai va update truc tiep ngay %DATE_ARG%...
echo ==================================================

REM 1. Dam bao thu muc temp_restore co san va copy download_kfm.js moi nhat
if not exist "C:\temp_restore\reconcile_script" mkdir "C:\temp_restore\reconcile_script"
copy /y "%SCRIPT_DIR%download_kfm.js" "C:\temp_restore\reconcile_script\download_kfm.js" >nul
copy /y "%SCRIPT_DIR%package.json" "C:\temp_restore\reconcile_script\package.json" >nul

REM 2. Chay download_kfm.js voi tham so ngay de tai file
pushd "C:\temp_restore\reconcile_script"
if not exist "node_modules" (
    echo Dang cai dat thu vien Playwright...
    call npm install --no-audit --no-fund >nul
)
call node download_kfm.js %DATE_ARG%
if %ERRORLEVEL% neq 0 (
    echo.
    powershell -Command "Write-Host 'Loi khi tu dong tai file KFM.xlsx cho ngay %DATE_ARG%!' -ForegroundColor Red"
    popd
    pause
    exit /b 1
)
popd

REM 3. Bien dich lai script C# de cap nhat thay doi
echo.
echo Dang bien dich lai script C#...
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
pushd "%SCRIPT_DIR%"
%CSC% /nologo /out:ReconcileData.exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ReconcileData.cs
if %ERRORLEVEL% neq 0 (
    echo.
    powershell -Command "Write-Host 'Co loi khi bien dich ReconcileData.cs!' -ForegroundColor Red"
    popd
    pause
    exit /b 1
)
popd

REM 4. Chay chuong trinh ReconcileData o che do --upload-only
echo.
echo Dang loc va lam sach du lieu KFM...
"%SCRIPT_DIR%ReconcileData.exe" --upload-only "%BASE_DIR%\Data\KFM\KFM_%DATE_ARG%.xlsx"
if %ERRORLEVEL% neq 0 (
    echo.
    powershell -Command "Write-Host 'Co loi xay ra khi chay lam sach du lieu!' -ForegroundColor Red"
    pause
    exit /b 1
)

REM 5. Day du lieu thuc xuat len Google Sheets qua Apps Script
if exist "C:\temp_restore\clean_kfm.csv" (
    echo.
    echo Dang day du lieu thuc xuat len Google Sheets...
    call node "%SCRIPT_DIR%upload_to_sheets.js" "C:\temp_restore\clean_kfm.csv"
    if %ERRORLEVEL% neq 0 (
        echo.
        powershell -Command "Write-Host 'Loi khi day du lieu len Google Sheets!' -ForegroundColor Red"
        del "C:\temp_restore\clean_kfm.csv"
        pause
        exit /b 1
    )
    del "C:\temp_restore\clean_kfm.csv"
) else (
    echo.
    powershell -Command "Write-Host 'Khong tim thay file clean_kfm.csv de upload!' -ForegroundColor Yellow"
)

REM 6. Don dep file raw trong Data/KFM
if exist "%BASE_DIR%\Data\KFM\KFM_%DATE_ARG%.xlsx" (
    del "%BASE_DIR%\Data\KFM\KFM_%DATE_ARG%.xlsx"
)

echo.
powershell -Command "Write-Host '=== HOAN THANH CAP NHAT DU LIEU NGAY %DATE_ARG% LEN GOOGLE SHEETS! ===' -ForegroundColor Green"
pause
