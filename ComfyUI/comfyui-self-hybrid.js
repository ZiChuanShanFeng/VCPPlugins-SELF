// ComfyUIself 综合型插件 - 融合ComfyUIGen + ComfyUIself优势
// 架构设计：双模式引擎 + 智能配置管理 + 企业级特性

const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// ==================== 核心架构 ====================
class ComfyUISelfHybrid {
    constructor() {
        // 双模式引擎
        this.templateEngine = new TemplateEngine();
        this.dynamicEngine = new DynamicEngine();
        
        // 配置管理
        this.configManager = new EnhancedConfigManager();
        
        // 执行管理器
        this.executionManager = new ExecutionManager(this);
        
        // 文件服务
        this.fileService = new FileService();
        
        // 监控系统
        this.monitoring = new MonitoringSystem();
        
        // 初始化
        this.initialize();
    }

    async initialize() {
        await this.configManager.loadConfiguration();
        await this.fileService.initialize();
        console.log('[ComfyUIself] Hybrid plugin initialized successfully');
    }

    // 主要执行入口
    async execute(args) {
        const executionId = this.monitoring.startExecution(args);
        
        try {
            // 1. 智能参数处理
            const processedParams = await this.configManager.processParameters(args);
            
            // 2. 工作流选择和加载
            const workflowContext = await this.selectAndLoadWorkflow(processedParams);
            
            // 3. 智能模式选择
            const processingMode = this.selectProcessingMode(workflowContext, processedParams);
            
            // 4. 工作流处理
            const processedWorkflow = await this.processWorkflow(
                workflowContext, 
                processedParams, 
                processingMode
            );
            
            // 5. 执行工作流
            const result = await this.executionManager.execute(processedWorkflow, processedParams);
            
            // 6. 结果处理
            const finalResult = await this.processResult(result, processedParams);
            
            this.monitoring.endExecution(executionId, { success: true, result: finalResult });
            
            return {
                success: true,
                executionId,
                mode: processingMode,
                result: finalResult,
                stats: this.monitoring.getExecutionStats(executionId)
            };
            
        } catch (error) {
            this.monitoring.endExecution(executionId, { success: false, error: error.message });
            throw error;
        }
    }

    // 智能工作流选择
    async selectAndLoadWorkflow(params) {
        const candidates = this.configManager.getWorkflowCandidates(params);
        
        for (const workflowName of candidates) {
            try {
                const workflow = await this.loadWorkflow(workflowName);
                const analysis = await this.analyzeWorkflow(workflow);
                
                return {
                    name: workflowName,
                    workflow,
                    analysis,
                    loadTime: Date.now()
                };
            } catch (error) {
                console.warn(`[ComfyUIself] Failed to load workflow ${workflowName}:`, error.message);
                continue;
            }
        }
        
        throw new Error('No suitable workflow found');
    }

    // 智能模式选择
    selectProcessingMode(workflowContext, params) {
        const { analysis } = workflowContext;
        
        // 复杂度评估
        const complexity = this.calculateComplexity(analysis);
        
        // 参数修改需求
        const modificationNeeds = this.assessModificationNeeds(params, analysis);
        
        // 智能决策
        if (complexity > 0.7 && modificationNeeds.hasComplexReplacements) {
            return 'template'; // 复杂工作流使用模板模式
        } else if (modificationNeeds.hasDynamicModifications) {
            return 'dynamic';  // 动态修改使用动态模式
        } else if (complexity > 0.5) {
            return 'hybrid';   // 中等复杂度使用混合模式
        } else {
            return 'dynamic'; // 简单工作流使用动态模式
        }
    }

    // 工作流处理
    async processWorkflow(workflowContext, params, mode) {
        switch (mode) {
            case 'template':
                return await this.templateEngine.process(workflowContext.workflow, params);
            case 'dynamic':
                return await this.dynamicEngine.process(workflowContext.workflow, params);
            case 'hybrid':
                return await this.processHybrid(workflowContext, params);
            default:
                throw new Error(`Unknown processing mode: ${mode}`);
        }
    }

