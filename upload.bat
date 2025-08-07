@echo off

echo Adding all changes to Git...
git add .

echo.
set /p commitMessage="Enter your commit message: "

echo.
echo Committing changes...
git commit -m "%commitMessage%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo =====================================
echo   Upload complete!
echo =====================================

pause
