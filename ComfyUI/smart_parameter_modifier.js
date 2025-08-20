// 智能参数修改器
// 能够智能地修改任何节点的参数

// 智能参数匹配器
function createSmartParameterMatcher(targetNode) {
    const nodeType = targetNode.class_type;
    const nodeTitle = targetNode._meta?.title || nodeType;
    
    return {
        // 检查是否匹配目标
        matches: (query) => {
            const q = query.toLowerCase();
            
            // 按节点类型匹配
            if (nodeType.toLowerCase().includes(q)) return true;
            if (nodeTitle.toLowerCase().includes(q)) return true;
            
            // 按功能匹配
            if (q.includes('prompt') && (
                nodeType.includes('TextEncode') || 
                nodeTitle.includes('Prompt') ||
                nodeTitle.includes('Text')
            )) return true;
            
            if (q.includes('sampler') && nodeType.includes('Sampler')) return true;
            if (q.includes('checkpoint') && nodeType.includes('Checkpoint')) return true;
            if (q.includes('vae') && nodeType.includes('VAE')) return true;
            if (q.includes('lora') && nodeType.includes('Lora')) return true;
            if (q.includes('control') && nodeType.includes('ControlNet')) return true;
            if (q.includes('seed') && (
                nodeType.includes('Sampler') || 
                nodeType.includes('Seed')
            )) return true;
            
            // 按参数名匹配
            for (const paramName in targetNode.inputs) {
                if (paramName.toLowerCase().includes(q)) return true;
            }
            
            return false;
        },
        
        // 获取可修改的参数
        getModifiableParams: () => {
            const params = [];
            
            for (const [paramName, paramValue] of Object.entries(targetNode.inputs)) {
                // 跳过连接引用
                if (Array.isArray(paramValue)) continue;
                
                params.push({
                    name: paramName,
                    value: paramValue,
                    type: typeof paramValue,
                    description: getParameterDescription(nodeType, paramName)
                });
            }
            
            return params;
        },
        
        // 应用参数修改
        modifyParams: (newParams) => {
            const modified = { ...targetNode.inputs };
            
            for (const [key, value] of Object.entries(newParams)) {
                // 智能参数名匹配
                const matchedKey = findBestParameterMatch(key, Object.keys(targetNode.inputs));
                if (matchedKey) {
                    modified[matchedKey] = value;
                    console.log(`[SmartModifier] 修改参数 ${matchedKey}: ${targetNode.inputs[matchedKey]} -> ${value}`);
                } else {
                    console.log(`[SmartModifier] 警告: 未找到匹配的参数名 '${key}'`);
                }
            }
            
            return modified;
        }
    };
}

// 获取参数描述
function getParameterDescription(nodeType, paramName) {
    const descriptions = {
        'text': '文本内容',
        'seed': '随机种子',
        'steps': '步数',
        'cfg': 'CFG值',
        'sampler_name': '采样器',
        'scheduler': '调度器',
        'denoise': '去噪强度',
        'width': '宽度',
        'height': '高度',
        'batch_size': '批大小',
        'ckpt_name': '模型文件',
        'vae_name': 'VAE文件',
        'control_net_name': 'ControlNet模型',
        'lora_name': 'LoRA文件',
        'strength_model': '模型强度',
        'strength_clip': 'CLIP强度',
        'filename_prefix': '文件名前缀'
    };
    
    return descriptions[paramName] || `${paramName} 参数`;
}

// 智能参数名匹配
function findBestParameterMatch(targetParam, availableParams, nodeType = null) {
    const target = targetParam.toLowerCase();
    
    // 精确匹配
    if (availableParams.includes(targetParam)) return targetParam;
    
    // 模糊匹配
    const paramMappings = {
        'text': ['text', 'prompt'],
        'seed': ['seed'],
        'steps': ['steps'],
        'cfg': ['cfg'],
        'sampler': ['sampler_name', 'sampler'],
        'scheduler': ['scheduler'],
        'denoise': ['denoise'],
        'width': ['width'],
        'height': ['height'],
        'batch': ['batch_size'],
        'checkpoint': ['ckpt_name'],
        'vae': ['vae_name'],
        'controlnet': ['control_net_name'],
        'lora': ['lora_name'],
        'strength': ['strength_model', 'strength_clip'],
        'prefix': ['filename_prefix']
    };
    
    // 特殊处理：防止将model参数映射到CLIPTextEncode节点
    if (target === 'model' && nodeType === 'CLIPTextEncode') {
        console.log('[SmartModifier] 警告: CLIPTextEncode节点不支持model参数，跳过映射');
        return null;
    }
    
    // 对于model参数，只允许在特定的节点类型中使用
    if (target === 'model' && nodeType && !['CheckpointLoaderSimple', 'CheckpointLoader', 'LoraLoader'].includes(nodeType)) {
        console.log(`[SmartModifier] 警告: ${nodeType}节点不支持model参数，跳过映射`);
        return null;
    }
    
    for (const [key, possibleMatches] of Object.entries(paramMappings)) {
        if (target.includes(key)) {
            for (const match of possibleMatches) {
                if (availableParams.includes(match)) return match;
            }
        }
    }
    
    // 部分匹配
    for (const param of availableParams) {
        if (param.toLowerCase().includes(target) || target.includes(param.toLowerCase())) {
            return param;
        }
    }
    
    return null;
}