    // 混合模式处理
    async processHybrid(workflowContext, params) {
        // 先进行模板预处理
        const templateProcessed = await this.templateEngine.process(
            workflowContext.workflow, 
            params
        );
        
        // 再进行动态修改
        const dynamicProcessed = await this.dynamicEngine.process(
            templateProcessed, 
            params
        );
        
        return dynamicProcessed;
    }

    // 复杂度计算
    calculateComplexity(analysis) {
        let complexity = 0;
        
        // 节点数量权重
        complexity += Math.min(analysis.nodeCount / 100, 0.3);
        
        // 特殊节点权重
        complexity += analysis.hasAdvancedNodes ? 0.2 : 0;
        complexity += analysis.hasLoRANodes ? 0.15 : 0;
        complexity += analysis.hasControlNetNodes ? 0.15 : 0;
        complexity += analysis.hasDetailerNodes ? 0.2 : 0;
        
        // 连接复杂度权重
        complexity += Math.min(analysis.connectionCount / 200, 0.2);
        
        return Math.min(complexity, 1.0);
    }

    // 评估修改需求
    assessModificationNeeds(params, analysis) {
        return {
            hasDynamicModifications: params.prompt || params.negative_prompt,
            hasComplexReplacements: analysis.hasPlaceholders,
            hasLoRARequirements: params.loras && params.loras.length > 0,
            hasAdvancedParameters: params.advanced_params
        };
    }

    // 加载工作流
    async loadWorkflow(workflowName) {
        const workflowPath = path.join(__dirname, 'workflows', workflowName);
        const content = await fs.readFile(workflowPath, 'utf8');
        return JSON.parse(content);
    }

    // 分析工作流
    async analyzeWorkflow(workflow) {
        const nodes = workflow.prompt || workflow;
        const nodeTypes = Object.values(nodes).map(n => n.class_type).filter(Boolean);
        
        return {
            nodeCount: Object.keys(nodes).length,
            nodeTypes: [...new Set(nodeTypes)],
            connectionCount: this.countConnections(nodes),
            hasAdvancedNodes: nodeTypes.some(type => 
                ['FaceDetailer', 'SAMLoader', 'UltralyticsDetectorProvider'].includes(type)
            ),
            hasLoRANodes: nodeTypes.some(type => type.includes('Lora')),
            hasControlNetNodes: nodeTypes.some(type => type.includes('ControlNet')),
            hasDetailerNodes: nodeTypes.includes('FaceDetailer'),
            hasPlaceholders: JSON.stringify(workflow).includes('{{'),
            complexity: 0 // 将在后续计算
        };
    }

    // 计算连接数
    countConnections(nodes) {
        let connections = 0;
        for (const node of Object.values(nodes)) {
            if (node.inputs) {
                for (const value of Object.values(node.inputs)) {
                    if (Array.isArray(value)) {
                        connections++;
                    }
                }
            }
        }
        return connections;
    }

    // 结果处理
    async processResult(result, params) {
        // 图像处理和URL生成
        const processedImages = await Promise.all(
            result.images.map(async (image) => {
                const imageUrl = await this.fileService.getImageUrl(image);
                return {
                    ...image,
                    url: imageUrl,
                    thumbnail: await this.fileService.generateThumbnail(image)
                };
            })
        );

        return {
            images: processedImages,
            executionTime: result.executionTime,
            workflow: params.workflow,
            parameters: params,
            metadata: {
                generatedAt: new Date().toISOString(),
                plugin: 'ComfyUIself-Hybrid',
                version: '2.0.0'
            }
        };
    }
}

// ==================== 模板引擎 ====================
class TemplateEngine {
    constructor() {
        this.processor = new WorkflowTemplateProcessor();
        this.cache = new Map();
    }

    async process(workflow, params) {
        const cacheKey = this.generateCacheKey(workflow, params);
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const processed = this.processor.processWorkflow(workflow, params);
        
        // 缓存结果
        this.cache.set(cacheKey, processed);
        
        // 限制缓存大小
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        return processed;
    }

    generateCacheKey(workflow, params) {
        const workflowStr = JSON.stringify(workflow);
        const paramsStr = JSON.stringify(params);
        return `${workflowStr.length}_${paramsStr.length}_${Date.now()}`;
    }
}

