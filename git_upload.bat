@echo off
echo 🚀 自动上传代码到GitHub
echo.

REM 检查是否已经初始化git
if not exist ".git" (
    echo 📝 初始化Git仓库...
    git init
    echo ✅ Git仓库初始化完成
) else (
    echo ✅ Git仓库已存在
)

echo.
echo 📋 请输入你的GitHub仓库地址：
echo 📌 格式:https://github.com/antiboyXX/OCR_Web_ONNX.git
set /p repo_url="仓库地址: "

echo.
echo 📦 添加所有文件...
git add .

echo.
echo 💬 提交代码...
git commit -m "Initial commit - OCR Web ONNX project ready for Railway deployment"

echo.
echo 🔗 添加远程仓库...
git remote remove origin 2>nul
git remote add origin %repo_url%

echo.
echo ⬆️ 推送到GitHub...
git branch -M main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ✅ 代码上传成功！
    echo 🎉 现在可以在Railway中部署了
    echo.
    echo 📝 下一步：
    echo   1. 回到Railway网站
    echo   2. 点击 "New Project"
    echo   3. 选择 "Deploy from GitHub repo"
    echo   4. 选择 ocr-web-onnx 仓库
    echo.
) else (
    echo.
    echo ❌ 上传失败，请检查：
    echo   1. GitHub仓库地址是否正确
    echo   2. 是否已登录GitHub账号
    echo   3. 网络连接是否正常
    echo.
    echo 💡 手动上传方法：
    echo   git init
    echo   git add .
    echo   git commit -m "Initial commit"
    echo   git remote add origin %repo_url%
    echo   git push -u origin main
)

echo.
pause 