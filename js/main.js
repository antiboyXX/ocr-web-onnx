// 全局变量
let currentResults = null;
let isProcessing = false;

// DOM元素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const progressBar = document.querySelector('.progress');
const statusText = document.getElementById('statusText');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 OCR Web应用初始化完成');
    
    // 调试：检查DOM元素是否存在
    console.log('🔍 检查DOM元素:');
    console.log('dropZone:', document.getElementById('dropZone'));
    console.log('fileInput:', document.getElementById('fileInput'));
    console.log('uploadBtn:', document.getElementById('uploadBtn'));
    console.log('uploadSection:', document.getElementById('uploadSection'));
    console.log('processingSection:', document.getElementById('processingSection'));
    console.log('resultsSection:', document.getElementById('resultsSection'));
    
    initializeEventListeners();
});

function initializeEventListeners() {
    console.log('📋 初始化事件监听器...');
    
    // 检查元素是否存在
    if (!dropZone) {
        console.error('❌ dropZone元素未找到');
        return;
    }
    if (!fileInput) {
        console.error('❌ fileInput元素未找到');
        return;
    }
    if (!uploadBtn) {
        console.error('❌ uploadBtn元素未找到');
        return;
    }
    
    // 文件拖放
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    console.log('✅ 拖放事件监听器已添加');
    
    // 文件选择
    uploadBtn.addEventListener('click', () => {
        console.log('🖱️ 上传按钮被点击');
        console.log('🖱️ fileInput元素:', fileInput);
        console.log('🖱️ 准备触发文件选择对话框...');
        fileInput.click();
        console.log('🖱️ fileInput.click()已执行');
    });
    
    fileInput.addEventListener('change', (e) => {
        console.log('📁 文件选择改变事件触发！！！', e.target.files);
        handleFileSelect(e);
    });
    
    // 添加额外的事件监听来调试
    fileInput.addEventListener('input', (e) => {
        console.log('📁 input事件触发:', e.target.files);
    });
    
    console.log('✅ 文件选择事件监听器已添加，fileInput元素:', fileInput);
    
    // 点击上传区域选择文件
    dropZone.addEventListener('click', () => {
        console.log('🖱️ 上传区域被点击');
        fileInput.click();
    });
    console.log('✅ 上传区域点击事件监听器已添加');
    

    
    console.log('🎉 所有事件监听器初始化完成');
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    console.log('📁 handleFileSelect被调用，事件:', e);
    console.log('📁 files对象:', e.target.files);
    console.log('📁 文件数量:', e.target.files.length);
    
    const files = e.target.files;
    if (files.length > 0) {
        console.log('📁 找到文件，准备处理第一个文件:', files[0]);
        handleFile(files[0]);
    } else {
        console.log('⚠️ 没有选择任何文件');
    }
}

function handleFile(file) {
    console.log('🔥 handleFile被调用，文件:', file);
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        console.error('❌ 文件类型错误:', file.type);
        showError('请选择有效的图片文件！');
        return;
    }
    
    // 验证文件大小 (10MB限制)
    if (file.size > 10 * 1024 * 1024) {
        console.error('❌ 文件太大:', file.size);
        showError('文件大小不能超过10MB！');
        return;
    }
    
    console.log('📁 选择文件:', file.name, '大小:', file.size, '类型:', file.type);
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('🖼️ 图片读取完成，开始显示预览');
        showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // 开始处理
    console.log('🚀 开始处理图片...');
    processImage(file);
}

function showImagePreview(imageSrc) {
    // 在上传区域显示缩略图
    const preview = document.createElement('img');
    preview.src = imageSrc;
    preview.style.maxWidth = '200px';
    preview.style.maxHeight = '200px';
    preview.style.objectFit = 'contain';
    preview.style.marginTop = '10px';
    
    // 清除之前的预览
    const existingPreview = dropZone.querySelector('img');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    dropZone.appendChild(preview);
}

async function processImage(file) {
    if (isProcessing) return;
    
    isProcessing = true;
    currentResults = null;
    
    // 切换到处理界面
    showProcessingSection();
    
    try {
        // 创建FormData
        const formData = new FormData();
        formData.append('image', file);
        
        console.log('📤 上传图片到服务器...');
        updateProgress(10, '上传图片中...');
        
        // 发送请求到Flask后端
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        updateProgress(30, '服务器处理中...');
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '处理失败');
        }
        
        console.log('✅ OCR处理完成:', result);
        
        updateProgress(90, '准备显示结果...');
        
        // 保存结果
        currentResults = result;
        
        // 显示结果
        setTimeout(() => {
            updateProgress(100, '处理完成！');
            showResults(result);
        }, 500);
        
    } catch (error) {
        console.error('❌ 处理失败:', error);
        showError(`处理失败: ${error.message}`);
        showUploadSection();
    } finally {
        isProcessing = false;
    }
}

function showProcessingSection() {
    uploadSection.style.display = 'none';
    processingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    // 重置进度
    updateProgress(0, '准备处理...');
}

