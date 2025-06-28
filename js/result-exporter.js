/**
 * Result Exporter - 结果导出模块
 * 负责将OCR识别结果导出为不同格式
 */

class ResultExporter {
    constructor() {
        this.supportedFormats = ['text', 'json', 'csv', 'xml', 'image'];
    }

    /**
     * 导出OCR识别结果
     */
    async export(format, ocrResults, imageElement) {
        try {
            console.log(`开始导出 ${format} 格式结果...`);
            
            switch (format.toLowerCase()) {
                case 'text':
                    return this.exportText(ocrResults);
                case 'json':
                    return this.exportJSON(ocrResults);
                case 'csv':
                    return this.exportCSV(ocrResults);
                case 'xml':
                    return this.exportXML(ocrResults);
                case 'image':
                    return this.exportImage(ocrResults, imageElement);
                default:
                    throw new Error(`不支持的导出格式: ${format}`);
            }
            
        } catch (error) {
            console.error('结果导出失败:', error);
            throw new Error(`导出失败: ${error.message}`);
        }
    }

    /**
     * 导出纯文本格式
     */
    exportText(ocrResults) {
        try {
            let textContent = '';
            
            // 添加标题
            textContent += '=== OCR 识别结果 ===\n';
            textContent += `导出时间: ${new Date().toLocaleString()}\n`;
            textContent += `识别区域数量: ${ocrResults.texts?.length || 0}\n`;
            textContent += `处理时间: ${ocrResults.totalTime?.toFixed(2)}ms\n\n`;
            
            // 添加识别文本
            if (ocrResults.texts && ocrResults.texts.length > 0) {
                textContent += '=== 识别内容 ===\n';
                
                ocrResults.texts.forEach((item, index) => {
                    if (item.text && item.text.trim()) {
                        textContent += `${index + 1}. ${item.text.trim()}\n`;
                    }
                });
                
                textContent += '\n=== 详细信息 ===\n';
                ocrResults.texts.forEach((item, index) => {
                    if (item.text && item.text.trim()) {
                        textContent += `区域 ${index + 1}:\n`;
                        textContent += `  文本: ${item.text.trim()}\n`;
                        if (item.confidence) {
                            textContent += `  置信度: ${(item.confidence * 100).toFixed(2)}%\n`;
                        }
                        if (item.box) {
                            textContent += `  坐标: (${item.box.map(x => Math.round(x)).join(', ')})\n`;
                        }
                        textContent += '\n';
                    }
                });
            } else {
                textContent += '未识别到文字内容\n';
            }
            
            // 下载文件
            const filename = `ocr_result_${this.getTimestamp()}.txt`;
            this.downloadFile(textContent, filename, 'text/plain');
            
            return { success: true, filename, content: textContent };
            
        } catch (error) {
            throw new Error(`文本导出失败: ${error.message}`);
        }
    }

    /**
     * 导出JSON格式
     */
    exportJSON(ocrResults) {
        try {
            const jsonData = {
                metadata: {
                    exportTime: new Date().toISOString(),
                    version: '1.0.0',
                    source: 'OCR Web ONNX',
                    totalTexts: ocrResults.texts?.length || 0,
                    processingTime: ocrResults.totalTime || 0,
                    modelType: ocrResults.modelType || 'unknown'
                },
                imageInfo: {
                    width: ocrResults.imageSize?.width || 0,
                    height: ocrResults.imageSize?.height || 0,
                    aspectRatio: ocrResults.imageSize?.width && ocrResults.imageSize?.height ? 
                        (ocrResults.imageSize.width / ocrResults.imageSize.height).toFixed(3) : null
                },
                performance: {
                    detectionTime: ocrResults.detectionTime || 0,
                    recognitionTime: ocrResults.recognitionTime || 0,
                    totalTime: ocrResults.totalTime || 0
                },
                results: (ocrResults.texts || []).map((item, index) => ({
                    id: index + 1,
                    text: item.text || '',
                    confidence: item.confidence || 0,
                    boundingBox: {
                        x1: item.box?.[0] || 0,
                        y1: item.box?.[1] || 0,
                        x2: item.box?.[2] || 0,
                        y2: item.box?.[3] || 0,
                        width: item.box ? Math.abs(item.box[2] - item.box[0]) : 0,
                        height: item.box ? Math.abs(item.box[3] - item.box[1]) : 0
                    },
                    statistics: {
                        characterCount: (item.text || '').length,
                        wordCount: (item.text || '').split(/\s+/).filter(w => w).length
                    }
                })),
                summary: {
                    totalCharacters: (ocrResults.texts || []).reduce((sum, item) => sum + (item.text?.length || 0), 0),
                    totalWords: (ocrResults.texts || []).reduce((sum, item) => {
                        return sum + (item.text || '').split(/\s+/).filter(w => w).length;
                    }, 0),
                    averageConfidence: ocrResults.texts?.length > 0 ? 
                        (ocrResults.texts.reduce((sum, item) => sum + (item.confidence || 0), 0) / ocrResults.texts.length).toFixed(3) : 0,
                    allText: (ocrResults.texts || [])
                        .filter(item => item.text && item.text.trim())
                        .map(item => item.text.trim())
                        .join('\n')
                }
            };
            
            const jsonString = JSON.stringify(jsonData, null, 2);
            const filename = `ocr_result_${this.getTimestamp()}.json`;
            this.downloadFile(jsonString, filename, 'application/json');
            
            return { success: true, filename, content: jsonData };
            
        } catch (error) {
            throw new Error(`JSON导出失败: ${error.message}`);
        }
    }

