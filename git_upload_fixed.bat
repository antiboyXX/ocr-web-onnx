@echo off
chcp 65001 >nul
echo 🚀 上传代码到GitHub (修复版)
echo.

REM 检查Git是否安装
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git未安装或未添加到PATH
    echo 📥 请先安装Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM 设置Git配置（如果尚未设置）
echo 🔧 检查Git配置...
git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    set /p username="请输入GitHub用户名: "
    git config --global user.name "%username%"
)

git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    set /p email="请输入GitHub邮箱: "
    git config --global user.email "%email%"
)

REM 初始化Git仓库
if not exist ".git" (
    echo 📝 初始化Git仓库...
    git init
)

echo.
echo 📦 添加文件到暂存区...
git add .

echo 💬 提交代码...
git commit -m "Initial commit - OCR Web ONNX project"

echo 🔗 设置远程仓库...
REM 删除可能存在的origin
git remote remove origin >nul 2>&1

REM 添加GitHub仓库
set REPO_URL=https://github.com/antiboyXX/OCR_Web_ONNX.git
git remote add origin %REPO_URL%

echo ⬆️ 推送代码到GitHub...
git branch -M main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ✅ 上传成功！
    echo 🎉 仓库地址: %REPO_URL%
    echo.
    echo 📝 下一步在Railway中部署:
    echo   1. 访问 https://railway.app
    echo   2. New Project
    echo   3. Deploy from GitHub repo
    echo   4. 选择 OCR_Web_ONNX 仓库
) else (
    echo.
    echo ❌ 上传失败，可能原因:
    echo   1. 网络连接问题
    echo   2. GitHub仓库不存在或无权限
    echo   3. 需要GitHub登录验证
    echo.
    echo 💡 手动验证方法:
    echo   1. 浏览器访问: %REPO_URL%
    echo   2. 确认仓库存在且可访问
    echo   3. 检查GitHub登录状态
)

echo.
pause 