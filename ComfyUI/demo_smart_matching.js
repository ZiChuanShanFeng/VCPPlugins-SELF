#!/usr/bin/env node

/**
 * ComfyUI 智能模型匹配功能演示
 * 展示增强后的智能模型名称匹配功能
 */

const fs = require('fs').promises;
const path = require('path');

// 模拟的可用选项
const mockAvailableOptions = {
    model: [
        'realisticVisionV51_v51VAE.safetensors',
        'epicrealism_pureEvolutionV5.safetensors',
        'realisticVisionV60B1_v60B1VAE.safetensors',
        'deliberate_v3.safetensors',
        'dreamshaper_8.safetensors',
        'v1-5-pruned-emaonly.safetensors',
        'SDXL-Base-1.0.safetensors',
        'Juggernaut-XL_v9.safetensors',
        'realisticVisionV40_v40VAE.safetensors',
        'epicrealism_naturalSinRC1VAE.safetensors'
    ],
    lora: [
        'epicrealism_lora.safetensors',
        'realisticVision_lora.safetensors',
        'style_lora.safetensors',
        'character_lora.safetensors',
        'epicrealism-enhanced_lora.safetensors',
        'realisticVision-detail_lora.safetensors'
    ],
    vae: [
        'vae-ft-mse-840000-ema-pruned.safetensors',
        'sdxl_vae.safetensors',
        'vae-ft-ema-560000-ema-pruned.safetensors'
    ],
    controlnet: [
        'control_canny-fp16.safetensors',
        'control_depth-fp16.safetensors',
        'control_openpose-fp16.safetensors',
        'control_scribble-fp16.safetensors'
    ]
};

// Levenshtein距离计算
function calculateLevenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    
    return matrix[str2.length][str1.length];
}

// 增强的智能匹配函数
async function findBestMatch(requested, availableItems, itemType = 'item') {
    // 检查是否存在精确匹配
    if (availableItems.includes(requested)) {
        return requested;
    }
    
    console.log(`🔍 ${itemType} '${requested}' 不存在，尝试智能匹配...`);
    
    const requestedLower = requested.toLowerCase();
    const matches = [];
    
    for (const item of availableItems) {
        const itemLower = item.toLowerCase();
        let score = 0;
        
        // 完全匹配（忽略大小写）
        if (itemLower === requestedLower) score += 100;
        
        // 包含匹配
        if (itemLower.includes(requestedLower) || requestedLower.includes(itemLower)) score += 50;
        
        // 拼写相似度
        const distance = calculateLevenshteinDistance(itemLower, requestedLower);
        const maxLength = Math.max(itemLower.length, requestedLower.length);
        const similarity = 1 - (distance / maxLength);
        score += similarity * 30;
        
        // 文件名特定匹配（针对模型文件）
        if (itemType === 'model') {
            // 移除扩展名进行比较
            const itemNoExt = itemLower.replace(/\.(safetensors|ckpt|pt|pth|bin)$/i, '');
            const requestedNoExt = requestedLower.replace(/\.(safetensors|ckpt|pt|pth|bin)$/i, '');
            
            if (itemNoExt === requestedNoExt) score += 80;
            if (itemNoExt.includes(requestedNoExt) || requestedNoExt.includes(itemNoExt)) score += 40;
            
            // 版本号匹配
            const versionMatch = itemNoExt.match(/v\d+(\.\d+)*/);
            const versionMatchRequested = requestedNoExt.match(/v\d+(\.\d+)*/);
            if (versionMatch && versionMatchRequested && versionMatch[0] === versionMatchRequested[0]) {
                score += 25;
            }
            
            // 增强的关键词匹配
            const modelKeywords = [
                'sd', 'xl', 'base', 'refiner', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6',
                'anime', 'realistic', 'realistic', 'checkpoint', 'real', 'vision', 'epic', 'deliberate',
                'dreamshaper', 'juggernaut', 'realisticvision', 'epicrealism'
            ];
            for (const keyword of modelKeywords) {
                if (itemNoExt.includes(keyword) && requestedNoExt.includes(keyword)) {
                    score += 15;
                }
            }
        }
        
        // LoRA特定匹配
        if (itemType === 'lora') {
            const itemNoExt = itemLower.replace(/\.(safetensors|pt|pth)$/i, '');
            const requestedNoExt = requestedLower.replace(/\.(safetensors|pt|pth)$/i, '');
            
            if (itemNoExt === requestedNoExt) score += 80;
            if (itemNoExt.includes(requestedNoExt) || requestedNoExt.includes(itemNoExt)) score += 40;
            
            // LoRA关键词匹配
            const loraKeywords = ['lora', 'style', 'character', 'concept', 'clothing', 'epic', 'realistic'];
            for (const keyword of loraKeywords) {
                if (itemNoExt.includes(keyword) && requestedNoExt.includes(keyword)) {
                    score += 15;
                }
            }
        }
        
        // VAE特定匹配
        if (itemType === 'vae') {
            const itemNoExt = itemLower.replace(/\.(safetensors|ckpt|pt|pth)$/i, '');
            const requestedNoExt = requestedLower.replace(/\.(safetensors|ckpt|pt|pth)$/i, '');
            
            if (itemNoExt === requestedNoExt) score += 80;
            if (itemNoExt.includes(requestedNoExt) || requestedNoExt.includes(itemNoExt)) score += 40;
            
            // VAE关键词匹配
            const vaeKeywords = ['vae', 'mse', 'ema', 'pruned', 'ft', 'sdxl'];
            for (const keyword of vaeKeywords) {
                if (itemNoExt.includes(keyword) && requestedNoExt.includes(keyword)) {
                    score += 15;
                }
            }
        }
        
        // ControlNet特定匹配
        if (itemType === 'controlnet') {
            const itemNoExt = itemLower.replace(/\.(safetensors|pt|pth)$/i, '');
            const requestedNoExt = requestedLower.replace(/\.(safetensors|pt|pth)$/i, '');
            
            if (itemNoExt === requestedNoExt) score += 80;
            if (itemNoExt.includes(requestedNoExt) || requestedNoExt.includes(itemNoExt)) score += 40;
            
            // ControlNet关键词匹配
            const controlnetKeywords = ['control', 'canny', 'depth', 'openpose', 'scribble', 'mlsd'];
            for (const keyword of controlnetKeywords) {
                if (itemNoExt.includes(keyword) && requestedNoExt.includes(keyword)) {
                    score += 15;
                }
            }
        }
        
        if (score > 0) {
            matches.push({ item, score, similarity });
        }
    }
    
    // 按分数排序
    matches.sort((a, b) => b.score - a.score);
    
    if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log(`✅ 找到最佳${itemType}匹配: ${bestMatch.item} (分数: ${bestMatch.score.toFixed(1)}, 相似度: ${bestMatch.similarity.toFixed(3)})`);
        
        // 如果有多个匹配，显示前几个选项
        if (matches.length > 1) {
            console.log(`🔀 其他${itemType}匹配选项:`);
            matches.slice(1, 3).forEach(match => {
                console.log(`   - ${match.item} (分数: ${match.score.toFixed(1)}, 相似度: ${match.similarity.toFixed(3)})`);
            });
        }
        
        // 只有当分数足够高时才返回匹配
        if (bestMatch.score >= 50) {
            return bestMatch.item;
        } else {
            console.log(`⚠️ 最佳匹配分数过低 (${bestMatch.score.toFixed(1)}), 需要更精确的匹配`);
        }
    }
    
    // 没有找到匹配
    console.log(`❌ 未找到匹配的${itemType}`);
    return null;
}