// ==================== 动态引擎 ====================
class DynamicEngine {
    constructor() {
        this.nodeFinder = new SmartNodeFinder();
        this.parameterProcessor = new ParameterProcessor();
    }

    async process(workflow, params) {
        const processed = JSON.parse(JSON.stringify(workflow));
        
        // 动态节点查找和修改
        await this.nodeFinder.findAndModify(processed, params);
        
        // 参数处理
        this.parameterProcessor.process(processed, params);
        
        return processed;
    }
}

// ==================== 智能节点查找器 ====================
class SmartNodeFinder {
    async findAndModify(workflow, params) {
        const modifications = [
            { title: 'Positive Prompt', param: 'prompt', handler: this.modifyPrompt },
            { title: 'Negative Prompt', param: 'negative_prompt', handler: this.modifyNegativePrompt },
            { title: 'KSampler', param: 'sampler_params', handler: this.modifySampler },
            { title: 'Empty Latent Image', param: 'size_params', handler: this.modifySize },
            { title: 'Checkpoint Loader', param: 'model_params', handler: this.modifyModel }
        ];

        for (const mod of modifications) {
            if (params[mod.param]) {
                await this.applyModification(workflow, mod.title, mod.handler, params);
            }
        }
    }

    async applyModification(workflow, title, handler, params) {
        const nodes = workflow.prompt || workflow;
        
        for (const [nodeId, node] of Object.entries(nodes)) {
            if (this.matchesNode(node, title)) {
                await handler.call(this, node, params);
            }
        }
    }

    matchesNode(node, title) {
        const nodeTitle = (node._meta?.title || '').toLowerCase();
        const classType = node.class_type;
        
        // 模糊匹配
        return nodeTitle.includes(title.toLowerCase()) ||
               classType.toLowerCase().includes(title.toLowerCase()) ||
               this.isSemanticMatch(nodeTitle, title);
    }

    isSemanticMatch(nodeTitle, title) {
        // 语义匹配规则
        const semanticMap = {
            'Positive Prompt': ['positive', 'prompt', 'text'],
            'Negative Prompt': ['negative', 'bad', 'worst'],
            'KSampler': ['sampler', 'ksampler', 'sampling'],
            'Empty Latent Image': ['latent', 'empty', 'size'],
            'Checkpoint Loader': ['checkpoint', 'model', 'loader']
        };

        const keywords = semanticMap[title] || [];
        return keywords.some(keyword => nodeTitle.includes(keyword));
    }

    async modifyPrompt(node, params) {
        if (node.inputs && node.inputs.text !== undefined) {
            node.inputs.text = params.prompt || '';
        }
    }

    async modifyNegativePrompt(node, params) {
        if (node.inputs && node.inputs.text !== undefined) {
            node.inputs.text = params.negative_prompt || '';
        }
    }

    async modifySampler(node, params) {
        if (node.inputs) {
            if (params.seed !== undefined) node.inputs.seed = params.seed;
            if (params.steps !== undefined) node.inputs.steps = params.steps;
            if (params.cfg !== undefined) node.inputs.cfg = params.cfg;
            if (params.sampler_name !== undefined) node.inputs.sampler_name = params.sampler_name;
            if (params.scheduler !== undefined) node.inputs.scheduler = params.scheduler;
        }
    }

    async modifySize(node, params) {
        if (node.inputs) {
            if (params.width !== undefined) node.inputs.width = params.width;
            if (params.height !== undefined) node.inputs.height = params.height;
            if (params.batch_size !== undefined) node.inputs.batch_size = params.batch_size;
        }
    }

    async modifyModel(node, params) {
        if (node.inputs && params.ckpt_name !== undefined) {
            node.inputs.ckpt_name = params.ckpt_name;
        }
    }
}

// ==================== 参数处理器 ====================
class ParameterProcessor {
    process(workflow, params) {
        // LoRA处理
        if (params.loras) {
            this.processLoRAs(workflow, params.loras);
        }
        
        // 高级参数处理
        if (params.advanced_params) {
            this.processAdvancedParams(workflow, params.advanced_params);
        }
    }

