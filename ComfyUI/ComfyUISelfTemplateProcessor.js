// ComfyUIGen模板处理器 - 借鉴ComfyUIGen设计
const fs = require('fs').promises;
const path = require('path');

class ComfyUIGenTemplateProcessor {
    constructor() {
        // 节点类型到替换字段的映射（借鉴ComfyUIGen）
        this.nodeTypeMapping = {
            'KSampler': {
                'seed': '{{SEED}}',
                'steps': '{{STEPS}}',
                'cfg': '{{CFG}}',
                'sampler_name': '{{SAMPLER}}',
                'scheduler': '{{SCHEDULER}}',
                'denoise': '{{DENOISE}}'
            },
            'EmptyLatentImage': {
                'width': '{{WIDTH}}',
                'height': '{{HEIGHT}}',
                'batch_size': '{{BATCH_SIZE}}'
            },
            'CheckpointLoaderSimple': {
                'ckpt_name': '{{MODEL}}'
            },
            'CLIPTextEncode': {
                'text': '{{PROMPT}}'
            },
            'VAEDecode': {
                // 保留节点，不处理
            },
            'SaveImage': {
                'filename_prefix': '{{FILENAME_PREFIX}}'
            }
        };

        // 不需要替换的节点（安全白名单）
        this.preserveNodes = [
            'VAEDecode',
            'SaveImage',
            'UpscaleModelLoader',
            'UltralyticsDetectorProvider',
            'SAMLoader',
            'FaceDetailer',
            'ApplyFBCacheOnModel'
        ];

        // 标题关键词映射（多语言支持）
        this.titleKeywords = {
            preserve: ['别动', '不替换', '保持', '跳过', '保留', 'no', 'not', 'none', 'skip', 'hold', 'keep'],
            replace: ['替换', '修改节点', 'replace', 'modify'],
            promptInput: ['伪提示词', 'prompt_input', 'prompt input'],
            userPrompt: ['用户提示', 'user_prompt', 'user prompt']
        };

        // 预编译路径缓存
        this.pathCache = new Map();
    }

    /**
     * 处理工作流 - 主要入口
     */
    processWorkflow(workflow, runtimeParams) {
        const processed = JSON.parse(JSON.stringify(workflow)); // 深拷贝
        const metadata = {
            originalNodes: {},
            replacementsMade: [],
            preservedNodes: [],
            processingTime: Date.now()
        };

        // 遍历所有节点
        for (const [nodeId, node] of Object.entries(processed)) {
            if (!node.class_type) continue;

            const analysis = this.analyzeNode(node, nodeId);
            
            if (analysis.action === 'preserve') {
                metadata.preservedNodes.push({
                    nodeId,
                    classType: node.class_type,
                    title: node._meta?.title,
                    reason: analysis.reason
                });
                continue;
            }

            if (analysis.action === 'replace') {
                this.replaceNodeParameters(node, nodeId, runtimeParams, metadata);
            }
        }

        // 添加处理元数据
        processed._template_metadata = {
            version: '1.0',
            processor: 'ComfyUIGenTemplateProcessor',
            processedAt: new Date().toISOString(),
            runtimeParams,
            ...metadata
        };

        return processed;
    }

    /**
     * 智能分析节点处理方式
     */
    analyzeNode(node, nodeId) {
        const classType = node.class_type;
        const title = (node._meta?.title || '').toLowerCase();

        // 1. 检查是否在保留节点列表中
        if (this.preserveNodes.includes(classType)) {
            return { action: 'preserve', reason: 'preserve_node_type' };
        }

        // 2. 根据标题关键词判断
        for (const [category, keywords] of Object.entries(this.titleKeywords)) {
            if (keywords.some(kw => title.includes(kw))) {
                if (category === 'preserve') {
                    return { action: 'preserve', reason: 'title_keyword' };
                } else if (category === 'replace') {
                    return { action: 'replace', reason: 'title_keyword' };
                }
            }
        }

        // 3. 检查是否有可替换的映射
        if (this.nodeTypeMapping[classType]) {
            return { action: 'replace', reason: 'node_type_mapping' };
        }

        // 4. 默认保留（安全原则）
        return { action: 'preserve', reason: 'default_preserve' };
    }

