#!/usr/bin/env node

/**
 * ComfyUI 增强智能模型匹配功能测试
 * 验证增强后的智能模型名称匹配功能
 */

const fs = require('fs').promises;
const path = require('path');

// 模拟的可用选项（更多样化的数据）
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

// 增强的测试用例
const testCases = [
    // 基础测试
    {
        name: '模型名称精确匹配',
        type: 'model',
        requested: 'realisticVisionV51_v51VAE.safetensors',
        expected: 'realisticVisionV51_v51VAE.safetensors'
    },
    {
        name: '模型名称部分匹配',
        type: 'model',
        requested: 'realistic',
        expected: 'realisticVisionV51_v51VAE.safetensors'
    },
    {
        name: '模型名称版本匹配',
        type: 'model',
        requested: 'v5',
        expected: 'realisticVisionV51_v51VAE.safetensors'
    },
    {
        name: '模型名称关键词匹配',
        type: 'model',
        requested: 'epic',
        expected: 'epicrealism_pureEvolutionV5.safetensors'
    },
    // 复杂测试
    {
        name: '模型名称复杂匹配',
        type: 'model',
        requested: 'deliberate',
        expected: 'deliberate_v3.safetensors'
    },
    {
        name: '模型名称XL匹配',
        type: 'model',
        requested: 'XL',
        expected: 'SDXL-Base-1.0.safetensors'
    },
    {
        name: '模型名称Juggernaut匹配',
        type: 'model',
        requested: 'juggernaut',
        expected: 'Juggernaut-XL_v9.safetensors'
    },
    // LoRA测试
    {
        name: 'LoRA名称增强匹配',
        type: 'lora',
        requested: 'epicrealism-enhanced',
        expected: 'epicrealism-enhanced_lora.safetensors'
    },
    {
        name: 'LoRA名称细节匹配',
        type: 'lora',
        requested: 'detail',
        expected: 'realisticVision-detail_lora.safetensors'
    },
    // VAE测试
    {
        name: 'VAE名称MSE匹配',
        type: 'vae',
        requested: 'mse',
        expected: 'vae-ft-mse-840000-ema-pruned.safetensors'
    },
    {
        name: 'VAE名称SDXL匹配',
        type: 'vae',
        requested: 'sdxl',
        expected: 'sdxl_vae.safetensors'
    },
    // ControlNet测试
    {
        name: 'ControlNet名称scribble匹配',
        type: 'controlnet',
        requested: 'scribble',
        expected: 'control_scribble-fp16.safetensors'
    },
    // 边界测试
    {
        name: '不存在模型',
        type: 'model',
        requested: 'nonexistent_model_v999',
        expected: null
    },
    {
        name: '过低分数匹配',
        type: 'model',
        requested: 'xyz',
        expected: null
    }
];

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
    
    console.log(`[Test] ${itemType} '${requested}' 不存在，尝试智能匹配...`);
    
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
        console.log(`[Test] 找到最佳${itemType}匹配: ${bestMatch.item} (分数: ${bestMatch.score.toFixed(1)}, 相似度: ${bestMatch.similarity.toFixed(3)})`);
        
        // 如果有多个匹配，显示前几个选项
        if (matches.length > 1) {
            console.log(`[Test] 其他${itemType}匹配选项:`);
            matches.slice(1, 3).forEach(match => {
                console.log(`  - ${match.item} (分数: ${match.score.toFixed(1)}, 相似度: ${match.similarity.toFixed(3)})`);
            });
        }
        
        // 只有当分数足够高时才返回匹配
        if (bestMatch.score >= 50) {
            return bestMatch.item;
        } else {
            console.log(`[Test] 最佳匹配分数过低 (${bestMatch.score.toFixed(1)}), 需要更精确的匹配`);
        }
    }
    
    // 没有找到匹配
    console.log(`[Test] 未找到匹配的${itemType}`);
    return null;
}

// 运行测试
async function runTests() {
    console.log('🚀 开始ComfyUI增强智能模型匹配功能测试...\n');
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
        console.log(`📋 测试: ${testCase.name}`);
        console.log(`   请求: ${testCase.requested}`);
        console.log(`   类型: ${testCase.type}`);
        
        const availableItems = mockAvailableOptions[testCase.type] || [];
        const result = await findBestMatch(testCase.requested, availableItems, testCase.type);
        
        console.log(`   期望: ${testCase.expected}`);
        console.log(`   实际: ${result}`);
        
        if (result === testCase.expected) {
            console.log('   ✅ 测试通过\n');
            passedTests++;
        } else {
            console.log('   ❌ 测试失败\n');
        }
    }
    
    console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有测试通过！增强智能模型匹配功能正常工作。');
    } else {
        console.log('⚠️  部分测试失败，需要进一步优化。');
    }
    
    // 性能测试
    console.log('\n⚡ 性能测试:');
    const performanceTestCases = [
        { type: 'model', requested: 'realistic' },
        { type: 'lora', requested: 'epic' },
        { type: 'vae', requested: 'mse' },
        { type: 'controlnet', requested: 'canny' }
    ];
    
    for (const test of performanceTestCases) {
        const availableItems = mockAvailableOptions[test.type] || [];
        const startTime = Date.now();
        
        for (let i = 0; i < 1000; i++) {
            await findBestMatch(test.requested, availableItems, test.type);
        }
        
        const endTime = Date.now();
        const avgTime = (endTime - startTime) / 1000;
        console.log(`   ${test.type} '${test.requested}': 平均 ${avgTime.toFixed(2)}ms/次`);
    }
    
    console.log('\n🎯 增强智能匹配功能测试完成！');
}

// 运行主函数
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    findBestMatch,
    calculateLevenshteinDistance,
    runTests
};