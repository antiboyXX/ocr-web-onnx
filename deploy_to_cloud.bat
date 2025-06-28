@echo off
color 0B
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║              🚀 OCR Web 云部署准备工具                ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

echo 📋 检查部署文件...
echo.

REM 检查必要文件
if exist "requirements.txt" (
    echo ✅ requirements.txt - 存在
) else (
    echo ❌ requirements.txt - 缺失
)

if exist "Procfile" (
    echo ✅ Procfile - 存在
) else (
    echo ❌ Procfile - 缺失
)

if exist "main_server.py" (
    echo ✅ main_server.py - 存在
) else (
    echo ❌ main_server.py - 缺失
)

if exist "Dockerfile" (
    echo ✅ Dockerfile - 存在
) else (
    echo ❌ Dockerfile - 缺失
)

echo.
echo 🌟 推荐的云平台部署方案：
echo.
echo 1. 🚀 Railway.app      - 免费，最简单，强烈推荐
echo 2. 🌟 Render.com      - 免费，稳定
echo 3. 🔷 Heroku.com      - 需要信用卡验证
echo.

set /p choice=请选择平台 (1-3): 

if "%choice%"=="1" goto railway
if "%choice%"=="2" goto render
if "%choice%"=="3" goto heroku
goto end

:railway
echo.
echo 🚀 Railway 部署步骤：
echo.
echo 📝 第一步：准备GitHub仓库
echo   1. 访问 https://github.com 
echo   2. 创建新仓库，名称：ocr-web-onnx
echo   3. 复制仓库地址
echo.
echo 🔧 第二步：本地Git配置
echo   在当前目录运行以下命令：
echo.
echo   git init
echo   git add .
echo   git commit -m "Ready for Railway deployment"
echo   git remote add origin https://github.com/你的用户名/ocr-web-onnx.git
echo   git push -u origin main
echo.
echo 🌐 第三步：Railway部署
echo   1. 访问：https://railway.app
echo   2. 用GitHub账号登录
echo   3. 点击 "New Project"
echo   4. 选择 "Deploy from GitHub repo"
echo   5. 选择 ocr-web-onnx 仓库
echo   6. 等待自动部署完成
echo.
echo 📖 详细指南：查看 RAILWAY_DEPLOY.md
goto end

:render
echo.
echo 🌟 Render 部署步骤：
echo.
echo 1. 访问：https://render.com
echo 2. 用GitHub账号登录
echo 3. 点击 "New +" → "Web Service"
echo 4. 连接GitHub仓库
echo 5. 配置：
echo    - Build Command: pip install -r requirements.txt
echo    - Start Command: gunicorn -w 2 -b 0.0.0.0:$PORT main_server:app
echo 6. 点击创建并等待部署
goto end

:heroku
echo.
echo 🔷 Heroku 部署步骤：
echo.
echo 1. 访问：https://heroku.com 注册账号
echo 2. 验证信用卡（免费额度）
echo 3. 安装 Heroku CLI
echo 4. 运行：heroku login
echo 5. 运行：heroku create your-app-name
echo 6. 运行：git push heroku main
goto end

:end
echo.
echo 🎉 准备就绪！选择一个平台开始部署吧！
echo 📋 部署成功后，你将获得一个永久的公网访问地址
echo 🌍 例如：https://your-project.railway.app
echo.
echo 💡 提示：推荐使用Railway，最简单且完全免费！
echo 📖 详细指南：RAILWAY_DEPLOY.md
echo.
pause 