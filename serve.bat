@echo off
REM Serve this folder so the site can be tested without pushing.
REM
REM MUST KEEP CRLF LINE ENDINGS -- batch parsing breaks on bare newlines.
REM
REM Each interpreter is TESTED BY RUNNING IT, not by asking `where`.
REM Windows ships a Microsoft Store stub called python.exe: `where` finds
REM it, so the previous version picked it, and all it does is print
REM "Python was not found" and quit. Running a one-liner tells the
REM difference between a real interpreter and a placeholder.
setlocal
cd /d "%~dp0"

py -c "pass" >nul 2>nul
if not errorlevel 1 goto usepy
python -c "pass" >nul 2>nul
if not errorlevel 1 goto usepython
node -e "0" >nul 2>nul
if not errorlevel 1 goto usenode
goto useps

:usepy
echo   Using Python. Serving at http://localhost:8080
echo   Open  http://localhost:8080/create.html
echo.
py -m http.server 8080
goto done

:usepython
echo   Using Python. Serving at http://localhost:8080
echo   Open  http://localhost:8080/create.html
echo.
python -m http.server 8080
goto done

:usenode
echo   Using Node. Serving at http://localhost:8080
echo   Open  http://localhost:8080/create.html
echo.
node "tools\serve.js"
goto done

:useps
REM PowerShell ships with Windows, so this path needs nothing installed.
echo   No Python or Node found - using PowerShell instead.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1"
goto done

:done
echo.
pause
