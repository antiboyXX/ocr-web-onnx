/**
 * ONNX Handler - ONNX模型加载和推理处理器
 * 负责模型加载、推理执行和结果后处理
 */

class ONNXHandler {
    constructor() {
        this.session = null;
        this.modelLoaded = false;
        this.currentModel = null;
        this.executionProvider = 'webgl';
        
        // 模型配置
        this.modelConfigs = {
            'paddle-v4': {
                detectionModel: './models/ch_PP-OCRv4_det_infer.onnx',
                recognitionModel: './models/ch_PP-OCRv4_rec_infer.onnx',
                inputSize: { det: [640, 640], rec: [48, 320] },
                supportedLanguages: ['ch_sim', 'ch_tra', 'en', 'ch_en']
            },
            'paddle-v3': {
                detectionModel: './models/ch_PP-OCRv3_det_infer.onnx',
                recognitionModel: './models/ch_PP-OCRv3_rec_infer.onnx',
                inputSize: { det: [640, 640], rec: [48, 320] },
                supportedLanguages: ['ch_sim', 'ch_tra', 'en']
            },
            'easyocr': {
                detectionModel: './models/craft_mlt_25k.onnx',
                recognitionModel: './models/crnn_vgg_bn.onnx',
                inputSize: { det: [640, 640], rec: [32, 128] },
                supportedLanguages: ['ch_sim', 'en', 'multi']
            }
        };
        
        // 字符字典
        this.charDictionaries = {};
        
        // 模型会话
        this.detectionSession = null;
        this.recognitionSession = null;
    }

    /**
     * 初始化ONNX环境
     */
    async initialize() {
        try {
            console.log('正在初始化ONNX环境...');
            
            // 演示模式：跳过真实的ONNX.js检查
            console.log('⚠️ 演示模式：使用模拟OCR引擎');
            
            // 设置执行提供程序
            await this.setExecutionProvider(this.executionProvider);
            
            // 预加载字符字典
            await this.loadCharacterDictionaries();
            
            console.log('ONNX环境初始化完成');
            
        } catch (error) {
            console.error('ONNX环境初始化失败:', error);
            throw new Error(`ONNX初始化失败: ${error.message}`);
        }
    }

    /**
     * 设置执行提供程序
     */
    async setExecutionProvider(provider) {
        try {
            this.executionProvider = provider;
            
            // 配置ONNX执行选项
            const executionProviders = [];
            
            if (provider === 'webgl') {
                executionProviders.push('webgl');
                executionProviders.push('cpu'); // 备用
            } else if (provider === 'wasm') {
                executionProviders.push('wasm');
                executionProviders.push('cpu');
            } else {
                executionProviders.push('cpu');
            }
            
            // 设置全局配置
            ort.env.wasm.wasmPaths = './libs/onnx/';
            ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
            
            console.log(`执行提供程序设置为: ${executionProviders.join(', ')}`);
            
        } catch (error) {
            console.error('执行提供程序设置失败:', error);
            throw error;
        }
    }