function showUploadSection() {
    uploadSection.style.display = 'block';
    processingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    // 清除预览
    const preview = dropZone.querySelector('img');
    if (preview) preview.remove();
}

function updateProgress(percent, message) {
    progressBar.style.width = `${percent}%`;
    statusText.textContent = message;
}

function showResults(data) {
    processingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // 显示统计信息
    updateResultsStats(data);
    
    // 显示识别文字
    displayRecognizedTexts(data.texts);
    
    // 显示可视化结果
    displayVisualization(data);
    
    // 显示图文分离结果
    displayTextSeparation(data);
    
    // 显示图像修复结果
    displayImageInpainting(data);
    
    // 设置下载功能
    setupDownloadFeatures(data);
    
    // 添加重新处理按钮
    addRetryButton();
}

function updateResultsStats(data) {
    const statsDiv = document.getElementById('resultsStats') || createStatsDiv();
    
    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-number">${data.text_count}</div>
                <div class="stat-label">检测到的文字区域</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${data.texts.length}</div>
                <div class="stat-label">识别出的文字</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">3</div>
                <div class="stat-label">修复算法</div>
            </div>
        </div>
    `;
}

function createStatsDiv() {
    const statsDiv = document.createElement('div');
    statsDiv.id = 'resultsStats';
    statsDiv.className = 'results-stats';
    resultsSection.insertBefore(statsDiv, resultsSection.firstChild);
    return statsDiv;
}

function displayRecognizedTexts(texts) {
    const textList = document.getElementById('textList') || createTextListDiv();
    
    textList.innerHTML = `
        <h3>📝 识别文字</h3>
        <div class="text-items">
            ${texts.map(item => `
                <div class="text-item" data-id="${item.id}">
                    <div class="text-number">${item.id}</div>
                    <div class="text-content">${item.text}</div>
                    <div class="text-confidence">置信度: ${(item.confidence * 100).toFixed(1)}%</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // 添加点击高亮功能
    textList.querySelectorAll('.text-item').forEach(item => {
        item.addEventListener('click', () => {
            // 移除其他高亮
            textList.querySelectorAll('.text-item').forEach(t => t.classList.remove('highlighted'));
            // 添加当前高亮
            item.classList.add('highlighted');
        });
    });
}

function createTextListDiv() {
    const textList = document.createElement('div');
    textList.id = 'textList';
    textList.className = 'text-list-section';
    resultsSection.appendChild(textList);
    return textList;
}

function displayVisualization(data) {
    const visualizationDiv = document.getElementById('visualization') || createVisualizationDiv();
    
    visualizationDiv.innerHTML = `
        <h3>📊 OCR可视化结果</h3>
        <div class="image-container">
            <img src="${data.files.visualization_url}" alt="OCR可视化" class="result-image" />
            <div class="image-caption">检测框和识别结果标注</div>
        </div>
    `;
}

function createVisualizationDiv() {
    const visualizationDiv = document.createElement('div');
    visualizationDiv.id = 'visualization';
    visualizationDiv.className = 'visualization-section';
    resultsSection.appendChild(visualizationDiv);
    return visualizationDiv;
}

function displayTextSeparation(data) {
    const separationDiv = document.getElementById('textSeparation') || createTextSeparationDiv();
    
    if (!data.files.text_region_urls || data.files.text_region_urls.length === 0) {
        separationDiv.innerHTML = '<p>没有分离出的文字区域</p>';
        return;
    }
    
    separationDiv.innerHTML = `
        <h3>✂️ 图文分离结果</h3>
        <div class="text-regions-grid">
            ${data.files.text_region_urls.map(region => `
                <div class="text-region-item">
                    <img src="${region.url}" alt="文字区域 ${region.id}" />
                    <div class="region-info">
                        <span class="region-id">#${region.id}</span>
                        <span class="region-text">${region.text}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function createTextSeparationDiv() {
    const separationDiv = document.createElement('div');
    separationDiv.id = 'textSeparation';
    separationDiv.className = 'text-separation-section';
    resultsSection.appendChild(separationDiv);
    return separationDiv;
}

function displayImageInpainting(data) {
    const inpaintingDiv = document.getElementById('imageInpainting') || createImageInpaintingDiv();
    
    const methods = [
        { key: 'mixed', name: '混合修复', desc: '最佳效果' },
        { key: 'ns', name: 'Navier-Stokes', desc: '基于流体力学' },
        { key: 'telea', name: 'Telea算法', desc: '快速修复' }
    ];
    
    inpaintingDiv.innerHTML = `
        <h3>🎨 图像修复结果</h3>
        <div class="inpainting-comparison">
            <div class="comparison-item">
                <img src="${data.files.original_url}" alt="原始图像" />
                <div class="comparison-label">原始图像</div>
            </div>
            <div class="comparison-item">
                <img src="${data.files.mask_url}" alt="文字掩码" />
                <div class="comparison-label">文字掩码</div>
            </div>
        </div>
        
        <div class="inpainting-methods">
            ${methods.map(method => `
                <div class="method-item">
                    <img src="${data.files.repaired_urls[method.key]}" alt="${method.name}" />
                    <div class="method-info">
                        <div class="method-name">${method.name}</div>
                        <div class="method-desc">${method.desc}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="summary-section">
            <h4>📋 处理概览</h4>
            <img src="${data.files.summary_url}" alt="处理概览" class="summary-image" />
        </div>
    `;
}

function createImageInpaintingDiv() {
    const inpaintingDiv = document.createElement('div');
    inpaintingDiv.id = 'imageInpainting';
    inpaintingDiv.className = 'image-inpainting-section';
    resultsSection.appendChild(inpaintingDiv);
    return inpaintingDiv;
}

function setupDownloadFeatures(data) {
    // 创建下载按钮容器
    let downloadDiv = document.getElementById('downloadSection');
    if (!downloadDiv) {
        downloadDiv = document.createElement('div');
        downloadDiv.id = 'downloadSection';
        downloadDiv.className = 'download-section';
        resultsSection.appendChild(downloadDiv);
    }
    
    downloadDiv.innerHTML = `
        <h3>📥 下载结果</h3>
        <div class="download-options">
            <button class="download-btn primary" onclick="downloadAllResults()">
                <i class="icon">📦</i>
                下载全部结果 (ZIP)
            </button>
            <button class="download-btn" onclick="downloadTextInfo()">
                <i class="icon">📝</i>
                下载文字信息
            </button>
            <button class="download-btn" onclick="exportToJSON()">
                <i class="icon">🔗</i>
                导出JSON
            </button>
        </div>
        
        <div class="individual-downloads">
            <h4>单独下载</h4>
            <div class="download-grid">
                <a href="${data.files.visualization_url}" download class="download-link">
                    📊 可视化结果
                </a>
                <a href="${data.files.original_url}" download class="download-link">
                    📷 原始图像
                </a>
                <a href="${data.files.mask_url}" download class="download-link">
                    🎭 文字掩码
                </a>
                <a href="${data.files.summary_url}" download class="download-link">
                    📋 处理概览
                </a>
                <a href="${data.files.info_url || '#'}" download class="download-link">
                    📝 文字信息
                </a>
                ${Object.entries(data.files.repaired_urls).map(([method, url]) => `
                    <a href="${url}" download class="download-link">
                        🎨 修复图像 (${method})
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}

// 下载功能
window.downloadAllResults = function() {
    if (!currentResults) return;
    
    console.log('📦 开始下载全部结果:', currentResults.output_dir);
    
    // 处理输出目录路径，确保使用正确的分隔符
    let outputDir = currentResults.output_dir;
    if (outputDir.includes('\\')) {
        // Windows路径，转换为URL路径
        outputDir = outputDir.replace(/\\/g, '/');
    }
    
    // 移除可能的绝对路径前缀，只保留相对路径
    if (outputDir.includes('results/')) {
        outputDir = outputDir.substring(outputDir.indexOf('results/'));
    }
    
    const downloadUrl = `/api/download/${outputDir}`;
    console.log('📦 下载URL:', downloadUrl);
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `ocr_results_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('正在准备下载包，请稍候...');
};

window.downloadTextInfo = function() {
    if (!currentResults) return;
    
    console.log('📝 开始下载文字信息');
    console.log('📝 files对象:', currentResults.files);
    
    const link = document.createElement('a');
    
    // 优先使用info_url，如果没有则使用info路径
    if (currentResults.files.info_url) {
        link.href = currentResults.files.info_url;
        console.log('📝 使用info_url:', currentResults.files.info_url);
    } else if (currentResults.files.info) {
        // 备用方案：直接处理info路径
        const infoPath = currentResults.files.info.replace(/\\/g, '/');
        link.href = `/api/file/${infoPath}`;
        console.log('📝 使用info路径:', `/api/file/${infoPath}`);
    } else {
        showError('文字信息文件路径不存在');
        return;
    }
    
    link.download = 'ocr_text_info.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('开始下载文字信息文件...');
};

window.exportToJSON = function() {
    if (!currentResults) return;
    
    const exportData = {
        timestamp: new Date().toISOString(),
        text_count: currentResults.text_count,
        texts: currentResults.texts,
        processing_info: {
            engine: 'EasyOCR',
            language: ['ch_sim', 'en'],
            confidence_threshold: 0.3
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
    });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ocr_result_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('JSON文件已导出！');
};

// 重新处理按钮
function addRetryButton() {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.innerHTML = '🔄 重新处理';
    retryBtn.onclick = () => {
        showUploadSection();
        currentResults = null;
    };
    
    resultsSection.appendChild(retryBtn);
}

// 工具函数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">❌</span>
            <span class="error-text">${message}</span>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-text">${message}</span>
        </div>
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

console.log('🎯 Web OCR应用已加载，支持真实的图文分离功能！'); 