    /**
     * 替换节点参数
     */
    replaceNodeParameters(node, nodeId, runtimeParams, metadata) {
        const classType = node.class_type;
        const mapping = this.nodeTypeMapping[classType];
        
        if (!mapping || !node.inputs) return;

        // 保存原始值
        metadata.originalNodes[nodeId] = JSON.parse(JSON.stringify(node.inputs));

        // 执行替换
        for (const [inputKey, placeholder] of Object.entries(mapping)) {
            if (node.inputs.hasOwnProperty(inputKey)) {
                const originalValue = node.inputs[inputKey];
                const newValue = this.resolvePlaceholder(placeholder, runtimeParams);
                
                if (newValue !== null && newValue !== undefined) {
                    node.inputs[inputKey] = newValue;
                    
                    metadata.replacementsMade.push({
                        nodeId,
                        classType,
                        inputKey,
                        originalValue,
                        replacement: newValue,
                        placeholder
                    });
                }
            }
        }
    }

    /**
     * 解析占位符
     */
    resolvePlaceholder(placeholder, runtimeParams) {
        // 基础参数映射
        const paramMapping = {
            '{{SEED}}': this.generateRandomSeed(),
            '{{STEPS}}': runtimeParams.steps || 20,
            '{{CFG}}': runtimeParams.cfg || 7.5,
            '{{SAMPLER}}': runtimeParams.sampler_name || 'euler',
            '{{SCHEDULER}}': runtimeParams.scheduler || 'normal',
            '{{DENOISE}}': runtimeParams.denoise || 1.0,
            '{{WIDTH}}': runtimeParams.width || 512,
            '{{HEIGHT}}': runtimeParams.height || 512,
            '{{BATCH_SIZE}}': runtimeParams.batch_size || 1,
            '{{MODEL}}': runtimeParams.ckpt_name || 'anything-v5-PrtRE.safetensors',
            '{{PROMPT}}': runtimeParams.prompt || 'masterpiece, best quality',
            '{{FILENAME_PREFIX}}': this.generateFilenamePrefix(runtimeParams.prompt)
        };

        return paramMapping[placeholder];
    }

    /**
     * 生成随机种子
     */
    generateRandomSeed() {
        return Math.floor(Math.random() * 4294967296); // 32位无符号整数
    }

    /**
     * 生成文件名前缀
     */
    generateFilenamePrefix(prompt) {
        if (!prompt) return 'ComfyUI';
        
        // 简化提示词作为文件名
        const cleanText = prompt
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff,-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const words = cleanText.split(' ').filter(word => word.length > 1);
        const keywords = words.slice(0, 3).join('_');
        
        return keywords.length > 20 ? keywords.substring(0, 20) : keywords || 'ComfyUI';
    }

    /**
     * 验证处理后的工作流
     */
    validateWorkflow(processedWorkflow) {
        const errors = [];
        const warnings = [];

        // 检查必需的节点
        const nodes = Object.values(processedWorkflow);
        const hasKSampler = nodes.some(n => n.class_type === 'KSampler');
        const hasSaveImage = nodes.some(n => n.class_type === 'SaveImage');
        
        if (!hasKSampler) errors.push('Missing KSampler node');
        if (!hasSaveImage) warnings.push('Missing SaveImage node');

        // 检查未解析的占位符
        const workflowStr = JSON.stringify(processedWorkflow);
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const unresolvedPlaceholders = [];
        let match;
        
        while ((match = placeholderRegex.exec(workflowStr)) !== null) {
            if (!match[1].startsWith('FILENAME_PREFIX')) { // 允许的动态占位符
                unresolvedPlaceholders.push(match[0]);
            }
        }
        
        if (unresolvedPlaceholders.length > 0) {
            warnings.push(`Unresolved placeholders: ${unresolvedPlaceholders.join(', ')}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            stats: {
                totalNodes: nodes.length,
                replacedNodes: processedWorkflow._template_metadata?.replacementsMade?.length || 0,
                preservedNodes: processedWorkflow._template_metadata?.preservedNodes?.length || 0
            }
        };
    }
}

module.exports = ComfyUISelfTemplateProcessor;