    /**
     * 导出CSV格式
     */
    exportCSV(ocrResults) {
        try {
            const headers = ['序号', '文本内容', '置信度', 'X1', 'Y1', 'X2', 'Y2', '宽度', '高度', '字符数'];
            let csvContent = headers.join(',') + '\n';
            
            if (ocrResults.texts && ocrResults.texts.length > 0) {
                ocrResults.texts.forEach((item, index) => {
                    const row = [
                        index + 1,
                        `"${(item.text || '').replace(/"/g, '""')}"`, // 转义引号
                        item.confidence ? (item.confidence * 100).toFixed(2) + '%' : '',
                        item.box?.[0]?.toFixed(2) || '',
                        item.box?.[1]?.toFixed(2) || '',
                        item.box?.[2]?.toFixed(2) || '',
                        item.box?.[3]?.toFixed(2) || '',
                        item.box ? Math.abs(item.box[2] - item.box[0]).toFixed(2) : '',
                        item.box ? Math.abs(item.box[3] - item.box[1]).toFixed(2) : '',
                        (item.text || '').length
                    ];
                    csvContent += row.join(',') + '\n';
                });
            }
            
            // 添加统计信息
            csvContent += '\n统计信息\n';
            csvContent += `总区域数,${ocrResults.texts?.length || 0}\n`;
            csvContent += `总字符数,${(ocrResults.texts || []).reduce((sum, item) => sum + (item.text?.length || 0), 0)}\n`;
            csvContent += `处理时间,${ocrResults.totalTime?.toFixed(2)}ms\n`;
            csvContent += `导出时间,${new Date().toLocaleString()}\n`;
            
            const filename = `ocr_result_${this.getTimestamp()}.csv`;
            this.downloadFile(csvContent, filename, 'text/csv');
            
            return { success: true, filename, content: csvContent };
            
        } catch (error) {
            throw new Error(`CSV导出失败: ${error.message}`);
        }
    }

