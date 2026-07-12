@echo off
chcp 65001 > nul
setlocal

set "TELEGRAM_TOKEN=8902427051:AAHpWe9UxoGplPd6XbkjCsc5A7a8Y2LMs7Y"
REM Danh sach Chat ID, cach nhau bang dau phay. Them Group ID moi vao day.
REM   - 5958913327 = Inbox ca nhan cua ban
REM   - Them Group ID (so am) phia sau, vi du: 5958913327,-100123456789
set "TELEGRAM_CHATID=5958913327"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%~dp0..") do set "BASE_DIR=%%~fI"

echo.
echo Dang bien dich script C#...
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

pushd "%SCRIPT_DIR%"
%CSC% /nologo /out:ReconcileData.exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ReconcileData.cs
popd

if exist "%SCRIPT_DIR%ReconcileData.exe" (
    echo.
    echo.
    echo Dang chay chuong trinh doi soat...
    "%SCRIPT_DIR%ReconcileData.exe" "%BASE_DIR%\Data\Data ST" "%BASE_DIR%\Data\KFM" "%BASE_DIR%\Data\ABA" "%BASE_DIR%\Ouput\Result.csv" "%TELEGRAM_TOKEN%" "%TELEGRAM_CHATID%"
    
    echo.
    echo Dang day du lieu moi len GitHub...
    pushd "%BASE_DIR%"
    git add "Data/Data ST/DATA ST.xlsx" "Data/KFM/KFM.xlsx" "Data/ABA/ABA.xlsx" "Ouput/status.json" "Ouput/Result.csv"
    git commit -m "Auto-update data files from Google Drive"
    git push origin main
    popd

    echo.
    echo Dang mo Bao Cao Canh Bao...
    start "" "%BASE_DIR%\Ouput\BaoCao_CanhBao.html"
) else (
    echo.
    echo Co loi xay ra khi bien dich.
)
