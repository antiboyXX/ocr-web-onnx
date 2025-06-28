# 🚀 Railway 部署指南

## 📋 前置准备

✅ 确保以下文件存在：
- `requirements.txt` - Python依赖
- `Procfile` - 启动配置
- `main_server.py` - 主程序

## 🔧 一键部署步骤

### 步骤1: GitHub准备
```bash
# 1. 在GitHub创建新仓库: ocr-web-onnx
# 2. 在本地项目目录运行：

git init
git add .
git commit -m "Ready for Railway deployment"
git remote add origin https://github.com/你的用户名/ocr-web-onnx.git
git push -u origin main
```

### 步骤2: Railway部署
1. 🌐 访问：https://railway.app
2. 🔑 点击 **"Login"** → 选择 **"GitHub"**
3. 📋 点击 **"New Project"**
4. 📁 选择 **"Deploy from GitHub repo"**
5. 🎯 找到并选择 `ocr-web-onnx` 仓库
6. ⚡ Railway自动开始部署

### 步骤3: 等待部署完成
```
⏳ 安装依赖... (1-2分钟)
🔧 构建应用... (1-2分钟)
🚀 启动服务... (30秒)
✅ 部署成功！
```

### 步骤4: 获取访问地址
```
🎉 你的OCR网站：
https://你的项目名.railway.app

🔗 例如：
https://ocr-web-onnx-production.railway.app
```

## 🎨 自定义域名（可选）

### 在Railway控制台：
1. 进入项目设置
2. 点击 **"Domains"**
3. 点击 **"Custom Domain"**
4. 输入你的域名（如：ocr.你的域名.com）

## 📊 使用限制

### 免费套餐：
- ✅ **500小时/月** 运行时间
- ✅ **无限制** 部署次数
- ✅ **自动HTTPS** 
- ✅ **自定义域名**

### 付费套餐（$5/月）：
- ✅ **无限制** 运行时间
- ✅ **更高性能**

## 🔄 更新部署

```bash
# 修改代码后，简单推送即可自动重新部署
git add .
git commit -m "Update OCR features"
git push
```

## 🐛 故障排除

### 查看日志：
1. 进入Railway项目控制台
2. 点击 **"Logs"** 标签
3. 查看实时日志信息

### 常见问题：
```
问题: 内存不足
解决: 在Railway设置中增加内存限制

问题: 启动超时
解决: 检查requirements.txt依赖版本

问题: 无法访问
解决: 检查main_server.py的端口配置
```

## ✅ 部署成功检查

访问你的Railway域名，应该看到：
- 🎨 OCR上传界面
- 📱 响应式设计（手机友好）
- 🔍 正常的文件上传功能

## 🌟 恭喜！

🎉 你的OCR图文分离系统已经成功部署到云端！
🌍 全世界任何地方的人都可以访问你的网站了！

---

**下一步：** 将这个域名写进你的简历，向HR展示你的项目！ 