    /**
     * 导出XML格式
     */
    exportXML(ocrResults) {
        try {
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += '<ocrResults>\n';
            
            // 添加元数据
            xmlContent += '  <metadata>\n';
            xmlContent += `    <exportTime>${new Date().toISOString()}</exportTime>\n`;
            xmlContent += `    <totalTexts>${ocrResults.texts?.length || 0}</totalTexts>\n`;
            xmlContent += `    <processingTime>${ocrResults.totalTime || 0}</processingTime>\n`;
            xmlContent += `    <modelType>${ocrResults.modelType || 'unknown'}</modelType>\n`;
            xmlContent += '  </metadata>\n';
            
            // 添加图像信息
            if (ocrResults.imageSize) {
                xmlContent += '  <imageInfo>\n';
                xmlContent += `    <width>${ocrResults.imageSize.width}</width>\n`;
                xmlContent += `    <height>${ocrResults.imageSize.height}</height>\n`;
                xmlContent += '  </imageInfo>\n';
            }
            
            // 添加识别结果
            xmlContent += '  <texts>\n';
            if (ocrResults.texts && ocrResults.texts.length > 0) {
                ocrResults.texts.forEach((item, index) => {
                    xmlContent += `    <text id="${index + 1}">\n`;
                    xmlContent += `      <content><![CDATA[${item.text || ''}]]></content>\n`;
                    xmlContent += `      <confidence>${item.confidence || 0}</confidence>\n`;
                    if (item.box) {
                        xmlContent += '      <boundingBox>\n';
                        xmlContent += `        <x1>${item.box[0]}</x1>\n`;
                        xmlContent += `        <y1>${item.box[1]}</y1>\n`;
                        xmlContent += `        <x2>${item.box[2]}</x2>\n`;
                        xmlContent += `        <y2>${item.box[3]}</y2>\n`;
                        xmlContent += '      </boundingBox>\n';
                    }
                    xmlContent += '    </text>\n';
                });
            }
            xmlContent += '  </texts>\n';
            xmlContent += '</ocrResults>\n';
            
            const filename = `ocr_result_${this.getTimestamp()}.xml`;
            this.downloadFile(xmlContent, filename, 'application/xml');
            
            return { success: true, filename, content: xmlContent };
            
        } catch (error) {
            throw new Error(`XML导出失败: ${error.message}`);
        }
    }

