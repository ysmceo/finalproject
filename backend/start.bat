@echo off
echo Starting CEO SALOON Server...
echo.
if "%PORT%"=="" set PORT=3000
echo The server will run on http://localhost:%PORT%
echo.
echo Customer Website: http://localhost:%PORT%
echo Admin Dashboard: http://localhost:%PORT%/admin
echo.
echo Press Ctrl+C to stop the server
echo.
node server.js
