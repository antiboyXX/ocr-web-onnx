@echo off
chcp 65001 >nul
echo 🚀 上传代码到GitHub (仓库名称已修正)
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
git commit -m "Initial commit - OCR Web ONNX project ready for Railway"

echo 🔗 设置远程仓库...
REM 删除可能存在的origin
git remote remove origin >nul 2>&1

REM 使用正确的仓库地址（小写+连字符）
set REPO_URL=https://github.com/antiboyXX/ocr-web-onnx.git
git remote add origin %REPO_URL%

echo ⬆️ 推送代码到GitHub...
git branch -M main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ✅ 上传成功！
    echo 🎉 仓库地址: %REPO_URL%
    echo 📱 网页查看: https://github.com/antiboyXX/ocr-web-onnx
    echo.
    echo 📝 下一步在Railway中部署:
    echo   1. 访问 https://railway.app
    echo   2. New Project
    echo   3. Deploy from GitHub repo
    echo   4. 选择 ocr-web-onnx 仓库
    echo   5. 等待自动部署完成
    echo.
    echo 🌟 部署成功后将获得永久访问地址！
) else (
    echo.
    echo ❌ 上传失败，请检查：
    echo   1. 网络连接是否正常
    echo   2. GitHub登录状态
    echo   3. 仓库访问权限
    echo.
    echo 🔧 可以尝试在浏览器中访问仓库验证：
    echo   https://github.com/antiboyXX/ocr-web-onnx
)

echo.
pause 