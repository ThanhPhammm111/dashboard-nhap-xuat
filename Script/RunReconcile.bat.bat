@echo off
setlocal

set "TELEGRAM_TOKEN=8902427051:AAHpWe9UxoGplPd6XbkjCsc5A7a8Y2LMs7Y"
REM Danh sach Chat ID, cach nhau bang dau phay. Them Group ID moi vao day.
REM   - 5958913327 = Inbox ca nhan cua ban
REM   - Them Group ID (so am) phia sau, vi du: 5958913327,-100123456789
set "TELEGRAM_CHATID=5958913327"

set "SCRIPT_DIR=%~dp0"
set "BASE_DIR=%~dp0.."
set "DATA_ST_EXCEL="
for /f "delims=" %%f in ('dir /b /o-d "%BASE_DIR%\Data\Data ST\*.xlsx" 2^>nul') do (
    set "DATA_ST_EXCEL=%BASE_DIR%\Data\Data ST\%%f"
    goto :doneST
)
:doneST

set "KFM_EXCEL="
for /f "delims=" %%f in ('dir /b /o-d "%BASE_DIR%\Data\KFM\*.xlsx" 2^>nul') do (
    set "KFM_EXCEL=%BASE_DIR%\Data\KFM\%%f"
    goto :doneKFM
)
:doneKFM

set "ABA_EXCEL="
for /f "delims=" %%f in ('dir /b /o-d "%BASE_DIR%\Data\ABA\*.xlsx" 2^>nul') do (
    set "ABA_EXCEL=%BASE_DIR%\Data\ABA\%%f"
    goto :doneABA
)
:doneABA

if "%KFM_EXCEL%"=="" (
    echo.
    echo LOI: KHONG TIM THAY FILE EXCEL TRONG THU MUC KFM!
    echo Vui long copy file KFM cua ngay hom nay vao thu muc Data\KFM roi chay lai.
    pause
    exit /b
)
if "%ABA_EXCEL%"=="" (
    echo.
    echo LOI: KHONG TIM THAY FILE EXCEL TRONG THU MUC ABA!
    echo Vui long copy file ABA cua ngay hom nay vao thu muc Data\ABA roi chay lai.
    pause
    exit /b
)

set "DATA_ST_CSV=%BASE_DIR%\Data\Data ST\DATA ST.csv"
set "KFM_CSV=%BASE_DIR%\Data\KFM\KFM.csv"
set "ABA_CSV=%BASE_DIR%\Data\ABA\ABA.csv"

echo Dang chuyen doi file DATA ST sang CSV...
powershell -Command "$xl=New-Object -ComObject Excel.Application; $xl.Visible=$false; $xl.DisplayAlerts=$false; $f=(Get-Item '%DATA_ST_EXCEL%').FullName; $c=(Get-Item '%BASE_DIR%\Data\Data ST').FullName + '\DATA ST.csv'; $wb=$xl.Workbooks.Open($f); $wb.SaveAs($c, 62); $wb.Close($false); $xl.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null"

echo Dang chuyen doi file KFM sang CSV...
powershell -Command "$xl=New-Object -ComObject Excel.Application; $xl.Visible=$false; $xl.DisplayAlerts=$false; $f=(Get-Item '%KFM_EXCEL%').FullName; $c=(Get-Item '%BASE_DIR%\Data\KFM').FullName + '\KFM.csv'; $wb=$xl.Workbooks.Open($f); $wb.SaveAs($c, 62); $wb.Close($false); $xl.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null"

echo Dang chuyen doi file ABA sang CSV...
powershell -Command "$xl=New-Object -ComObject Excel.Application; $xl.Visible=$false; $xl.DisplayAlerts=$false; $f=(Get-Item '%ABA_EXCEL%').FullName; $c=(Get-Item '%BASE_DIR%\Data\ABA').FullName + '\ABA.csv'; $wb=$xl.Workbooks.Open($f); $wb.SaveAs($c, 62); $wb.Close($false); $xl.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null"

echo.
echo Dang bien dich script C#...
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

pushd "%SCRIPT_DIR%"
%CSC% /nologo /out:ReconcileData.exe ReconcileData.cs
popd

if exist "%SCRIPT_DIR%ReconcileData.exe" (
    echo.
    echo Dang chay chuong trinh doi soat...
    "%SCRIPT_DIR%ReconcileData.exe" "%DATA_ST_CSV%" "%KFM_CSV%" "%ABA_CSV%" "%BASE_DIR%\Ouput\Result.csv" "%TELEGRAM_TOKEN%" "%TELEGRAM_CHATID%"
    
    echo.
    echo Dang di chuyen cac file da xu ly vao thu muc Archive...
    for /f "delims=" %%D in ('powershell -Command "Get-Date -Format yyyy-MM-dd"') do set DATE_STAMP=%%D
    set "ARCHIVE_DIR=%BASE_DIR%\Archive\%DATE_STAMP%"
    if not exist "%ARCHIVE_DIR%" mkdir "%ARCHIVE_DIR%"
    
    move /y "%KFM_EXCEL%" "%ARCHIVE_DIR%\" > nul
    
    echo.
    echo Da hoan thanh xong tat ca! File KFM cu da duoc luu tru, file ABA duoc giu lai.
    
    echo.
    echo Dang mo Bao Cao Canh Bao...
    start "" "%BASE_DIR%\Ouput\BaoCao_CanhBao.html"
) else (
    echo.
    echo Co loi xay ra khi bien dich.
)
