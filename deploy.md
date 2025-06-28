# 🚀 OCR Web ONNX 部署指南

本指南将帮助您快速部署 OCR Web ONNX 到各种环境中。

## 📋 部署前准备

### 系统要求
- **浏览器支持**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **WebGL支持**: 用于GPU加速推理
- **WebAssembly支持**: 基础运行要求
- **网络**: 用于模型文件下载（初次加载）

### 文件结构检查
确保您的项目包含以下文件结构：
```
OCR_Web_ONNX/
├── index.html
├── css/
│   ├── main.css
│   └── components.css
├── js/
│   ├── main.js
│   ├── onnx-handler.js
│   ├── image-processor.js
│   ├── result-exporter.js
│   └── utils.js
├── models/
│   ├── model-config.json
│   └── [ONNX模型文件]
├── libs/
│   └── onnx.min.js
└── assets/
```

## 🌐 部署方式

### 方式一：本地开发服务器

#### 使用 Python HTTP 服务器
```bash
cd OCR_Web_ONNX
python -m http.server 8000
```

#### 使用 Node.js HTTP 服务器
```bash
cd OCR_Web_ONNX
npx serve .
```

#### 使用 PHP 内置服务器
```bash
cd OCR_Web_ONNX
php -S localhost:8000
```

### 方式二：静态网站托管

#### GitHub Pages
1. 将项目推送到 GitHub 仓库
2. 进入仓库设置页面
3. 找到 "Pages" 设置
4. 选择源分支（通常是 main 或 master）
5. 等待部署完成

#### Netlify
1. 注册 Netlify 账户
2. 连接 GitHub 仓库或直接拖拽项目文件夹
3. 设置构建命令（留空，因为是静态文件）
4. 设置发布目录为根目录
5. 点击部署

#### Vercel
1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 在项目目录中运行
```bash
vercel
```

3. 按照提示完成部署

### 方式三：云服务器部署

#### Nginx 配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/ocr-web-onnx;
    index index.html;

    # 支持大文件上传
    client_max_body_size 100M;

    # CORS 设置
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    add_header Access-Control-Allow-Headers 'Content-Type';

    # 缓存设置
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.onnx$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json;

    # 错误页面
    error_page 404 /index.html;
}
```

#### Apache 配置示例
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/ocr-web-onnx
    
    # 支持大文件上传
    LimitRequestBody 104857600
    
    # CORS 设置
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type"
    
    # 缓存设置
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|onnx)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
    </LocationMatch>
    
    # Gzip 压缩
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \
            \.(?:gif|jpe?g|png|onnx)$ no-gzip dont-vary
    </Location>
</VirtualHost>
```

## 🎯 模型文件准备

### 获取 ONNX 模型文件

#### 方式一：从 PaddleOCR 转换
```bash
# 安装转换工具
pip install paddle2onnx paddlepaddle

# 下载 PaddleOCR 模型
wget https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_det_infer.tar
wget https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_rec_infer.tar

# 解压模型
tar -xf ch_PP-OCRv4_det_infer.tar
tar -xf ch_PP-OCRv4_rec_infer.tar

# 转换检测模型
paddle2onnx \
    --model_dir ./ch_PP-OCRv4_det_infer \
    --model_filename inference.pdmodel \
    --params_filename inference.pdiparams \
    --save_file ./models/ch_PP-OCRv4_det_infer.onnx \
    --opset_version 11

# 转换识别模型
paddle2onnx \
    --model_dir ./ch_PP-OCRv4_rec_infer \
    --model_filename inference.pdmodel \
    --params_filename inference.pdiparams \
    --save_file ./models/ch_PP-OCRv4_rec_infer.onnx \
    --opset_version 11
```

#### 方式二：下载预转换模型
```bash
# 创建模型目录
mkdir -p models

# 下载模型文件（示例链接，请替换为实际地址）
wget -O models/ch_PP-OCRv4_det_infer.onnx [模型下载链接]
wget -O models/ch_PP-OCRv4_rec_infer.onnx [模型下载链接]
```

### 模型优化（可选）
```bash
# 安装 ONNX 优化工具
pip install onnx onnxoptimizer

# 优化模型
python -c "
import onnx
from onnxoptimizer import optimize

# 加载模型
model = onnx.load('models/ch_PP-OCRv4_det_infer.onnx')

# 优化模型
optimized_model = optimize(model)

# 保存优化后的模型
onnx.save(optimized_model, 'models/ch_PP-OCRv4_det_infer_opt.onnx')
"
```

## ⚙️ 配置优化

### 性能优化配置

#### 1. 启用 WebGL 加速
```javascript
// 在 js/main.js 中确保
this.config.executionProvider = 'webgl';
```

#### 2. 启用模型缓存
```javascript
// 在 LocalStorage 中缓存模型
const modelCache = {
    enable: true,
    maxSize: 500 * 1024 * 1024, // 500MB
    ttl: 7 * 24 * 60 * 60 * 1000 // 7天
};
```

#### 3. 批处理优化
```javascript
// 批量处理文字区域
const batchConfig = {
    enabled: true,
    batchSize: 8,
    concurrency: 2
};
```

### 安全配置

#### 1. CSP 设置
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: blob:; 
               connect-src 'self' https:;">
```

#### 2. 文件上传限制
```javascript
const uploadLimits = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFiles: 10
};
```

## 🔧 故障排除

### 常见问题

#### 1. 模型加载失败
```
错误: 无法获取模型文件
解决: 
- 检查模型文件路径是否正确
- 确保服务器支持大文件下载
- 检查网络连接
- 验证 CORS 设置
```

#### 2. WebGL 不可用
```
错误: WebGL context lost
解决:
- 切换到 WebAssembly 执行器
- 更新显卡驱动
- 检查浏览器 WebGL 支持
```

#### 3. 内存不足
```
错误: Out of memory
解决:
- 减小图片尺寸
- 启用模型量化
- 减少批处理大小
- 清理浏览器缓存
```

### 性能调试

#### 1. 启用性能监控
```javascript
// 在控制台中运行
performance.mark('ocr-start');
// OCR 处理
performance.mark('ocr-end');
performance.measure('ocr-duration', 'ocr-start', 'ocr-end');
console.log(performance.getEntriesByType('measure'));
```

#### 2. 内存使用监控
```javascript
// 检查内存使用
if (performance.memory) {
    console.log('内存使用:', {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB'
    });
}
```

## 📱 移动端优化

### PWA 配置
创建 `manifest.json`:
```json
{
    "name": "OCR Web ONNX",
    "short_name": "OCR ONNX",
    "description": "浏览器端智能文字识别",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#2196F3",
    "icons": [
        {
            "src": "assets/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "assets/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

### Service Worker
创建 `sw.js`:
```javascript
const CACHE_NAME = 'ocr-web-onnx-v1';
const urlsToCache = [
    '/',
    '/css/main.css',
    '/css/components.css',
    '/js/main.js',
    '/libs/onnx.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
```

## 🚀 部署清单

- [ ] 准备所有必需文件
- [ ] 转换或下载 ONNX 模型文件
- [ ] 配置 Web 服务器
- [ ] 设置 CORS 和缓存策略
- [ ] 测试各项功能
- [ ] 优化性能配置
- [ ] 设置监控和日志
- [ ] 配置 PWA（可选）
- [ ] 准备移动端适配
- [ ] 文档和用户指南

## 📞 技术支持

如果在部署过程中遇到问题，请：

1. 检查浏览器控制台错误信息
2. 验证网络和 CORS 设置
3. 确认模型文件完整性
4. 查看 GitHub Issues
5. 提交详细的错误报告

---

祝您部署顺利！🎉 