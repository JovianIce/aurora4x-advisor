@echo off
setlocal

set CONFIG=%1
if "%CONFIG%"=="" set CONFIG=Debug

set ROOT=%~dp0
set MSBUILD="C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
set PATCHES=%ROOT%AuroraPatch\bin\%CONFIG%\Patches

echo === Building AuroraPatch.sln (%CONFIG%) ===
%MSBUILD% "%ROOT%AuroraPatch.sln" /t:Build /p:Configuration=%CONFIG% /verbosity:minimal
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

echo.
echo === Deploying to Patches ===

if not exist "%PATCHES%\Lib" mkdir "%PATCHES%\Lib"
copy /Y "%ROOT%Lib\bin\%CONFIG%\Lib.dll" "%PATCHES%\Lib\" >nul
copy /Y "%ROOT%Lib\bin\%CONFIG%\Lib.pdb" "%PATCHES%\Lib\" >nul
echo   Lib.dll -^> Patches\Lib\

if not exist "%PATCHES%\AdvisorBridge" mkdir "%PATCHES%\AdvisorBridge"
copy /Y "%ROOT%AdvisorBridge\bin\%CONFIG%\AdvisorBridge.dll" "%PATCHES%\AdvisorBridge\" >nul
copy /Y "%ROOT%AdvisorBridge\bin\%CONFIG%\AdvisorBridge.pdb" "%PATCHES%\AdvisorBridge\" >nul
echo   AdvisorBridge.dll -^> Patches\AdvisorBridge\

echo.
echo === Done ===