    processLoRAs(workflow, loras) {
        // 查找LoRA相关节点并应用参数
        const nodes = workflow.prompt || workflow;
        
        for (const [nodeId, node] of Object.entries(nodes)) {
            if (node.class_type && node.class_type.includes('Lora')) {
                this.applyLoRAParams(node, loras);
            }
        }
    }

    applyLoRAParams(node, loras) {
        if (node.inputs) {
            const enabledLoras = loras.filter(lora => lora.enabled);
            if (enabledLoras.length > 0) {
                const primaryLora = enabledLoras[0];
                node.inputs.lora_name = primaryLora.name;
                node.inputs.strength_model = primaryLora.strength || 1.0;
                node.inputs.strength_clip = primaryLora.clipStrength || 1.0;
            }
        }
    }

    processAdvancedParams(workflow, advancedParams) {
        // 处理高级参数
        const nodes = workflow.prompt || workflow;
        
        for (const [paramName, paramValue] of Object.entries(advancedParams)) {
            this.applyAdvancedParam(nodes, paramName, paramValue);
        }
    }

    applyAdvancedParam(nodes, paramName, paramValue) {
        // 根据参数名查找对应节点并应用
        for (const node of Object.values(nodes)) {
            if (this.nodeAcceptsParam(node, paramName)) {
                node.inputs[paramName] = paramValue;
            }
        }
    }

    nodeAcceptsParam(node, paramName) {
        return node.inputs && node.inputs.hasOwnProperty(paramName);
    }
}

// ==================== 工作流模板处理器 ====================
class WorkflowTemplateProcessor {
    processWorkflow(workflow, params) {
        const processed = JSON.parse(JSON.stringify(workflow));
        const replacements = this.buildReplacements(params);
        
        // 字符串级别的占位符替换
        let workflowString = JSON.stringify(processed);
        for (const [placeholder, value] of Object.entries(replacements)) {
            const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
            workflowString = workflowString.replace(regex, String(value));
        }
        
        return JSON.parse(workflowString);
    }

    buildReplacements(params) {
        return {
            '{{SEED}}': params.seed || this.generateRandomSeed(),
            '{{STEPS}}': params.steps || 20,
            '{{CFG}}': params.cfg || 7.5,
            '{{SAMPLER}}': params.sampler_name || 'euler',
            '{{SCHEDULER}}': params.scheduler || 'normal',
            '{{DENOISE}}': params.denoise || 1.0,
            '{{WIDTH}}': params.width || 512,
            '{{HEIGHT}}': params.height || 512,
            '{{BATCH_SIZE}}': params.batch_size || 1,
            '{{MODEL}}': params.ckpt_name || 'anything-v5-PrtRE.safetensors',
            '{{POSITIVE_PROMPT}}': params.prompt || '',
            '{{NEGATIVE_PROMPT}}': params.negative_prompt || '',
            '{{PROMPT}}': params.prompt || ''
        };
    }

    generateRandomSeed() {
        return Math.floor(Math.random() * 4294967296);
    }
}

// ==================== 执行管理器 ====================
class ExecutionManager {
    constructor(hybrid) {
        this.hybrid = hybrid;
        this.activeExecutions = new Map();
    }

    async execute(workflow, params) {
        const config = this.hybrid.configManager.config;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`${config.serverUrl.replace('http', 'ws')}/ws?clientId=${uuidv4()}`);
            let promptId = null;
            
            ws.on('open', async () => {
                try {
                    console.log('[ComfyUIself] WebSocket opened, executing workflow...');
                    const response = await this.postPrompt(workflow);
                    promptId = response.prompt_id;
                    console.log(`[ComfyUIself] Workflow queued with ID: ${promptId}`);
                } catch (err) {
                    reject(err);
                    ws.close();
                }
            });
            
