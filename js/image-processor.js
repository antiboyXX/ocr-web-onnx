/**
 * Image Processor - 图像处理模块
 * 负责图像加载、预处理、结果可视化等功能
 */

class ImageProcessor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.tempCanvas = null;
        this.tempCtx = null;
        
        this.initializeCanvas();
    }

    /**
     * 初始化Canvas
     */
    initializeCanvas() {
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
    }

    /**
     * 加载图片文件
     */
    async loadImage(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('无效的图片文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`图片加载完成: ${img.width}x${img.height}`);
                    resolve(img);
                };
                img.onerror = () => {
                    reject(new Error('图片加载失败'));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 预处理图像（为OCR准备）
     */
    async preprocessImage(imageElement, config) {
        try {
            console.log('开始预处理图像...');
            
            // 设置画布尺寸
            this.tempCanvas.width = imageElement.width;
            this.tempCanvas.height = imageElement.height;
            
            // 绘制原始图像
            this.tempCtx.drawImage(imageElement, 0, 0);
            
            // 获取图像数据
            const imageData = this.tempCtx.getImageData(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            
            // 应用预处理滤镜
            const processedImageData = this.applyFilters(imageData, config);
            
            // 将处理后的数据放回画布
            this.tempCtx.putImageData(processedImageData, 0, 0);
            
            console.log('图像预处理完成');
            return this.tempCanvas;
            
        } catch (error) {
            console.error('图像预处理失败:', error);
            throw new Error(`图像预处理失败: ${error.message}`);
        }
    }

    /**
     * 应用图像滤镜
     */
    applyFilters(imageData, config) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;

        // 根据配置应用不同的滤镜
        if (config.grayscale) {
            this.convertToGrayscale(data);
        }
        
        if (config.contrast) {
            this.adjustContrast(data, config.contrast);
        }
        
        if (config.brightness) {
            this.adjustBrightness(data, config.brightness);
        }
        
        if (config.sharpen) {
            this.applySharpen(data, width, height);
        }

        return new ImageData(data, width, height);
    }

    /**
     * 转换为灰度图
     */
    convertToGrayscale(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
            // Alpha channel (data[i + 3]) 保持不变
        }
    }

    /**
     * 调整对比度
     */
    adjustContrast(data, contrast) {
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
            data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
            data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
        }
    }

    /**
     * 调整亮度
     */
    adjustBrightness(data, brightness) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] + brightness));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness));
        }
    }

    /**
     * 应用锐化滤镜
     */
    applySharpen(data, width, height) {
        const sharpenKernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];
        
        this.applyKernel(data, width, height, sharpenKernel, 3);
    }

    /**
     * 应用卷积核
     */
    applyKernel(data, width, height, kernel, kernelSize) {
        const originalData = new Uint8ClampedArray(data);
        const half = Math.floor(kernelSize / 2);
        
        for (let y = half; y < height - half; y++) {
            for (let x = half; x < width - half; x++) {
                let r = 0, g = 0, b = 0;
                
                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                        const kernelIndex = (ky + half) * kernelSize + (kx + half);
                        const weight = kernel[kernelIndex];
                        
                        r += originalData[pixelIndex] * weight;
                        g += originalData[pixelIndex + 1] * weight;
                        b += originalData[pixelIndex + 2] * weight;
                    }
                }
                
                const currentIndex = (y * width + x) * 4;
                data[currentIndex] = Math.max(0, Math.min(255, r));
                data[currentIndex + 1] = Math.max(0, Math.min(255, g));
                data[currentIndex + 2] = Math.max(0, Math.min(255, b));
            }
        }
    }

    /**
     * 绘制OCR识别结果
     */
    async drawResults(canvas, imageElement, ocrResults, options = {}) {
        try {
            const ctx = canvas.getContext('2d');
            
            // 设置画布尺寸
            const maxWidth = 800;
            const maxHeight = 600;
            const { width, height } = this.calculateDisplaySize(
                imageElement.width, 
                imageElement.height, 
                maxWidth, 
                maxHeight
            );
            
            canvas.width = width;
            canvas.height = height;
            
            const scaleX = width / imageElement.width;
            const scaleY = height / imageElement.height;
            
            // 绘制原始图像
            ctx.drawImage(imageElement, 0, 0, width, height);
            
            // 绘制识别结果
            if (ocrResults.texts && ocrResults.texts.length > 0) {
                this.drawTextBoxes(ctx, ocrResults.texts, scaleX, scaleY, options);
            }
            
            console.log(`绘制了 ${ocrResults.texts?.length || 0} 个文字区域`);
            
        } catch (error) {
            console.error('结果绘制失败:', error);
            throw new Error(`结果绘制失败: ${error.message}`);
        }
    }

    /**
     * 绘制文字边界框和文本
     */
    drawTextBoxes(ctx, texts, scaleX, scaleY, options) {
        const {
            showBoxes = true,
            showText = true,
            showConfidence = false
        } = options;

        // 设置样式
        ctx.lineWidth = 2;
        ctx.font = '12px Arial';
        
        texts.forEach((textItem, index) => {
            if (!textItem.box) return;
            
            const [x1, y1, x2, y2] = textItem.box;
            const scaledBox = [
                x1 * scaleX,
                y1 * scaleY,
                x2 * scaleX,
                y2 * scaleY
            ];
            
            // 生成颜色
            const color = this.generateColor(index);
            
            // 绘制边界框
            if (showBoxes) {
                ctx.strokeStyle = color;
                ctx.strokeRect(
                    scaledBox[0], 
                    scaledBox[1], 
                    scaledBox[2] - scaledBox[0], 
                    scaledBox[3] - scaledBox[1]
                );
            }
            
            // 绘制文字
            if (showText && textItem.text) {
                ctx.fillStyle = color;
                ctx.fillRect(scaledBox[0], scaledBox[1] - 16, 
                    ctx.measureText(textItem.text).width + 4, 16);
                
                ctx.fillStyle = 'white';
                ctx.fillText(textItem.text, scaledBox[0] + 2, scaledBox[1] - 4);
            }
            
            // 绘制置信度
            if (showConfidence && textItem.confidence) {
                const confidenceText = `${(textItem.confidence * 100).toFixed(1)}%`;
                ctx.fillStyle = color;
                ctx.fillText(confidenceText, scaledBox[2] - 40, scaledBox[3] + 12);
            }
        });
    }

    /**
     * 生成颜色
     */
    generateColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8E8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[index % colors.length];
    }

    /**
     * 计算显示尺寸（保持宽高比）
     */
    calculateDisplaySize(originalWidth, originalHeight, maxWidth, maxHeight) {
        const widthRatio = maxWidth / originalWidth;
        const heightRatio = maxHeight / originalHeight;
        const scale = Math.min(widthRatio, heightRatio, 1); // 不放大
        
        return {
            width: Math.round(originalWidth * scale),
            height: Math.round(originalHeight * scale)
        };
    }

    /**
     * 图像质量分析
     */
    analyzeImageQuality(imageElement) {
        try {
            this.tempCanvas.width = imageElement.width;
            this.tempCanvas.height = imageElement.height;
            this.tempCtx.drawImage(imageElement, 0, 0);
            
            const imageData = this.tempCtx.getImageData(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            const data = imageData.data;
            
            // 计算平均亮度
            let totalBrightness = 0;
            let totalContrast = 0;
            let pixelCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const brightness = (r + g + b) / 3;
                totalBrightness += brightness;
                pixelCount++;
            }
            
            const avgBrightness = totalBrightness / pixelCount;
            
            // 计算对比度
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const brightness = (r + g + b) / 3;
                totalContrast += Math.abs(brightness - avgBrightness);
            }
            
            const avgContrast = totalContrast / pixelCount;
            
            return {
                brightness: avgBrightness,
                contrast: avgContrast,
                resolution: {
                    width: imageElement.width,
                    height: imageElement.height,
                    megapixels: (imageElement.width * imageElement.height / 1000000).toFixed(2)
                },
                quality: this.assessQuality(avgBrightness, avgContrast, imageElement.width, imageElement.height)
            };
            
        } catch (error) {
            console.error('图像质量分析失败:', error);
            return {
                brightness: 128,
                contrast: 50,
                resolution: { width: 0, height: 0, megapixels: '0' },
                quality: 'unknown'
            };
        }
    }

    /**
     * 评估图像质量
     */
    assessQuality(brightness, contrast, width, height) {
        let score = 0;
        
        // 亮度评分 (理想范围: 100-200)
        if (brightness >= 100 && brightness <= 200) {
            score += 30;
        } else if (brightness >= 80 && brightness <= 220) {
            score += 20;
        } else {
            score += 10;
        }
        
        // 对比度评分 (越高越好，但不要过高)
        if (contrast >= 40 && contrast <= 80) {
            score += 30;
        } else if (contrast >= 25 && contrast <= 100) {
            score += 20;
        } else {
            score += 10;
        }
        
        // 分辨率评分
        const totalPixels = width * height;
        if (totalPixels >= 500000) { // 0.5MP+
            score += 40;
        } else if (totalPixels >= 200000) { // 0.2MP+
            score += 30;
        } else if (totalPixels >= 100000) { // 0.1MP+
            score += 20;
        } else {
            score += 10;
        }
        
        // 评级
        if (score >= 85) return 'excellent';
        if (score >= 70) return 'good';
        if (score >= 55) return 'fair';
        return 'poor';
    }

    /**
     * 创建图像缩略图
     */
    createThumbnail(imageElement, maxSize = 150) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const { width, height } = this.calculateDisplaySize(
            imageElement.width,
            imageElement.height,
            maxSize,
            maxSize
        );
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(imageElement, 0, 0, width, height);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * 图像格式转换
     */
    convertImageFormat(imageElement, format = 'image/png', quality = 0.9) {
        this.tempCanvas.width = imageElement.width;
        this.tempCanvas.height = imageElement.height;
        this.tempCtx.drawImage(imageElement, 0, 0);
        
        return this.tempCanvas.toDataURL(format, quality);
    }

    /**
     * 获取图像统计信息
     */
    getImageStats(imageElement) {
        try {
            this.tempCanvas.width = imageElement.width;
            this.tempCanvas.height = imageElement.height;
            this.tempCtx.drawImage(imageElement, 0, 0);
            
            const imageData = this.tempCtx.getImageData(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            const data = imageData.data;
            
            let rSum = 0, gSum = 0, bSum = 0;
            let rMin = 255, gMin = 255, bMin = 255;
            let rMax = 0, gMax = 0, bMax = 0;
            const pixelCount = data.length / 4;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                rSum += r; gSum += g; bSum += b;
                rMin = Math.min(rMin, r); gMin = Math.min(gMin, g); bMin = Math.min(bMin, b);
                rMax = Math.max(rMax, r); gMax = Math.max(gMax, g); bMax = Math.max(bMax, b);
            }
            
            return {
                mean: {
                    r: Math.round(rSum / pixelCount),
                    g: Math.round(gSum / pixelCount),
                    b: Math.round(bSum / pixelCount)
                },
                range: {
                    r: { min: rMin, max: rMax },
                    g: { min: gMin, max: gMax },
                    b: { min: bMin, max: bMax }
                },
                totalPixels: pixelCount,
                aspectRatio: (imageElement.width / imageElement.height).toFixed(2)
            };
            
        } catch (error) {
            console.error('图像统计失败:', error);
            return null;
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.tempCanvas) {
            this.tempCanvas.width = 0;
            this.tempCanvas.height = 0;
        }
        this.tempCanvas = null;
        this.tempCtx = null;
    }
}

// 导出类
window.ImageProcessor = ImageProcessor; 