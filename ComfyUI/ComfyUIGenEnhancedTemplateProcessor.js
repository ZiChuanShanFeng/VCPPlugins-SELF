// ComfyUIGen增强模板处理器 - 融合ComfyUISelf和ComfyUIGen的优点
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { randomBytes } = require('crypto');

class ComfyUIGenEnhancedTemplateProcessor {
    constructor() {
        // 节点类型到替换字段的映射（融合两个系统的映射）
        this.nodeTypeMapping = {
            'KSampler': {
                'replacements': {
                    'seed': '{{SEED}}',
                    'steps': '{{STEPS}}',
                    'cfg': '{{CFG}}',
                    'sampler_name': '{{SAMPLER}}',
                    'scheduler': '{{SCHEDULER}}',
                    'denoise': '{{DENOISE}}'
                }
            },
            'EmptyLatentImage': {
                'replacements': {
                    'width': '{{WIDTH}}',
                    'height': '{{HEIGHT}}',
                    'batch_size': '{{BATCH_SIZE}}'
                }
            },
            'CheckpointLoaderSimple': {
                'replacements': {
                    'ckpt_name': '{{MODEL}}'
                }
            },
            'easy comfyLoader': {
                'replacements': {
                    'ckpt_name': '{{MODEL}}',
                    'lora_name': 'None',
                    'lora_model_strength': 0.7,
                    'lora_clip_strength': 1.0
                }
            },
            'CLIPTextEncode': {
                'replacements': {
                    'text': {
                        'positive': '{{POSITIVE_PROMPT}}',
                        'negative': '{{NEGATIVE_PROMPT}}'
                    }
                }
            },
            'PrimitiveString': {
                'titleBasedReplacements': {
                    '别动': null,
                    '替换': '{{POSITIVE_PROMPT}}',
                    '不替换': null,
                    '伪提示词': '{{PROMPT_INPUT}}',
                    '用户提示': '{{USER_PROMPT}}',
                    'default': '{{POSITIVE_PROMPT}}'
                }
            },
            'WeiLinPromptToString': {
                'replacements': {
                    'positive': '{{POSITIVE_PROMPT}}',
                    'negative': '{{NEGATIVE_PROMPT}}'
                }
            },
            'SaveImage': {
                'replacements': {
                    'filename_prefix': '{{FILENAME_PREFIX}}'
                }
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
     * 处理工作流 - 主要入口（融合两个系统的处理方式）
     */
    processWorkflow(workflow, runtimeParams) {
        const processed = JSON.parse(JSON.stringify(workflow)); // 深拷贝
        const metadata = {
            originalNodes: {},
            replacementsMade: [],
            preservedNodes: [],
            processingTime: Date.now(),
            processor: 'ComfyUIGenEnhancedTemplateProcessor'
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
            version: '2.0',
            processor: 'ComfyUIGenEnhancedTemplateProcessor',
            processedAt: new Date().toISOString(),
            runtimeParams,
            ...metadata
        };

        return processed;
    }

    /**
     * 智能分析节点处理方式（融合两个系统的分析逻辑）
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
     * 替换节点参数（融合两个系统的替换逻辑）
     */
    replaceNodeParameters(node, nodeId, runtimeParams, metadata) {
        const classType = node.class_type;
        const mapping = this.nodeTypeMapping[classType];
        
        if (!mapping) return;

        // 保存原始值
        if (node.inputs) {
            metadata.originalNodes[nodeId] = JSON.parse(JSON.stringify(node.inputs));
        }

        // 处理基础替换
        if (mapping.replacements) {
            this.processBasicReplacements(node, mapping.replacements, runtimeParams, metadata);
        }

        // 处理基于标题的替换
        if (mapping.titleBasedReplacements) {
            this.processTitleBasedReplacements(node, mapping.titleBasedReplacements, runtimeParams, metadata);
        }
    }

    /**
     * 处理基础替换（来自ComfyUIGen）
     */
    processBasicReplacements(node, replacements, runtimeParams, metadata) {
        if (!node.inputs) return;

        for (const [inputKey, replacement] of Object.entries(replacements)) {
            if (node.inputs.hasOwnProperty(inputKey)) {
                const originalValue = node.inputs[inputKey];
                const newValue = this.resolveReplacement(replacement, runtimeParams);
                
                if (newValue !== null && newValue !== undefined) {
                    node.inputs[inputKey] = newValue;
                    
                    metadata.replacementsMade.push({
                        nodeId,
                        classType: node.class_type,
                        inputKey,
                        originalValue,
                        replacement: newValue,
                        reason: 'basic_replacement'
                    });
                }
            }
        }
    }

    /**
     * 处理基于标题的替换（来自ComfyUISelf）
     */
    processTitleBasedReplacements(node, titleReplacements, runtimeParams, metadata) {
        if (!node.inputs || !node._meta?.title) return;

        const title = node._meta.title;
        let replacement = null;

        // 根据标题选择替换策略
        for (const [titleKey, placeholder] of Object.entries(titleReplacements)) {
            if (title.includes(titleKey)) {
                replacement = placeholder;
                break;
            }
        }

        // 使用默认替换
        if (replacement === null && titleReplacements.default) {
            replacement = titleReplacements.default;
        }

        if (replacement && node.inputs.value !== undefined) {
            const originalValue = node.inputs.value;
            const newValue = this.resolveReplacement(replacement, runtimeParams);
            
            if (newValue !== null && newValue !== undefined) {
                node.inputs.value = newValue;
                
                metadata.replacementsMade.push({
                    nodeId,
                    classType: node.class_type,
                    inputKey: 'value',
                    originalValue,
                    replacement: newValue,
                    reason: 'title_based_replacement'
                });
            }
        }
    }

    /**
     * 解析替换值（融合两个系统的解析逻辑）
     */
    resolveReplacement(replacement, runtimeParams) {
        if (typeof replacement === 'string') {
            // 处理占位符
            if (replacement.startsWith('{{') && replacement.endsWith('}}')) {
                return this.resolvePlaceholder(replacement, runtimeParams);
            }
            return replacement;
        }

        if (typeof replacement === 'object') {
            // 处理复杂替换逻辑
            return this.resolveComplexReplacement(replacement, runtimeParams);
        }

        if (typeof replacement === 'number') {
            return replacement;
        }

        return null;
    }

    /**
     * 解析占位符（融合两个系统的占位符解析）
     */
    resolvePlaceholder(placeholder, runtimeParams) {
        // 基础参数映射
        const paramMapping = {
            // 来自ComfyUIGen的增强参数
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
            
            // 提示词相关
            '{{POSITIVE_PROMPT}}': this.buildPositivePrompt(runtimeParams),
            '{{NEGATIVE_PROMPT}}': this.buildNegativePrompt(runtimeParams),
            '{{USER_PROMPT}}': runtimeParams.prompt || '',
            '{{PROMPT_INPUT}}': runtimeParams.prompt || '',
            
            // 文件名
            '{{FILENAME_PREFIX}}': this.generateFilenamePrefix(runtimeParams.prompt),
            
            // LoRA支持
            '{{LORAS}}': this.buildLoRAsString(runtimeParams.loras || []),
            '{{QUALITY_TAGS}}': runtimeParams.qualityTags || '',
            
            // FaceDetailer参数
            '{{FD_SAM_THRESHOLD}}': runtimeParams.faceDetailerSamThreshold || 0.93,
            '{{FD_DROP_SIZE}}': runtimeParams.faceDetailerDropSize || 10,
            '{{FD_SAM_BBOX_EXPANSION}}': runtimeParams.faceDetailerSamBboxExpansion || 0,
            '{{FD_NOISE_MASK}}': runtimeParams.faceDetailerNoiseMask !== false ? 'true' : 'false',
            '{{FD_GUIDE_SIZE_FOR}}': runtimeParams.faceDetailerGuideSizeFor !== false ? 'true' : 'false',
            '{{FD_WILDCARD}}': runtimeParams.faceDetailerWildcard || '',
            '{{FD_CYCLE}}': runtimeParams.faceDetailerCycle || 1,
            '{{FD_SAM_MASK_HINT_THRESHOLD}}': runtimeParams.faceDetailerSamMaskHintThreshold || 0.7,
            '{{FD_FORCE_INPAINT}}': runtimeParams.faceDetailerForceInpaint !== false ? 'true' : 'false',
            '{{FD_SAM_MASK_HINT_USE_NEGATIVE}}': runtimeParams.faceDetailerSamMaskHintUseNegative || 'False',
            '{{FD_MAX_SIZE}}': runtimeParams.faceDetailerMaxSize || 1024,
            '{{FD_SAM_DILATION}}': runtimeParams.faceDetailerSamDilation || 0,
            '{{FD_SAM_DETECTION_HINT}}': runtimeParams.faceDetailerSamDetectionHint || 'center-1',
            '{{FD_GUIDE_SIZE}}': runtimeParams.faceDetailerGuideSize || 512
        };

        return paramMapping[placeholder];
    }

    /**
     * 解析复杂替换
     */
    resolveComplexReplacement(replacementRules, runtimeParams) {
        // 根据上下文决定使用哪种替换
        if (replacementRules.positive && this.isPositivePromptContext(runtimeParams)) {
            return replacementRules.positive;
        }
        if (replacementRules.negative && this.isNegativePromptContext(runtimeParams)) {
            return replacementRules.negative;
        }
        return replacementRules.default || null;
    }

    /**
     * 构建正面提示词（来自ComfyUIGen）
     */
    buildPositivePrompt(runtimeParams) {
        const userPrompt = runtimeParams.prompt || '';
        const lorasString = this.buildLoRAsString(runtimeParams.loras || []);
        
        const positivePromptParts = [
            userPrompt,
            lorasString,
            runtimeParams.qualityTags
        ].filter(part => part && String(part).trim());
        
        return positivePromptParts.join(', ');
    }

    /**
     * 构建负面提示词（来自ComfyUIGen）
     */
    buildNegativePrompt(runtimeParams) {
        const negativePromptParts = [
            runtimeParams.negativePrompt,
            runtimeParams.negative_prompt
        ].filter(part => part && String(part).trim());
        
        return negativePromptParts.join(', ');
    }

    /**
     * 构建LoRA字符串（来自ComfyUIGen）
     */
    buildLoRAsString(loras) {
        if (!Array.isArray(loras)) return '';
        
        return loras
            .filter(lora => lora.enabled && lora.name)
            .map(lora => {
                const strength = lora.strength || 1.0;
                const clipStrength = lora.clipStrength || lora.strength || 1.0;
                return `<lora:${lora.name}:${strength}:${clipStrength}>`;
            })
            .join(', ');
    }

    /**
     * 生成随机种子（来自ComfyUIGen）
     */
    generateRandomSeed() {
        return randomBytes(4).readUInt32BE(0); // 0..4294967295
    }

    /**
     * 生成文件名前缀（来自ComfyUISelf）
     */
    generateFilenamePrefix(prompt) {
        if (!prompt) return 'ComfyUI';
        
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
     * 判断是否为正面提示词上下文
     */
    isPositivePromptContext(runtimeParams) {
        return runtimeParams.promptContext === 'positive';
    }

    /**
     * 判断是否为负面提示词上下文
     */
    isNegativePromptContext(runtimeParams) {
        return runtimeParams.promptContext === 'negative';
    }

    /**
     * 验证处理后的工作流（融合两个系统的验证逻辑）
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

        // 检查元数据
        if (!processedWorkflow._template_metadata) {
            warnings.push('Missing template metadata');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            stats: {
                totalNodes: nodes.length,
                replacedNodes: processedWorkflow._template_metadata?.replacementsMade?.length || 0,
                preservedNodes: processedWorkflow._template_metadata?.preservedNodes?.length || 0,
                processor: processedWorkflow._template_metadata?.processor || 'unknown'
            }
        };
    }
}

module.exports = ComfyUIGenEnhancedTemplateProcessor;