    /**
     * 导出标注图像
     */
    async exportImage(ocrResults, imageElement) {
        try {
            if (!imageElement) {
                throw new Error('缺少原始图像');
            }
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            
            // 绘制原始图像
            ctx.drawImage(imageElement, 0, 0);
            
            // 绘制识别结果标注
            if (ocrResults.texts && ocrResults.texts.length > 0) {
                this.drawAnnotations(ctx, ocrResults.texts);
            }
            
            // 添加标题和信息
            this.addImageHeader(ctx, ocrResults);
            
            // 转换为Blob并下载
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    const filename = `ocr_annotated_${this.getTimestamp()}.png`;
                    const url = URL.createObjectURL(blob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.click();
                    
                    URL.revokeObjectURL(url);
                    
                    resolve({ success: true, filename, blob });
                }, 'image/png');
            });
            
        } catch (error) {
            throw new Error(`图像导出失败: ${error.message}`);
        }
    }

    /**
     * 绘制标注
     */
    drawAnnotations(ctx, texts) {
        ctx.font = '14px Arial';
        ctx.lineWidth = 2;
        
        texts.forEach((item, index) => {
            if (!item.box) return;
            
            const [x1, y1, x2, y2] = item.box;
            const color = this.getAnnotationColor(index);
            
            // 绘制边界框
            ctx.strokeStyle = color;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            
            // 绘制序号标签
            const labelText = `${index + 1}`;
            const textMetrics = ctx.measureText(labelText);
            const labelWidth = textMetrics.width + 8;
            const labelHeight = 20;
            
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1 - labelHeight, labelWidth, labelHeight);
            
            ctx.fillStyle = 'white';
            ctx.fillText(labelText, x1 + 4, y1 - 6);
            
            // 绘制置信度（可选）
            if (item.confidence) {
                const confidenceText = `${(item.confidence * 100).toFixed(1)}%`;
                ctx.fillStyle = color;
                ctx.fillText(confidenceText, x2 - 40, y2 + 15);
            }
        });
    }

    /**
     * 添加图像标题信息
     */
    addImageHeader(ctx, ocrResults) {
        const headerHeight = 30;
        const headerY = 10;
        
        // 绘制半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, ctx.canvas.width, headerHeight);
        
        // 绘制标题文字
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(
            `OCR识别结果 - ${ocrResults.texts?.length || 0}个区域 - ${new Date().toLocaleString()}`,
            10,
            headerY + 18
        );
    }

    /**
     * 获取标注颜色
     */
    getAnnotationColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8E8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[index % colors.length];
    }

    /**
     * 生成报告
     */
    generateReport(ocrResults) {
        try {
            const report = {
                summary: {
                    totalRegions: ocrResults.texts?.length || 0,
                    totalCharacters: (ocrResults.texts || []).reduce((sum, item) => sum + (item.text?.length || 0), 0),
                    averageConfidence: this.calculateAverageConfidence(ocrResults.texts),
                    processingTime: ocrResults.totalTime || 0
                },
                quality: {
                    highConfidence: (ocrResults.texts || []).filter(item => (item.confidence || 0) > 0.8).length,
                    mediumConfidence: (ocrResults.texts || []).filter(item => (item.confidence || 0) > 0.5 && (item.confidence || 0) <= 0.8).length,
                    lowConfidence: (ocrResults.texts || []).filter(item => (item.confidence || 0) <= 0.5).length
                },
                distribution: this.analyzeTextDistribution(ocrResults.texts),
                recommendations: this.generateRecommendations(ocrResults)
            };
            
            return report;
            
        } catch (error) {
            throw new Error(`报告生成失败: ${error.message}`);
        }
    }

    /**
     * 计算平均置信度
     */
    calculateAverageConfidence(texts) {
        if (!texts || texts.length === 0) return 0;
        
        const total = texts.reduce((sum, item) => sum + (item.confidence || 0), 0);
        return (total / texts.length * 100).toFixed(2);
    }

    /**
     * 分析文本分布
     */
    analyzeTextDistribution(texts) {
        if (!texts || texts.length === 0) return {};
        
        const distribution = {
            byLength: {
                short: texts.filter(item => (item.text?.length || 0) <= 5).length,
                medium: texts.filter(item => (item.text?.length || 0) > 5 && (item.text?.length || 0) <= 20).length,
                long: texts.filter(item => (item.text?.length || 0) > 20).length
            },
            byType: {
                numeric: texts.filter(item => /^\d+$/.test(item.text || '')).length,
                alphabetic: texts.filter(item => /^[a-zA-Z]+$/.test(item.text || '')).length,
                chinese: texts.filter(item => /[\u4e00-\u9fa5]/.test(item.text || '')).length,
                mixed: texts.filter(item => {
                    const text = item.text || '';
                    return !/^\d+$/.test(text) && !/^[a-zA-Z]+$/.test(text) && !/^[\u4e00-\u9fa5]+$/.test(text) && text.length > 0;
                }).length
            }
        };
        
        return distribution;
    }

    /**
     * 生成建议
     */
    generateRecommendations(ocrResults) {
        const recommendations = [];
        
        if (!ocrResults.texts || ocrResults.texts.length === 0) {
            recommendations.push('未检测到文字，建议检查图像质量或调整检测阈值');
            return recommendations;
        }
        
        const avgConfidence = this.calculateAverageConfidence(ocrResults.texts);
        
        if (avgConfidence < 50) {
            recommendations.push('整体识别置信度较低，建议提高图像分辨率或对比度');
        } else if (avgConfidence < 70) {
            recommendations.push('识别效果一般，可以尝试调整预处理参数');
        } else {
            recommendations.push('识别效果良好');
        }
        
        const lowConfidenceCount = (ocrResults.texts || []).filter(item => (item.confidence || 0) < 0.5).length;
        if (lowConfidenceCount > 0) {
            recommendations.push(`有${lowConfidenceCount}个区域置信度较低，建议人工校验`);
        }
        
        if (ocrResults.totalTime > 5000) {
            recommendations.push('处理时间较长，建议优化图像尺寸或使用更快的模型');
        }
        
        return recommendations;
    }

    /**
     * 下载文件
     */
    downloadFile(content, filename, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            console.log(`文件下载成功: ${filename}`);
            
        } catch (error) {
            throw new Error(`文件下载失败: ${error.message}`);
        }
    }

    /**
     * 获取时间戳字符串
     */
    getTimestamp() {
        const now = new Date();
        return now.getFullYear() +
               String(now.getMonth() + 1).padStart(2, '0') +
               String(now.getDate()).padStart(2, '0') + '_' +
               String(now.getHours()).padStart(2, '0') +
               String(now.getMinutes()).padStart(2, '0') +
               String(now.getSeconds()).padStart(2, '0');
    }

    /**
     * 批量导出
     */
    async batchExport(formats, ocrResults, imageElement) {
        const results = [];
        
        for (const format of formats) {
            try {
                const result = await this.export(format, ocrResults, imageElement);
                results.push({ format, success: true, result });
            } catch (error) {
                results.push({ format, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * 获取支持的格式列表
     */
    getSupportedFormats() {
        return [...this.supportedFormats];
    }
}

// 导出类
window.ResultExporter = ResultExporter; 