            ws.on('message', async (data, isBinary) => {
                if (isBinary) return;
                
                const msg = JSON.parse(data.toString());
                
                if (msg.type === 'executing' && msg.data.node === null && msg.data.prompt_id === promptId) {
                    console.log('[ComfyUIself] Workflow execution completed');
                    ws.close();
                    
                    try {
                        const result = await this.getExecutionResult(promptId);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                } else if (msg.type === 'execution_error') {
                    reject(new Error(`Execution error: ${JSON.stringify(msg.data)}`));
                    ws.close();
                }
            });
            
            ws.on('error', (err) => {
                reject(err);
            });
            
            ws.on('close', () => {
                console.log('[ComfyUIself] WebSocket closed');
            });
        });
    }

    async postPrompt(workflow) {
        const config = this.hybrid.configManager.config;
        const response = await fetch(`${config.serverUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: workflow, 
                client_id: uuidv4() 
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    async getExecutionResult(promptId) {
        const config = this.hybrid.configManager.config;
        const response = await fetch(`${config.serverUrl}/history/${promptId}`);
        const history = await response.json();
        const executionData = history[promptId];
        
        if (!executionData) {
            throw new Error('Execution data not found');
        }
        
        return {
            images: this.extractImages(executionData),
            executionTime: executionData.execution_time || 0,
            promptId: promptId
        };
    }

    extractImages(executionData) {
        const images = [];
        
        if (executionData.outputs) {
            for (const [nodeId, output] of Object.entries(executionData.outputs)) {
                if (output.images) {
                    for (const image of output.images) {
                        images.push({
                            filename: image.filename,
                            subfolder: image.subfolder,
                            type: image.type
                        });
                    }
                }
            }
        }
        
        return images;
    }
}

// ==================== 增强配置管理器 ====================
class EnhancedConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'comfyui-settings.json');
        this.config = null;
    }

    async loadConfiguration() {
        // 默认配置
        this.config = {
            serverUrl: 'http://127.0.0.1:8188',
            serverInputDir: path.join(__dirname, 'input'),
            fileServerIp: '127.0.0.1',
            fileServerPort: '5974',
            fileServerKey: '123456',
            
            // 默认参数
            defaultModel: 'anything-v5-PrtRE.safetensors',
            defaultWidth: 512,
            defaultHeight: 512,
            defaultSteps: 20,
            defaultCfg: 7.5,
            defaultSampler: 'euler',
            defaultScheduler: 'normal',
            defaultSeed: -1,
            defaultBatchSize: 1,
            defaultDenoise: 1.0,
            
            // 工作流配置
            workflow: 'text2img_api.json',
            workflowFallback: ['text2img_basic.json', 'img2img_api.json'],
            
            // 系统配置
            debugMode: false,
            timeout: 300000,
            maxRetries: 3,
            
            // 智能模式配置
            modeThresholds: {
                template: 0.7,
                hybrid: 0.5
            },
            
            version: '2.0.0',
            lastUpdated: new Date().toISOString()
        };
        
        // 从文件加载
        await this.loadFromFile();
        
        // 环境变量覆盖
        this.loadFromEnvironment();
        
        return this.config;
    }

    async loadFromFile() {
        try {
            if (await fs.access(this.configPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(this.configPath, 'utf8');
                const fileConfig = JSON.parse(content);
                this.config = { ...this.config, ...fileConfig };
                console.log('[Config] Configuration loaded from file');
            }
        } catch (error) {
            console.warn('[Config] Failed to load config file:', error.message);
        }
    }

    loadFromEnvironment() {
        const envMappings = {
            'COMFYUI_BASE_URL': 'serverUrl',
            'COMFYUI_SERVER_INPUT_DIR': 'serverInputDir',
            'FILE_SERVER_PUBLIC_IP': 'fileServerIp',
            'FILE_SERVER_PORT': 'fileServerPort',
            'FILE_SERVER_ACCESS_KEY': 'fileServerKey',
            'DEBUG_MODE': 'debugMode'
        };

        for (const [envKey, configKey] of Object.entries(envMappings)) {
            if (process.env[envKey]) {
                this.config[configKey] = process.env[envKey];
            }
        }
    }

    async processParameters(params) {
        const processed = { ...this.config, ...params };
        
        // 参数验证和转换
        if (processed.width) processed.width = Math.max(64, Math.min(2048, processed.width));
        if (processed.height) processed.height = Math.max(64, Math.min(2048, processed.height));
        if (processed.steps) processed.steps = Math.max(1, Math.min(100, processed.steps));
        if (processed.cfg) processed.cfg = Math.max(1, Math.min(20, processed.cfg));
        
        // 种子处理
        if (processed.seed === -1 || processed.seed === '-1') {
            processed.seed = Math.floor(Math.random() * 4294967296);
        }
        
        return processed;
    }

    getWorkflowCandidates(params) {
        const candidates = [];
        
        if (params.workflow) candidates.push(params.workflow);
        if (this.config.workflow) candidates.push(this.config.workflow);
        if (this.config.workflowFallback) {
            candidates.push(...this.config.workflowFallback);
        }
        
        // 确保基础工作流
        const fallbacks = ['text2img_api.json', 'text2img_basic.json'];
        fallbacks.forEach(wf => {
            if (!candidates.includes(wf)) candidates.push(wf);
        });
        
        return [...new Set(candidates)];
    }
}

// ==================== 文件服务 ====================
class FileService {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        this.initialized = true;
        console.log('[FileService] File service initialized');
    }

    async getImageUrl(image) {
        const config = global.hybrid?.configManager?.config || {};
        
        // 构建图像URL
        const baseUrl = `http://${config.fileServerIp}:${config.fileServerPort}`;
        const imagePath = image.subfolder ? `${image.subfolder}/${image.filename}` : image.filename;
        
        return `${baseUrl}/comfyui_server/pw=${config.fileServerKey}/files/output/${imagePath}`;
    }

    async generateThumbnail(image) {
        // 简单的缩略图URL生成
        const imageUrl = await this.getImageUrl(image);
        return `${imageUrl}?thumbnail=true`;
    }
}