    /**
     * 加载字符字典
     */
    async loadCharacterDictionaries() {
        const dictionaries = {
            'ch_sim': './models/ppocr_keys_v1.txt',
            'ch_tra': './models/ppocr_keys_traditional.txt',
            'en': './models/ic15_dict.txt',
            'multi': './models/multi_lang_dict.txt'
        };

        for (const [lang, path] of Object.entries(dictionaries)) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const text = await response.text();
                    this.charDictionaries[lang] = text.split('\n').filter(line => line.trim());
                } else {
                    // 使用默认字符集
                    this.charDictionaries[lang] = this.getDefaultCharSet(lang);
                }
            } catch (error) {
                console.warn(`字典加载失败 ${lang}:`, error);
                this.charDictionaries[lang] = this.getDefaultCharSet(lang);
            }
        }
    }

    /**
     * 获取默认字符集
     */
    getDefaultCharSet(language) {
        const defaultSets = {
            'ch_sim': ['的', '一', '是', '了', '我', '不', '人', '在', '他', '有', '这', '个', '上', '们', '来', '到', '时', '大', '地', '为', '子', '中', '你', '说', '生', '国', '年', '着', '就', '那', '和', '要', '她', '出', '也', '得', '里', '后', '自', '以', '会', '家', '可', '下', '而', '过', '天', '去', '能', '对', '小', '多', '然', '于', '心', '学', '么', '之', '都', '好', '看', '起', '发', '当', '没', '成', '只', '如', '事', '把', '还', '用', '第', '样', '道', '想', '作', '种', '开', '美', '总', '从', '无', '情', '己', '面', '最', '女', '但', '现', '前', '些', '所', '同', '日', '手', '又', '行', '意', '动', '方', '期', '它', '头', '经', '长', '儿', '回', '位', '分', '爱', '老', '因', '很', '给', '名', '法', '间', '斯', '知', '世', '什', '两', '次', '使', '身', '者', '被', '高', '已', '亲', '其', '进', '此', '话', '常', '与', '活', '正', '感', '见', '明', '问', '力', '理', '尔', '点', '文', '几', '定', '本', '公', '特', '做', '外', '孩', '相', '西', '果', '走', '将', '月', '十', '实', '向', '声', '车', '全', '信', '重', '三', '机', '工', '物', '气', '每', '并', '别', '真', '打', '太', '新', '比', '才', '便', '夫', '再', '书', '部', '水', '像', '眼', '等', '体', '却', '加', '电', '主', '界', '门', '利', '海', '受', '听', '表', '德', '少', '克', '代', '员', '许', '稜', '先', '口', '由', '死', '安', '写', '性', '马', '光', '白', '或', '住', '难', '望', '教', '命', '花', '结', '乐', '色', '更', '拉', '东', '神', '记', '处', '让', '母', '父', '应', '直', '字', '场', '平', '报', '友', '关', '放', '至', '张', '认', '接', '告', '入', '笑', '内', '英', '军', '候', '民', '岁', '往', '何', '度', '山', '觉', '路', '带', '万', '男', '边', '风', '解', '叫', '任', '金', '快', '原', '吃', '妈', '变', '通', '师', '立', '象', '数', '四', '失', '满', '战', '远', '格', '士', '音', '轻', '目', '条', '呢', '病', '始', '达', '深', '完', '今', '提', '求', '清', '王', '化', '空', '业', '思', '切', '怎', '非', '找', '片', '罗', '钱', '紶', '吗', '语', '元', '喜', '曾', '离', '飞', '科', '言', '干', '流', '欢', '约', '各', '即', '指', '合', '反', '题', '必', '该', '论', '交', '终', '林', '请', '医', '晚', '制', '球', '决', '窢', '传', '画', '保', '读', '运', '及', '则', '房', '早', '院', '量', '苦', '火', '布', '品', '近', '坐', '产', '答', '星', '精', '视', '五', '连', '司', '巴', '奇', '管', '类', '未', '朋', '且', '婚', '台', '夜', '青', '北', '队', '久', '乎', '越', '观', '落', '尽', '形', '影', '红', '爸', '百', '令', '周', '吧', '识', '步', '希', '亚', '术', '留', '市', '半', '热', '送', '兴', '造', '谈', '容', '极', '随', '演', '收', '首', '根', '讲', '整', '式', '取', '照', '办', '强', '石', '古', '华', '諣', '拿', '计', '您', '装', '似', '足', '双', '妻', '尼', '转', '诉', '米', '称', '丽', '客', '南', '领', '节', '衣', '站', '黑', '刻', '统', '断', '福', '城', '故', '历', '惊', '脸', '选', '包', '紧', '争', '另', '建', '维', '绝', '树', '系', '伤', '示', '愿', '持', '千', '史', '谁', '准', '联', '妇', '纪', '基', '买', '志', '静', '阿', '诗', '独', '复', '痛', '消', '社', '算', '义', '竟', '确', '酒', '需', '单', '治', '卡', '幸', '兰', '念', '举', '仅', '钟', '怕', '共', '毛', '句', '息', '功', '官', '待', '究', '跟', '穿', '室', '易', '游', '程', '号', '居', '考', '突', '皮', '哪', '费', '倒', '价', '图', '具', '刚', '脑', '永', '歌', '响', '商', '礼', '细', '专', '黄', '块', '脚', '味', '灵', '改', '据', '般', '破', '引', '食', '仍', '存', '众', '注', '笔', '甚', '某', '沉', '血', '备', '习', '校', '默', '务', '土', '微', '娘', '须', '试', '怀', '料', '调', '广', '蜖', '苏', '显', '赛', '查', '密', '议', '底', '列', '富', '梦', '错', '座', '参', '八', '除', '跑', '亮', '假', '印', '设', '线', '温', '虽', '掉', '京', '初', '养', '香', '停', '际', '致', '阳', '纸', '李', '纳', '验', '助', '激', '够', '严', '证', '帝', '饭', '忘', '趣', '支', '春', '集', '丈', '木', '研', '班', '普', '导', '顿', '睡', '展', '跳', '获', '艺', '六', '波', '察', '群', '皇', '段', '急', '庭', '创', '区', '奥', '器', '谢', '弟', '店', '否', '害', '草', '排', '背', '止', '组', '州', '朝', '封', '睛', '板', '角', '况', '曲', '馆', '育', '忙', '质', '河', '续', '哥', '呼', '若', '推', '顺', '剧', '江', '哈', '黄', '协', '手', '育', '设', '级', '移', '经', '免', '红', '鲜', '著', '毫', '况', '亮', '迁', '筋'],
            'en': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
            'multi': ['的', 'a', '1', '2', '3', '是', 'b', 'c', '了', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '4', '5', '6', '7', '8', '9', '0']
        };
        
        return defaultSets[language] || defaultSets['en'];
    }

    /**
     * 加载指定模型
     */
    async loadModel(modelType) {
        try {
            console.log(`正在加载模型: ${modelType}`);
            
            const config = this.modelConfigs[modelType];
            if (!config) {
                throw new Error(`不支持的模型类型: ${modelType}`);
            }

            // 演示模式：模拟模型加载
            console.log(`⚠️ 演示模式：模拟加载 ${modelType} 模型`);
            
            // 模拟加载延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            this.detectionSession = { name: `${modelType}-detection-demo` };
            this.recognitionSession = { name: `${modelType}-recognition-demo` };
            this.currentModel = modelType;
            this.modelLoaded = true;

            console.log(`模型 ${modelType} 加载完成（演示模式）`);
            
        } catch (error) {
            console.error('模型加载失败:', error);
            await this.cleanup();
            throw new Error(`模型加载失败: ${error.message}`);
        }
    }

    /**
     * 从URL加载ONNX模型
     */
    async loadModelFromUrl(modelUrl, options) {
        try {
            // 尝试获取模型文件
            const response = await fetch(modelUrl);
            if (!response.ok) {
                throw new Error(`模型文件获取失败: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const session = await ort.InferenceSession.create(arrayBuffer, options);
            
            return session;
            
        } catch (error) {
            console.error(`模型加载失败 ${modelUrl}:`, error);
            
            // 如果是网络错误，提供更友好的错误信息
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('无法获取模型文件，请检查网络连接或模型文件路径');
            }
            
            throw error;
        }
    }

    /**
     * 获取执行提供程序列表
     */
    getExecutionProviders() {
        const providers = [];
        
        if (this.executionProvider === 'webgl') {
            providers.push('webgl');
        } else if (this.executionProvider === 'wasm') {
            providers.push('wasm');
        }
        
        providers.push('cpu'); // 总是包含CPU作为备用
        
        return providers;
    }

    /**
     * 执行OCR识别
     */
    async runOCR(imageElement, config) {
        if (!this.modelLoaded || !this.detectionSession || !this.recognitionSession) {
            throw new Error('模型未加载，请先加载模型');
        }

        try {
            const startTime = performance.now();
            
            console.log('⚠️ 演示模式：生成模拟OCR结果');
            
            // 模拟处理延迟
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 生成模拟识别结果
            const mockResults = this.generateMockOCRResults(imageElement, config);
            
            const totalTime = performance.now() - startTime;
            
            return {
                texts: mockResults.texts,
                detectionTime: 300,
                recognitionTime: 500,
                totalTime: totalTime,
                modelType: this.currentModel,
                imageSize: {
                    width: imageElement.width,
                    height: imageElement.height
                }
            };
            
        } catch (error) {
            console.error('OCR执行失败:', error);
            throw new Error(`OCR识别失败: ${error.message}`);
        }
    }

    /**
     * 执行文字检测
     */
    async runDetection(imageElement, config) {
        try {
            const startTime = performance.now();
            
            // 获取模型配置
            const modelConfig = this.modelConfigs[this.currentModel];
            const inputSize = modelConfig.inputSize.det;
            
            // 预处理图像
            const inputTensor = await this.preprocessImageForDetection(imageElement, inputSize);
            
            // 执行推理
            const feeds = { [this.detectionSession.inputNames[0]]: inputTensor };
            const results = await this.detectionSession.run(feeds);
            
            // 后处理检测结果
            const detectionBoxes = this.postprocessDetection(
                results, 
                imageElement.width, 
                imageElement.height, 
                inputSize,
                config.detThreshold
            );
            
            const processTime = performance.now() - startTime;
            
            return {
                boxes: detectionBoxes,
                processTime: processTime
            };
            
        } catch (error) {
            console.error('文字检测失败:', error);
            throw new Error(`文字检测失败: ${error.message}`);
        }
    }

    /**
     * 执行文字识别
     */
    async runRecognition(imageElement, detectionResults, config) {
        try {
            const startTime = performance.now();
            const results = [];
            
            if (!detectionResults.boxes || detectionResults.boxes.length === 0) {
                return {
                    texts: [],
                    processTime: performance.now() - startTime
                };
            }
            
            // 获取字符字典
            const charDict = this.charDictionaries[config.language] || this.charDictionaries['ch_sim'];
            
            // 批量处理文字区域
            const batchSize = 8; // 批处理大小
            for (let i = 0; i < detectionResults.boxes.length; i += batchSize) {
                const batch = detectionResults.boxes.slice(i, i + batchSize);
                const batchResults = await this.processBatch(imageElement, batch, config, charDict);
                results.push(...batchResults);
            }
            
            const processTime = performance.now() - startTime;
            
            return {
                texts: results,
                processTime: processTime
            };
            
        } catch (error) {
            console.error('文字识别失败:', error);
            throw new Error(`文字识别失败: ${error.message}`);
        }
    }

    /**
     * 批处理文字识别
     */
    async processBatch(imageElement, boxes, config, charDict) {
        const results = [];
        
        for (const box of boxes) {
            try {
                // 裁剪文字区域
                const croppedImage = await this.cropTextRegion(imageElement, box);
                
                // 预处理识别图像
                const inputTensor = await this.preprocessImageForRecognition(croppedImage, config);
                
                // 执行识别
                const feeds = { [this.recognitionSession.inputNames[0]]: inputTensor };
                const recognitionResult = await this.recognitionSession.run(feeds);
                
                // 解码识别结果
                const text = this.decodeRecognitionResult(recognitionResult, charDict);
                
                if (text && text.trim()) {
                    results.push({
                        text: text.trim(),
                        box: box,
                        confidence: this.calculateConfidence(recognitionResult)
                    });
                }
                
            } catch (error) {
                console.warn('单个文字区域识别失败:', error);
                // 继续处理下一个区域
            }
        }
        
        return results;
    }

    /**
     * 检测图像预处理
     */
    async preprocessImageForDetection(imageElement, inputSize) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = inputSize[0];
        canvas.height = inputSize[1];
        
        // 绘制调整大小的图像
        ctx.drawImage(imageElement, 0, 0, inputSize[0], inputSize[1]);
        
        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, inputSize[0], inputSize[1]);
        const data = imageData.data;
        
        // 转换为张量格式 [1, 3, H, W]
        const tensor = new Float32Array(1 * 3 * inputSize[1] * inputSize[0]);
        
        for (let i = 0; i < inputSize[1] * inputSize[0]; i++) {
            const r = data[i * 4] / 255.0;
            const g = data[i * 4 + 1] / 255.0;
            const b = data[i * 4 + 2] / 255.0;
            
            // 标准化 (ImageNet标准)
            tensor[i] = (r - 0.485) / 0.229;
            tensor[inputSize[1] * inputSize[0] + i] = (g - 0.456) / 0.224;
            tensor[2 * inputSize[1] * inputSize[0] + i] = (b - 0.406) / 0.225;
        }
        
        return new ort.Tensor('float32', tensor, [1, 3, inputSize[1], inputSize[0]]);
    }

    /**
     * 检测结果后处理
     */
    postprocessDetection(results, originalWidth, originalHeight, inputSize, threshold) {
        try {
            // 获取检测输出
            const outputNames = Object.keys(results);
            const detection = results[outputNames[0]];
            
            if (!detection || !detection.data) {
                return [];
            }
            
            const boxes = [];
            const scaleX = originalWidth / inputSize[0];
            const scaleY = originalHeight / inputSize[1];
            
            // 解析检测结果 (这里需要根据具体模型输出格式调整)
            const data = detection.data;
            const dims = detection.dims;
            
            // 假设输出格式为 [N, 4] 或 [N, 5] (带置信度)
            if (dims.length >= 2) {
                const numBoxes = dims[0];
                const boxDim = dims[1];
                
                for (let i = 0; i < numBoxes; i++) {
                    const offset = i * boxDim;
                    
                    let confidence = 1.0;
                    let x1, y1, x2, y2;
                    
                    if (boxDim >= 5) {
                        // 包含置信度
                        confidence = data[offset + 4];
                        if (confidence < threshold) continue;
                        
                        x1 = data[offset] * scaleX;
                        y1 = data[offset + 1] * scaleY;
                        x2 = data[offset + 2] * scaleX;
                        y2 = data[offset + 3] * scaleY;
                    } else if (boxDim >= 4) {
                        // 只有坐标
                        x1 = data[offset] * scaleX;
                        y1 = data[offset + 1] * scaleY;
                        x2 = data[offset + 2] * scaleX;
                        y2 = data[offset + 3] * scaleY;
                    } else {
                        continue;
                    }
                    
                    // 验证边界框
                    if (x2 > x1 && y2 > y1 && 
                        x1 >= 0 && y1 >= 0 && 
                        x2 <= originalWidth && y2 <= originalHeight) {
                        
                        boxes.push([x1, y1, x2, y2, confidence]);
                    }
                }
            }
            
            return boxes;
            
        } catch (error) {
            console.error('检测后处理失败:', error);
            return [];
        }
    }

    /**
     * 裁剪文字区域
     */
    async cropTextRegion(imageElement, box) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const [x1, y1, x2, y2] = box;
        const width = x2 - x1;
        const height = y2 - y1;
        
        canvas.width = width;
        canvas.height = height;
        
        // 裁剪图像区域
        ctx.drawImage(
            imageElement,
            x1, y1, width, height,
            0, 0, width, height
        );
        
        return canvas;
    }

    /**
     * 识别图像预处理
     */
    async preprocessImageForRecognition(canvas, config) {
        const modelConfig = this.modelConfigs[this.currentModel];
        const inputSize = modelConfig.inputSize.rec;
        
        // 创建调整大小的canvas
        const resizedCanvas = document.createElement('canvas');
        const ctx = resizedCanvas.getContext('2d');
        
        resizedCanvas.width = inputSize[1]; // 宽度
        resizedCanvas.height = inputSize[0]; // 高度
        
        // 保持宽高比调整
        const scale = Math.min(
            inputSize[1] / canvas.width,
            inputSize[0] / canvas.height
        );
        
        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;
        const offsetX = (inputSize[1] - scaledWidth) / 2;
        const offsetY = (inputSize[0] - scaledHeight) / 2;
        
        // 填充白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, inputSize[1], inputSize[0]);
        
        // 绘制缩放后的图像
        ctx.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight);
        
        // 转换为张量
        const imageData = ctx.getImageData(0, 0, inputSize[1], inputSize[0]);
        const data = imageData.data;
        
        const tensor = new Float32Array(1 * 1 * inputSize[0] * inputSize[1]);
        
        // 转换为灰度并标准化
        for (let i = 0; i < inputSize[0] * inputSize[1]; i++) {
            const gray = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
            tensor[i] = gray / 255.0;
        }
        
        return new ort.Tensor('float32', tensor, [1, 1, inputSize[0], inputSize[1]]);
    }

    /**
     * 解码识别结果
     */
    decodeRecognitionResult(result, charDict) {
        try {
            const outputNames = Object.keys(result);
            const output = result[outputNames[0]];
            
            if (!output || !output.data) {
                return '';
            }
            
            const data = output.data;
            const dims = output.dims;
            
            let text = '';
            
            // CTC解码
            if (dims.length >= 2) {
                const seqLen = dims[0] || dims[1];
                const vocabSize = dims[dims.length - 1];
                
                let prevChar = '';
                
                for (let i = 0; i < seqLen; i++) {
                    let maxIdx = 0;
                    let maxProb = -Infinity;
                    
                    for (let j = 0; j < vocabSize; j++) {
                        const prob = data[i * vocabSize + j];
                        if (prob > maxProb) {
                            maxProb = prob;
                            maxIdx = j;
                        }
                    }
                    
                    // 跳过空白字符 (索引0通常是空白)
                    if (maxIdx > 0 && maxIdx < charDict.length) {
                        const char = charDict[maxIdx - 1]; // 减1因为0是空白
                        // CTC去重：相邻相同字符只保留一个
                        if (char !== prevChar) {
                            text += char;
                        }
                        prevChar = char;
                    } else {
                        prevChar = '';
                    }
                }
            }
            
            return text;
            
        } catch (error) {
            console.error('识别结果解码失败:', error);
            return '';
        }
    }

    /**
     * 计算识别置信度
     */
    calculateConfidence(result) {
        try {
            const outputNames = Object.keys(result);
            const output = result[outputNames[0]];
            
            if (!output || !output.data) {
                return 0;
            }
            
            const data = output.data;
            const dims = output.dims;
            
            if (dims.length >= 2) {
                const seqLen = dims[0] || dims[1];
                const vocabSize = dims[dims.length - 1];
                
                let totalConfidence = 0;
                let validSteps = 0;
                
                for (let i = 0; i < seqLen; i++) {
                    let maxProb = -Infinity;
                    
                    for (let j = 0; j < vocabSize; j++) {
                        const prob = data[i * vocabSize + j];
                        if (prob > maxProb) {
                            maxProb = prob;
                        }
                    }
                    
                    if (maxProb > -Infinity) {
                        totalConfidence += Math.exp(maxProb); // softmax
                        validSteps++;
                    }
                }
                
                return validSteps > 0 ? totalConfidence / validSteps : 0;
            }
            
            return 0;
            
        } catch (error) {
            console.error('置信度计算失败:', error);
            return 0;
        }
    }

    /**
     * 检查模型是否已加载
     */
    isModelLoaded() {
        return this.modelLoaded && this.detectionSession && this.recognitionSession;
    }

    /**
     * 获取当前模型信息
     */
    getCurrentModelInfo() {
        if (!this.modelLoaded) {
            return null;
        }
        
        return {
            modelType: this.currentModel,
            executionProvider: this.executionProvider,
            supportedLanguages: this.modelConfigs[this.currentModel]?.supportedLanguages || [],
            inputSize: this.modelConfigs[this.currentModel]?.inputSize || {}
        };
    }

    /**
     * 生成模拟OCR结果（演示模式）
     */
    generateMockOCRResults(imageElement, config) {
        const width = imageElement.width;
        const height = imageElement.height;
        
        // 根据图像尺寸生成合理的文字区域
        const mockTexts = [
            {
                text: '欢迎使用OCR Web ONNX',
                box: [width * 0.1, height * 0.1, width * 0.9, height * 0.2],
                confidence: 0.95
            },
            {
                text: '这是一个演示文本',
                box: [width * 0.15, height * 0.25, width * 0.7, height * 0.35],
                confidence: 0.88
            },
            {
                text: '基于ONNX.js技术',
                box: [width * 0.2, height * 0.4, width * 0.8, height * 0.5],
                confidence: 0.92
            },
            {
                text: '浏览器端文字识别',
                box: [width * 0.1, height * 0.55, width * 0.85, height * 0.65],
                confidence: 0.89
            },
            {
                text: '支持中英文混合',
                box: [width * 0.25, height * 0.7, width * 0.75, height * 0.8],
                confidence: 0.91
            },
            {
                text: 'Demo Mode Active',
                box: [width * 0.3, height * 0.85, width * 0.7, height * 0.95],
                confidence: 0.94
            }
        ];
        
        // 根据语言配置调整文本内容
        if (config.language === 'en') {
            mockTexts[0].text = 'Welcome to OCR Web ONNX';
            mockTexts[1].text = 'This is a demo text';
            mockTexts[2].text = 'Based on ONNX.js technology';
            mockTexts[3].text = 'Browser-based text recognition';
            mockTexts[4].text = 'Supports multiple languages';
        } else if (config.language === 'ch_en') {
            mockTexts[1].text = 'This is 演示文本';
            mockTexts[3].text = 'Browser端 文字识别';
        }
        
        // 随机调整一些参数增加真实感
        mockTexts.forEach(item => {
            // 添加一些随机噪声到置信度
            item.confidence += (Math.random() - 0.5) * 0.1;
            item.confidence = Math.max(0.5, Math.min(0.99, item.confidence));
            
            // 稍微调整边界框位置
            item.box = item.box.map(coord => coord + (Math.random() - 0.5) * 10);
        });
        
        console.log(`生成了 ${mockTexts.length} 个模拟文字区域`);
        
        return {
            texts: mockTexts,
            processTime: 300
        };
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.detectionSession) {
                // 演示模式：跳过真实清理
                this.detectionSession = null;
            }
            
            if (this.recognitionSession) {
                // 演示模式：跳过真实清理
                this.recognitionSession = null;
            }
            
            this.modelLoaded = false;
            this.currentModel = null;
            
            console.log('ONNX资源清理完成（演示模式）');
            
        } catch (error) {
            console.error('资源清理失败:', error);
        }
    }
}

// 导出类
window.ONNXHandler = ONNXHandler; 