@echo off
echo 🔍 检查GitHub仓库状态
echo.

echo 📋 你的GitHub仓库信息：
echo 用户名: antiboyXX
echo 仓库名: OCR_Web_ONNX
echo 完整地址: https://github.com/antiboyXX/OCR_Web_ONNX
echo.

echo 🌐 正在检查仓库是否存在...
curl -s -o nul -w "%%{http_code}" https://github.com/antiboyXX/OCR_Web_ONNX > temp_status.txt
set /p status=<temp_status.txt
del temp_status.txt

if "%status%"=="200" (
    echo ✅ 仓库存在且可访问
    echo 💡 可以直接进行部署
) else (
    echo ❌ 仓库不存在或无法访问 (状态码: %status%)
    echo.
    echo 🛠️ 请先创建GitHub仓库：
    echo   1. 访问: https://github.com/new
    echo   2. Repository name: OCR_Web_ONNX
    echo   3. 设置为 Public
    echo   4. 点击 "Create repository"
)

echo.
echo 🔧 Git状态检查：
git --version 2>nul
if %errorlevel% equ 0 (
    echo ✅ Git已安装
) else (
    echo ❌ Git未安装
    echo 📥 下载地址: https://git-scm.com/download/win
)

echo.
pause 