// 演示功能
async function demonstrateSmartMatching() {
    console.log('🎨 ComfyUI 智能模型匹配功能演示\n');
    
    const demoCases = [
        { type: 'model', requested: 'realistic', description: ' realisticVision 系列模型匹配' },
        { type: 'model', requested: 'v5', description: '版本号匹配' },
        { type: 'model', requested: 'epic', description: 'epicrealism 系列模型匹配' },
        { type: 'model', requested: 'juggernaut', description: '特定模型名称匹配' },
        { type: 'lora', requested: 'detail', description: 'LoRA 细节增强匹配' },
        { type: 'vae', requested: 'mse', description: 'VAE MSE类型匹配' },
        { type: 'controlnet', requested: 'canny', description: 'ControlNet canny类型匹配' },
        { type: 'model', requested: 'nonexistent', description: '不存在的模型（演示错误处理）' }
    ];
    
    for (const demo of demoCases) {
        console.log(`📋 ${demo.description}`);
        console.log(`   请求: ${demo.requested} (${demo.type})`);
        
        const availableItems = mockAvailableOptions[demo.type] || [];
        const result = await findBestMatch(demo.requested, availableItems, demo.type);
        
        if (result) {
            console.log(`   ✅ 成功匹配: ${result}\n`);
        } else {
            console.log(`   ❌ 匹配失败\n`);
        }
    }
    
    console.log('🎯 智能匹配功能演示完成！');
    console.log('\n💡 智能匹配特性:');
    console.log('   • 精确匹配（100分）');
    console.log('   • 包含匹配（50分）');
    console.log('   • 拼写相似度（30分）');
    console.log('   • 版本号匹配（25分）');
    console.log('   • 关键词匹配（15分）');
    console.log('   • 扩展名处理（80分）');
    console.log('   • 最低匹配阈值（50分）');
}

// 运行演示
if (require.main === module) {
    demonstrateSmartMatching().catch(console.error);
}

module.exports = {
    findBestMatch,
    calculateLevenshteinDistance,
    demonstrateSmartMatching
};