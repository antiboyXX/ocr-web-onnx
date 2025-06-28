@echo off
echo 🚀 启动OCR Web移动端服务...
echo.

echo 📡 检测网络IP地址...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        if not "%%b"=="127.0.0.1" (
            echo 📱 移动端访问地址: http://%%b:5000
        )
    )
)

echo.
echo 🔥 启动Flask服务器...
echo ⚠️  确保手机和电脑连接同一Wi-Fi网络
echo.

python main_server.py

pause 