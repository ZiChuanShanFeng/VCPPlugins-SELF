// ComfyUISelf增强配置管理器 - 借鉴ComfyUIGen配置优先级系统
const fs = require('fs').promises;
const path = require('path');

class EnhancedConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'comfyui-settings.json');
        this.config = null;
        this.loadConfiguration();
    }

    /**
     * 加载配置 - 优先级：JSON文件 > 环境变量 > 默认值
     */
    loadConfiguration() {
        // 1. 默认配置
        this.config = {
            // ComfyUI服务器配置
            serverUrl: 'http://127.0.0.1:8188',
            serverInputDir: path.join(__dirname, 'input'),
            
            // 文件服务器配置
            fileServerIp: '127.0.0.1',
            fileServerPort: '5974',
            fileServerKey: '123456',
            
            // 默认生成参数
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
            
            // 提示词配置
            positivePromptTemplate: '{{USER_PROMPT}}, masterpiece, best quality',
            negativePrompt: 'bad quality, worst quality, blurry, low resolution',
            
            // 工作流配置
            workflow: 'text2img_api.json',
            workflowFallback: ['text2img_basic.json', 'img2img_api.json'],
            
            // LoRA配置
            loras: [],
            qualityTags: 'masterpiece, best quality, high quality',
            
            // 系统配置
            debugMode: false,
            timeout: 300000,
            maxRetries: 3,
            
            // 版本信息
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
        };

        // 2. 从JSON文件加载配置
        this.loadFromFile();

        // 3. 环境变量覆盖
        this.loadFromEnvironment();

        // 4. 验证配置
        this.validateConfiguration();

        console.log('[Config] Configuration loaded successfully');
        if (this.config.debugMode) {
            console.log('[Config] Debug config:', JSON.stringify(this.config, null, 2));
        }

        return this.config;
    }

    /**
     * 从JSON文件加载配置
     */
    loadFromFile() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContent = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(fileContent);
                
                // 深度合并配置
                this.config = this.deepMerge(this.config, fileConfig);
                
                console.log(`[Config] Loaded configuration from: ${this.configPath}`);
            }
        } catch (error) {
            console.error('[Config] Warning: Failed to load config file:', error.message);
        }
    }

    /**
     * 从环境变量加载配置
     */
    loadFromEnvironment() {
        const envMappings = {
            'COMFYUI_BASE_URL': 'serverUrl',
            'COMFYUI_SERVER_INPUT_DIR': 'serverInputDir',
            'FILE_SERVER_PUBLIC_IP': 'fileServerIp',
            'FILE_SERVER_PORT': 'fileServerPort',
            'FILE_SERVER_ACCESS_KEY': 'fileServerKey',
            'DEBUG_MODE': 'debugMode',
            'COMFYUI_TIMEOUT': 'timeout',
            'COMFYUI_MAX_RETRIES': 'maxRetries'
        };

        for (const [envKey, configKey] of Object.entries(envMappings)) {
            if (process.env[envKey]) {
                const value = process.env[envKey];
                
                // 类型转换
                if (['debugMode'].includes(configKey)) {
                    this.config[configKey] = value.toLowerCase() === 'true';
                } else if (['timeout', 'maxRetries', 'fileServerPort'].includes(configKey)) {
                    this.config[configKey] = parseInt(value, 10);
                } else {
                    this.config[configKey] = value;
                }
                
                console.log(`[Config] Override from env: ${configKey} = ${value}`);
            }
        }
    }

    /**
     * 验证配置有效性
     */
    validateConfiguration() {
        const errors = [];
        const warnings = [];

        // 必需配置检查
        if (!this.config.serverUrl) {
            errors.push('serverUrl is required');
        }

        if (!this.config.serverInputDir) {
            errors.push('serverInputDir is required');
        }

        // URL格式验证
        try {
            new URL(this.config.serverUrl);
        } catch {
            errors.push('serverUrl must be a valid URL');
        }

        // 端口范围验证
        if (this.config.fileServerPort < 1 || this.config.fileServerPort > 65535) {
            errors.push('fileServerPort must be between 1 and 65535');
        }

        // 参数范围验证
        if (this.config.defaultWidth < 64 || this.config.defaultWidth > 2048) {
            warnings.push('defaultWidth should be between 64 and 2048');
        }

        if (this.config.defaultHeight < 64 || this.config.defaultHeight > 2048) {
            warnings.push('defaultHeight should be between 64 and 2048');
        }

        if (this.config.defaultSteps < 1 || this.config.defaultSteps > 100) {
            warnings.push('defaultSteps should be between 1 and 100');
        }

        if (this.config.defaultCfg < 1 || this.config.defaultCfg > 20) {
            warnings.push('defaultCfg should be between 1 and 20');
        }

        // 输出验证结果
        if (errors.length > 0) {
            console.error('[Config] Configuration errors:', errors);
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }

        if (warnings.length > 0) {
            console.warn('[Config] Configuration warnings:', warnings);
        }
    }

    /**
     * 智能参数合并 - 运行时参数与配置合并
     */
    mergeParameters(runtimeParams) {
        const merged = { ...this.config };
        
        // 参数映射和验证
        const paramHandlers = {
            // 基础参数
            width: (value) => Math.max(64, Math.min(2048, parseInt(value) || this.config.defaultWidth)),
            height: (value) => Math.max(64, Math.min(2048, parseInt(value) || this.config.defaultHeight)),
            steps: (value) => Math.max(1, Math.min(100, parseInt(value) || this.config.defaultSteps)),
            cfg: (value) => Math.max(1, Math.min(20, parseFloat(value) || this.config.defaultCfg)),
            sampler_name: (value) => value || this.config.defaultSampler,
            scheduler: (value) => value || this.config.defaultScheduler,
            denoise: (value) => Math.max(0, Math.min(1, parseFloat(value) || this.config.defaultDenoise)),
            batch_size: (value) => Math.max(1, Math.min(8, parseInt(value) || this.config.defaultBatchSize)),
            
            // 模型相关
            ckpt_name: (value) => value || this.config.defaultModel,
            prompt: (value) => value || '',
            negative_prompt: (value) => value || this.config.negativePrompt,
            
            // 工作流相关
            workflow: (value) => value || this.config.workflow,
            
            // 种子处理
            seed: (value) => {
                if (value === -1 || value === '-1') return -1;
                const seed = parseInt(value);
                return isNaN(seed) ? this.config.defaultSeed : Math.max(0, Math.min(4294967295, seed));
            }
        };

        // 应用参数处理
        for (const [key, handler] of Object.entries(paramHandlers)) {
            if (runtimeParams[key] !== undefined) {
                try {
                    merged[key] = handler(runtimeParams[key]);
                    
                    if (this.config.debugMode) {
                        console.log(`[Config] Parameter merged: ${key} = ${merged[key]}`);
                    }
                } catch (error) {
                    console.warn(`[Config] Failed to process parameter ${key}:`, error.message);
                }
            }
        }

        // 处理LoRA参数
        if (runtimeParams.loras && Array.isArray(runtimeParams.loras)) {
            merged.loras = runtimeParams.loras.map(lora => ({
                name: lora.name || '',
                strength: Math.max(0, Math.min(2, parseFloat(lora.strength) || 1.0)),
                clipStrength: Math.max(0, Math.min(2, parseFloat(lora.clipStrength) || 1.0)),
                enabled: lora.enabled !== false
            }));
        }

        // 生成组合提示词
        merged.positivePrompt = this.buildPositivePrompt(merged);
        
        return merged;
    }

    /**
     * 构建正面提示词
     */
    buildPositivePrompt(params) {
        const parts = [];
        
        // 用户提示词
        if (params.prompt) {
            parts.push(params.prompt);
        }
        
        // LoRA标签
        if (params.loras && Array.isArray(params.loras)) {
            const loraTags = params.loras
                .filter(lora => lora.enabled && lora.name)
                .map(lora => `<lora:${lora.name}:${lora.strength}:${lora.clipStrength}>`)
                .join(', ');
            
            if (loraTags) {
                parts.push(loraTags);
            }
        }
        
        // 质量标签
        if (params.qualityTags) {
            parts.push(params.qualityTags);
        }
        
        return parts.filter(part => part && part.trim()).join(', ');
    }

    /**
     * 深度合并对象
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * 保存配置到文件
     */
    async saveConfiguration() {
        try {
            this.config.lastUpdated = new Date().toISOString();
            
            await fs.writeFile(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
            
            console.log(`[Config] Configuration saved to: ${this.configPath}`);
            return { success: true };
        } catch (error) {
            console.error('[Config] Failed to save configuration:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取配置统计信息
     */
    getConfigStats() {
        return {
            version: this.config.version,
            lastUpdated: this.config.lastUpdated,
            totalLoras: this.config.loras?.length || 0,
            enabledLoras: this.config.loras?.filter(l => lora.enabled).length || 0,
            serverUrl: this.config.serverUrl,
            defaultModel: this.config.defaultModel,
            defaultWorkflow: this.config.workflow,
            debugMode: this.config.debugMode
        };
    }
}

module.exports = EnhancedConfigManager;