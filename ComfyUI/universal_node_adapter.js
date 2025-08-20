// ComfyUI 通用节点适配器
// 自动适配所有ComfyUI节点类型

// 基础节点类型映射（常见节点）
const baseNodeMappings = {
    // 文本相关
    'CLIPTextEncode': (widgets) => {
        const text = widgets && widgets[0] ? widgets[0] : '';
        return text.includes('text, watermark') || text.includes('bad quality') || 
               text.includes('worst quality') || text.includes('low quality') ? 'Negative Prompt' : 'Positive Prompt';
    },
    'CLIPSetLastLayer': 'CLIP Set Last Layer',
    
    // 采样相关
    'KSampler': 'KSampler',
    'KSamplerAdvanced': 'KSampler Advanced',
    'KarrasSchedule': 'Karras Schedule',
    
    // 模型相关
    'CheckpointLoaderSimple': 'Load Checkpoint',
    'CheckpointLoader': 'Checkpoint Loader',
    'CheckpointLoader (Simple)': 'Load Checkpoint',
    'UNETLoader': 'UNET Loader',
    'VAELoader': 'VAE Loader',
    'VAEDecode': 'VAE Decode',
    'VAEEncode': 'VAE Encode',
    
    // 图像相关
    'EmptyLatentImage': 'Empty Latent Image',
    'SaveImage': 'Save Image',
    'PreviewImage': 'Preview Image',
    'LoadImage': 'Load Image',
    'ImageScale': 'Image Scale',
    'ImageScaleBy': 'Image Scale By',
    
    // 条件相关
    'ControlNetLoader': 'ControlNet Loader',
    'ControlNetApply': 'ControlNet Apply',
    'ControlNetApplyAdvanced': 'ControlNet Apply Advanced',
    'IPAdapterModelLoader': 'IPAdapter Model Loader',
    'IPAdapterApply': 'IPAdapter Apply',
    
    // LoRA相关
    'LoraLoader': 'LoRA Loader',
    'LoraLoaderModelOnly': 'LoRA Loader Model Only',
    'LoraTagLoader': 'LoRA Tag Loader',
    
    // 高级功能
    'FaceDetailer': 'Face Detailer',
    'DetailerForEach': 'Detailer For Each',
    'SAMModelLoader': 'SAM Model Loader',
    'CLIPSegModelLoader': 'CLIPSeg Model Loader',
    
    // 实用工具
    'Seed': 'Seed',
    'Reroute': 'Reroute',
    'PrimitiveNode': 'Primitive Node',
    'Note': 'Note',
    
    // 自定义节点前缀处理
};

// 自定义节点前缀映射
const customNodePrefixes = {
    'CR ': 'CR ',
    'ComfyUI ': 'ComfyUI ',
    'Impact': 'Impact',
    'rgthree': 'rgthree',
    'pysssss': 'pysssss',
    'Was': 'Was',
    'Efficiency': 'Efficiency',
    'Advanced': 'Advanced',
};

// 智能节点标题生成器
function generateSmartNodeTitle(nodeType, widgets) {
    // 1. 检查基础映射
    if (baseNodeMappings[nodeType]) {
        if (typeof baseNodeMappings[nodeType] === 'function') {
            return baseNodeMappings[nodeType](widgets);
        }
        return baseNodeMappings[nodeType];
    }
    
    // 2. 处理自定义节点前缀
    for (const [prefix, titlePrefix] of Object.entries(customNodePrefixes)) {
        if (nodeType.startsWith(prefix)) {
            const remaining = nodeType.substring(prefix.length);
            // 格式化剩余部分
            const formatted = remaining
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
            return titlePrefix + formatted;
        }
    }
    
    // 3. 通用格式化
    return nodeType
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/\b\w+Loader\b/gi, 'Loader')
        .replace(/\b\w+Apply\b/gi, 'Apply')
        .trim();
}

