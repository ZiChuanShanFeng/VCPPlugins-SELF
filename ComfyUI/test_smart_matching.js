#!/usr/bin/env node

/**
 * ComfyUI 智能模型匹配功能测试
 * 验证智能模型名称匹配功能
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
        'Juggernaut-XL_v9.safetensors'
    ],
    lora: [
        'epicrealism_lora.safetensors',
        'realisticVision_lora.safetensors',
        'style_lora.safetensors',
        'character_lora.safetensors'
    ],
    vae: [
        'vae-ft-mse-840000-ema-pruned.safetensors',
        'sdxl_vae.safetensors'
    ],
    controlnet: [
        'control_canny-fp16.safetensors',
        'control_depth-fp16.safetensors',
        'control_openpose-fp16.safetensors'
    ]
};

// 模拟的测试用例
const testCases = [
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
        name: '模型名称大小写不敏感匹配',
        type: 'model',
        requested: 'REALISTICVISIONV51_V51VAE.SAFETENSORS',
        expected: 'realisticVisionV51_v51VAE.safetensors'
    },
    {
        name: '模型名称拼写错误匹配',
        type: 'model',
        requested: 'realisticVisionV51_v51VAE',
        expected: 'realisticVisionV51_v51VAE.safetensors'
    },
    {
        name: 'LoRA名称智能匹配',
        type: 'lora',
        requested: 'epic',
        expected: 'epicrealism_lora.safetensors'
    },
    {
        name: 'VAE名称智能匹配',
        type: 'vae',
        requested: 'mse',
        expected: 'vae-ft-mse-840000-ema-pruned.safetensors'
    },
    {
        name: 'ControlNet名称智能匹配',
        type: 'controlnet',
        requested: 'canny',
        expected: 'control_canny-fp16.safetensors'
    },
    {
        name: '不存在模型的智能建议',
        type: 'model',
        requested: 'nonexistent_model',
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

// 智能匹配函数
function findBestMatch(requested, availableItems, itemType = 'item') {
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
        }
        
        // 关键词匹配
        const keywords = extractKeywords(requestedLower);
        for (const keyword of keywords) {
            if (itemLower.includes(keyword)) score += 15;
        }
        
        matches.push({ item, score, similarity });
    }
    
    // 按分数排序
    matches.sort((a, b) => b.score - a.score);
    
    // 输出调试信息
    console.log(`[Test] 匹配结果 for ${requested}:`);
    matches.slice(0, 3).forEach(match => {
        console.log(`  - ${match.item}: 分数=${match.score.toFixed(1)}, 相似度=${match.similarity.toFixed(3)}`);
    });
    
    // 返回最佳匹配（如果分数足够高）
    if (matches.length > 0 && matches[0].score >= 50) {
        return matches[0].item;
    }
    
    return null;
}

// 提取关键词
function extractKeywords(text) {
    // 移除常见后缀和前缀
    const cleanText = text.replace(/(_|\.|-|\s)/g, ' ');
    
    // 分割为单词
    const words = cleanText.split(/\s+/).filter(word => word.length > 2);
    
    // 移除常见停用词
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use'];
    
    return words.filter(word => !stopWords.includes(word.toLowerCase()));
}

// 运行测试
async function runTests() {
    console.log('🚀 开始ComfyUI智能模型匹配功能测试...\n');
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
        console.log(`📋 测试: ${testCase.name}`);
        console.log(`   请求: ${testCase.requested}`);
        console.log(`   类型: ${testCase.type}`);
        
        const availableItems = mockAvailableOptions[testCase.type] || [];
        const result = findBestMatch(testCase.requested, availableItems, testCase.type);
        
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
        console.log('🎉 所有测试通过！智能模型匹配功能正常工作。');
    } else {
        console.log('⚠️  部分测试失败，需要进一步优化。');
    }
    
    // 测试边界情况
    console.log('\n🔍 边界情况测试:');
    
    // 空列表测试
    const emptyResult = findBestMatch('test', [], 'model');
    console.log(`空列表测试: ${emptyResult === null ? '✅ 通过' : '❌ 失败'}`);
    
    // 特殊字符测试
    const specialCharsResult = findBestMatch('test@#$%', mockAvailableOptions.model, 'model');
    console.log(`特殊字符测试: ${specialCharsResult === null ? '✅ 通过' : '❌ 失败'}`);
    
    // 超长名称测试
    const longName = 'a'.repeat(100);
    const longNameResult = findBestMatch(longName, mockAvailableOptions.model, 'model');
    console.log(`超长名称测试: ${longNameResult === null ? '✅ 通过' : '❌ 失败'}`);
    
    console.log('\n🎯 智能匹配功能测试完成！');
}

// 运行主函数
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    findBestMatch,
    calculateLevenshteinDistance,
    extractKeywords,
    runTests
};