// 智能节点查找器
function findNodesSmartly(prompt, query) {
    const results = [];
    const q = query.toLowerCase();
    
    for (const [nodeId, node] of Object.entries(prompt)) {
        const matcher = createSmartParameterMatcher(node);
        
        if (matcher.matches(q)) {
            results.push({
                nodeId,
                node,
                matcher,
                relevance: calculateRelevance(node, q)
            });
        }
    }
    
    // 按相关性排序
    return results.sort((a, b) => b.relevance - a.relevance);
}

// 计算相关性
function calculateRelevance(node, query) {
    const q = query.toLowerCase();
    const nodeType = node.class_type.toLowerCase();
    const nodeTitle = (node._meta?.title || '').toLowerCase();
    
    let score = 0;
    
    // 完全匹配
    if (nodeType === q) score += 100;
    if (nodeTitle === q) score += 100;
    
    // 部分匹配
    if (nodeType.includes(q)) score += 50;
    if (nodeTitle.includes(q)) score += 50;
    if (q.includes(nodeType)) score += 30;
    if (q.includes(nodeTitle)) score += 30;
    
    // 参数匹配
    for (const paramName in node.inputs) {
        if (paramName.toLowerCase().includes(q)) score += 20;
    }
    
    // 特殊加分
    if (q.includes('positive') && nodeTitle.includes('positive')) score += 40;
    if (q.includes('negative') && nodeTitle.includes('negative')) score += 40;
    if (q.includes('prompt') && nodeType.includes('text')) score += 30;
    
    return score;
}

// 智能参数修改器
function createSmartParameterModifier(prompt) {
    return {
        // 查找节点
        findNodes: (query) => findNodesSmartly(prompt, query),
        
        // 修改节点参数
        modifyNode: (query, newParams) => {
            const nodes = findNodesSmartly(prompt, query);
            
            if (nodes.length === 0) {
                throw new Error(`未找到匹配的节点: ${query}`);
            }
            
            // 选择最佳匹配
            const targetNode = nodes[0];
            console.log(`[SmartModifier] 找到节点: ${targetNode.nodeId} (${targetNode.node._meta.title})`);
            
            // 修改参数
            const modifiedInputs = targetNode.matcher.modifyParams(newParams);
            targetNode.node.inputs = modifiedInputs;
            
            return {
                nodeId: targetNode.nodeId,
                nodeTitle: targetNode.node._meta.title,
                modifiedParams: newParams
            };
        },
        
        // 批量修改
        modifyMultiple: (modifications) => {
            const results = [];
            
            for (const { query, params } of modifications) {
                try {
                    const result = modifyNode(query, params);
                    results.push({ success: true, ...result });
                } catch (error) {
                    results.push({ success: false, query, error: error.message });
                }
            }
            
            return results;
        },
        
        // 获取所有可修改的节点
        getAllModifiableNodes: () => {
            const nodes = [];
            
            for (const [nodeId, node] of Object.entries(prompt)) {
                const matcher = createSmartParameterMatcher(node);
                const modifiableParams = matcher.getModifiableParams();
                
                if (modifiableParams.length > 0) {
                    nodes.push({
                        nodeId,
                        nodeTitle: node._meta.title,
                        nodeType: node.class_type,
                        modifiableParams
                    });
                }
            }
            
            return nodes;
        }
    };
}

// 导出函数
module.exports = {
    createSmartParameterMatcher,
    createSmartParameterModifier,
    findNodesSmartly,
    findBestParameterMatch
};