// 智能参数提取器
function extractSmartParameters(nodeType, widgets) {
    const parameters = {};
    
    if (!widgets || !Array.isArray(widgets)) {
        return parameters;
    }
    
    // 通用参数提取规则
    switch (nodeType) {
        case 'CLIPTextEncode':
            if (widgets[0] !== undefined) parameters.text = widgets[0];
            break;
            
        case 'KSampler':
        case 'KSamplerAdvanced':
            if (widgets[0] !== undefined) parameters.seed = widgets[0];
            if (widgets[1] !== undefined) parameters.steps = widgets[1] === "randomize" ? Math.floor(Math.random() * 50) + 20 : Number(widgets[1]);
            if (widgets[2] !== undefined) parameters.cfg = Number(widgets[2]);
            if (widgets[3] !== undefined) {
                // 采样器名称映射：将索引映射到实际名称
                const samplerNames = ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 
                                   'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_sde', 
                                   'dpmpp_2m', 'dpmpp_sde_gpu', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddim', 'uni_pc', 'uni_pc_bh2'];
                const samplerIndex = Number(widgets[3]);
                parameters.sampler_name = samplerNames[samplerIndex] || 'euler';
            }
            if (widgets[4] !== undefined) {
                // 调度器名称映射
                const schedulerNames = ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'];
                const schedulerValue = String(widgets[4]).toLowerCase();
                parameters.scheduler = schedulerNames.includes(schedulerValue) ? schedulerValue : 'normal';
            }
            if (widgets[5] !== undefined) {
                // denoise值处理
                const denoiseValue = widgets[5];
                if (denoiseValue === "normal" || denoiseValue === null || denoiseValue === undefined) {
                    parameters.denoise = 1.0; // 文生图的默认值
                } else {
                    parameters.denoise = Number(denoise);
                }
            }
            break;
            
        case 'EmptyLatentImage':
            if (widgets[0] !== undefined) parameters.width = widgets[0];
            if (widgets[1] !== undefined) parameters.height = widgets[1];
            if (widgets[2] !== undefined) parameters.batch_size = widgets[2];
            break;
            
        case 'SaveImage':
            if (widgets[0] !== undefined) parameters.filename_prefix = widgets[0];
            break;
            
        case 'CheckpointLoaderSimple':
        case 'CheckpointLoader':
        case 'Checkpoint Loader (Simple)':
            if (widgets[0] !== undefined) parameters.ckpt_name = widgets[0];
            break;
            
        case 'VAELoader':
            if (widgets[0] !== undefined) parameters.vae_name = widgets[0];
            break;
            
        case 'ControlNetLoader':
            if (widgets[0] !== undefined) parameters.control_net_name = widgets[0];
            break;
            
        case 'LoraLoader':
        case 'LoraLoaderModelOnly':
            if (widgets[0] !== undefined) parameters.lora_name = widgets[0];
            if (widgets[1] !== undefined) parameters.strength_model = widgets[1];
            if (widgets[2] !== undefined) parameters.strength_clip = widgets[2];
            break;
            
        case 'LoraTagLoader':
            if (widgets[0] !== undefined) parameters.text = widgets[0];
            break;
            
        case 'LoadImage':
            if (widgets[0] !== undefined) parameters.image = widgets[0];
            if (widgets[1] !== undefined) parameters.upload = widgets[1];
            break;
            
        // 通用文本节点
        default:
            if (nodeType.includes('Text') && widgets[0] !== undefined) {
                parameters.text = widgets[0];
            }
            
            // 通用数值参数
            if (widgets[0] !== undefined && typeof widgets[0] === 'number') {
                parameters.value = widgets[0];
            }
            
            // 通用字符串参数
            if (widgets[0] !== undefined && typeof widgets[0] === 'string') {
                parameters.text = widgets[0];
            }
            
            // 多参数处理
            widgets.forEach((widget, index) => {
                if (widget !== undefined && widget !== null) {
                    const key = `param_${index}`;
                    if (typeof widget === 'string') {
                        parameters[key] = widget;
                    } else if (typeof widget === 'number') {
                        parameters[key] = widget;
                    } else if (typeof widget === 'boolean') {
                        parameters[key] = widget;
                    }
                }
            });
    }
    
    return parameters;
}

// 智能参数修改器
function createSmartParameterModifier(nodeType, parameters) {
    return (originalParams) => {
        const modifiedParams = { ...originalParams };
        
        // 应用新的参数
        Object.keys(parameters).forEach(key => {
            modifiedParams[key] = parameters[key];
        });
        
        return modifiedParams;
    };
}

// 通用节点转换器
function convertNodeToUniversalFormat(node) {
    const nodeType = node.type;
    const nodeId = String(node.id);
    
    // 过滤掉不需要执行的节点类型
    const nonExecutableNodeTypes = ['Note', 'Reroute', 'PrimitiveNode'];
    if (nonExecutableNodeTypes.includes(nodeType)) {
        return null; // 返回null表示这个节点应该被过滤掉
    }
    
    // 生成智能标题
    const title = generateSmartNodeTitle(nodeType, node.widgets_values);
    
    // 提取智能参数
    const parameters = extractSmartParameters(nodeType, node.widgets_values);
    
    // 创建通用格式节点
    const universalNode = {
        class_type: nodeType,
        inputs: parameters,
        _meta: {
            title: title,
            original_type: nodeType,
            node_id: nodeId,
            display_name: node.properties?.['Node name for S&R'] || nodeType
        }
    };
    
    // 处理输入连接
    if (node.inputs) {
        node.inputs.forEach(input => {
            if (input.link !== null) {
                // 连接信息将在后续处理中添加
                // 但不要覆盖已从widgets_values提取的参数
                if (!universalNode.inputs.hasOwnProperty(input.name)) {
                    universalNode.inputs[input.name] = `[连接:${input.link}]`;
                }
            }
        });
    }
    
    return universalNode;
}

