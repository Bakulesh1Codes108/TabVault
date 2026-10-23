@echo off
setlocal
title Install TabVault for Chrome / Edge
REM Copies the TabVault extension to %LOCALAPPDATA%\TabVault\extension and opens your browser's
REM extensions page. Safe: never deletes anything (robocopy without /MIR only adds or updates files).

set "SRC=%~dp0extension"
set "DEST=%LOCALAPPDATA%\TabVault\extension"

if not exist "%SRC%\manifest.json" (
  echo Could not find the "extension" folder next to this file.
  echo Please run this from the "windows" folder of TabVault.
  pause
  exit /b 1
)

echo Copying TabVault to:
echo   %DEST%
robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP >nul
if %ERRORLEVEL% GEQ 8 (
  echo Copy failed. Nothing else was changed.
  pause
  exit /b 1
)

REM Put the folder path on the clipboard so it can be pasted into "Load unpacked".
<nul set /p "=%DEST%" | clip

set "BROWSER="
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set "BROWSER=chrome"
if not defined BROWSER reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1 && set "BROWSER=chrome"

if defined BROWSER (
  start "" chrome "chrome://extensions/"
) else (
  start "" msedge "edge://extensions/"
)

echo.
echo ================================================================
echo  Almost done - finish in the browser window that just opened:
echo.
echo   1. Turn ON "Developer mode" (top-right in Chrome, left side in Edge)
echo   2. Click "Load unpacked"
echo   3. Paste the folder path with Ctrl+V and press Enter, then "Select Folder"
echo      (it is already on your clipboard: %DEST%)
echo   4. Click the puzzle-piece icon and pin TabVault to the toolbar
echo.
echo  Updating later: run this file again, then click the reload
echo  arrow on the TabVault card in the extensions page.
echo ================================================================
echo.
pause