// ==================== 监控系统 ====================
class MonitoringSystem {
    constructor() {
        this.executions = new Map();
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            modeUsage: {
                template: 0,
                dynamic: 0,
                hybrid: 0
            }
        };
    }

    startExecution(args) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        this.executions.set(executionId, {
            startTime,
            args,
            status: 'running'
        });
        
        this.stats.totalExecutions++;
        
        return executionId;
    }

    endExecution(executionId, result) {
        const execution = this.executions.get(executionId);
        if (execution) {
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.status = result.success ? 'completed' : 'failed';
            execution.result = result;
            
            // 更新统计
            if (result.success) {
                this.stats.successfulExecutions++;
            } else {
                this.stats.failedExecutions++;
            }
            
            if (result.mode) {
                this.stats.modeUsage[result.mode]++;
            }
            
            this.updateAverageExecutionTime();
        }
    }

    updateAverageExecutionTime() {
        const completedExecutions = Array.from(this.executions.values())
            .filter(e => e.status === 'completed' && e.duration);
        
        if (completedExecutions.length > 0) {
            const totalTime = completedExecutions.reduce((sum, e) => sum + e.duration, 0);
            this.stats.averageExecutionTime = totalTime / completedExecutions.length;
        }
    }

    getExecutionStats(executionId) {
        const execution = this.executions.get(executionId);
        return execution ? {
            duration: execution.duration,
            status: execution.status
        } : null;
    }

    getGlobalStats() {
        return { ...this.stats };
    }
}

// ==================== 主入口 ====================
async function main() {
    try {
        // 初始化混合插件
        const hybrid = new ComfyUISelfHybrid();
        global.hybrid = hybrid; // 全局访问
        
        // 读取输入
        let inputData = '';
        process.stdin.setEncoding('utf8');
        
        for await (const chunk of process.stdin) {
            inputData += chunk;
        }
        
        if (!inputData.trim()) {
            throw new Error('No input data received');
        }
        
        const args = JSON.parse(inputData);
        console.log('[ComfyUIself] Received args:', JSON.stringify(args, null, 2));
        
        // 执行工作流
        const result = await hybrid.execute(args);
        
        // 输出结果
        console.log(JSON.stringify({
            status: 'success',
            result: result
        }, null, 2));
        
    } catch (error) {
        console.error('[ComfyUIself] Error:', error);
        console.log(JSON.stringify({
            status: 'error',
            error: error.message
        }, null, 2));
        process.exit(1);
    }
}

// 导出模块
module.exports = {
    ComfyUISelfHybrid,
    main
};

// 如果直接运行此文件
if (require.main === module) {
    main();
}