// 批量转换工作流
function convertWorkflowToUniversalFormat(fullWorkflow) {
    const universalWorkflow = {};
    const nodeIdMapping = {}; // 用于跟踪节点ID的映射（过滤掉某些节点后）
    
    // 处理所有节点
    fullWorkflow.nodes.forEach(node => {
        const nodeId = String(node.id);
        const convertedNode = convertNodeToUniversalFormat(node);
        
        if (convertedNode) {
            universalWorkflow[nodeId] = convertedNode;
            nodeIdMapping[nodeId] = nodeId; // 保持ID映射
        } else {
            console.log(`[UniversalAdapter] 过滤节点: ${nodeId} (${node.type})`);
        }
    });
    
    // 处理连接
    fullWorkflow.links.forEach(link => {
        const [linkId, sourceNodeId, sourceSlotIndex, targetNodeId, targetSlotIndex] = link;
        
        const sourceId = String(sourceNodeId);
        const targetId = String(targetNodeId);
        
        // 检查源节点和目标节点是否都存在
        if (nodeIdMapping[sourceId] && nodeIdMapping[targetId]) {
            const targetNode = universalWorkflow[targetId];
            if (targetNode) {
                // 找到对应的输入名称
                const inputName = findInputName(targetNode, targetSlotIndex);
                if (inputName) {
                    targetNode.inputs[inputName] = [sourceId, sourceSlotIndex];
                }
            }
        } else {
            console.log(`[UniversalAdapter] 跳过链接: ${sourceId} -> ${targetId} (节点被过滤)`);
        }
    });
    
    return universalWorkflow;
}

// 查找输入名称
function findInputName(node, slotIndex) {
    // 根据节点类型确定输入名称
    switch (node.class_type) {
        case 'CLIPTextEncode':
            return 'clip';  // CLIPTextEncode只有一个clip输入，text来自widgets_values
        case 'CLIPSetLastLayer':
            return 'clip';
        case 'VAEDecode':
            return slotIndex === 0 ? 'samples' : 'vae';
        case 'VAEEncode':
            return slotIndex === 0 ? 'pixels' : 'vae';
        case 'CheckpointLoaderSimple':
        case 'CheckpointLoader':
        case 'Checkpoint Loader (Simple)':
            return slotIndex === 0 ? 'ckpt_name' : 'model';
        case 'VAELoader':
            return 'vae_name';
        case 'LoraLoader':
            return slotIndex === 0 ? 'model' : slotIndex === 1 ? 'clip' : 'lora_name';
        case 'KSampler':
        case 'KSamplerAdvanced':
            return ['model', 'positive', 'negative', 'latent_image', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise', 'vae'][slotIndex];
        case 'EmptyLatentImage':
            return ['width', 'height', 'batch_size'][slotIndex];
        case 'SaveImage':
        case 'PreviewImage':
            return slotIndex === 0 ? 'images' : 'filename_prefix';
        case 'LoadImage':
            return 'image';
        case 'ControlNetLoader':
            return 'control_net_name';
        case 'ControlNetApply':
            return ['conditioning', 'clip', 'image', 'strength'][slotIndex];
        default:
            // 通用输入名称
            const commonInputs = ['model', 'clip', 'vae', 'positive', 'negative', 'latent_image', 'image'];
            if (slotIndex < commonInputs.length) {
                return commonInputs[slotIndex];
            }
            return `input_${slotIndex}`;
    }
}

// 动态节点类型发现
function discoverNodeTypes(workflow) {
    const nodeTypes = new Set();
    
    workflow.nodes.forEach(node => {
        nodeTypes.add(node.type);
    });
    
    return Array.from(nodeTypes).sort();
}

// 生成节点类型报告
function generateNodeTypeReport(workflow) {
    const nodeTypes = discoverNodeTypes(workflow);
    const typeCount = {};
    
    workflow.nodes.forEach(node => {
        typeCount[node.type] = (typeCount[node.type] || 0) + 1;
    });
    
    const report = {
        total_nodes: workflow.nodes.length,
        total_types: nodeTypes.length,
        total_links: workflow.links.length,
        node_types: nodeTypes,
        type_statistics: typeCount,
        supported_types: nodeTypes.filter(type => 
            Object.keys(baseNodeMappings).includes(type) ||
            Object.keys(customNodePrefixes).some(prefix => type.startsWith(prefix))
        ),
        unsupported_types: nodeTypes.filter(type => 
            !Object.keys(baseNodeMappings).includes(type) &&
            !Object.keys(customNodePrefixes).some(prefix => type.startsWith(prefix))
        )
    };
    
    return report;
}

module.exports = {
    generateSmartNodeTitle,
    extractSmartParameters,
    createSmartParameterModifier,
    convertNodeToUniversalFormat,
    convertWorkflowToUniversalFormat,
    discoverNodeTypes,
    generateNodeTypeReport,
    baseNodeMappings,
    customNodePrefixes
};