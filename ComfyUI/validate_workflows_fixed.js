#!/usr/bin/env node

/**
 * ComfyUI 工作流验证工具 - 修复版
 * 验证修复后的工作流是否正常工作
 */

const fs = require('fs').promises;
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, 'workflows');

// 验证 CLIPTextEncode 节点
function validateCLIPTextEncodeNode(node, nodeId) {
    const errors = [];
    
    if (node.class_type !== 'CLIPTextEncode') {
        return errors;
    }
    
    // 确保 inputs 对象存在
    if (!node.inputs) {
        errors.push(`节点 ${nodeId} 缺少 inputs 对象`);
        return errors;
    }
    
    // 确保 text 参数存在（可以是空字符串）
    if (!node.inputs.hasOwnProperty('text')) {
        errors.push(`节点 ${nodeId} 缺少 text 参数`);
    }
    
    // 确保 clip 参数存在且格式正确
    if (!node.inputs.clip) {
        errors.push(`节点 ${nodeId} 缺少 clip 参数`);
    } else if (!Array.isArray(node.inputs.clip)) {
        errors.push(`节点 ${nodeId} 的 clip 参数不是数组`);
    } else if (node.inputs.clip.length !== 2) {
        errors.push(`节点 ${nodeId} 的 clip 参数数组长度不正确`);
    }
    
    // 移除任何不正确的参数
    const invalidParams = ['model', 'name', 'prompt'];
    for (const param of invalidParams) {
        if (node.inputs.hasOwnProperty(param)) {
            errors.push(`节点 ${nodeId} 包含无效参数: ${param}`);
        }
    }
    
    return errors;
}

// 验证工作流文件
async function validateWorkflowFile(filePath) {
    try {
        console.log(`🔍 验证文件: ${path.basename(filePath)}`);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const workflow = JSON.parse(content);
        
        const errors = [];
        let clipTextEncodeCount = 0;
        
        // 处理不同格式的工作流
        let nodes = {};
        
        if (workflow.prompt) {
            nodes = workflow.prompt;
        } else if (workflow.nodes) {
            // 如果是完整格式，检查是否有 prompt
            if (!workflow.prompt) {
                errors.push('完整格式工作流缺少 prompt 对象');
            } else {
                nodes = workflow.prompt;
            }
        } else {
            // 直接 API 格式
            nodes = workflow;
        }
        
        // 验证所有节点
        for (const nodeId in nodes) {
            const node = nodes[nodeId];
            const nodeErrors = validateCLIPTextEncodeNode(node, nodeId);
            errors.push(...nodeErrors);
            
            if (node.class_type === 'CLIPTextEncode') {
                clipTextEncodeCount++;
            }
        }
        
        if (errors.length === 0) {
            console.log(`✅ 文件验证成功 (包含 ${clipTextEncodeCount} 个 CLIPTextEncode 节点)\n`);
            return true;
        } else {
            console.log(`❌ 文件验证失败 (发现 ${errors.length} 个错误):`);
            errors.forEach(error => console.log(`   - ${error}`));
            console.log('');
            return false;
        }
        
    } catch (error) {
        console.error(`❌ 验证文件失败: ${error.message}\n`);
        return false;
    }
}

// 主函数
async function main() {
    console.log('🔬 ComfyUI 工作流验证工具 - 修复版\n');
    
    try {
        const files = await fs.readdir(WORKFLOW_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`📋 找到 ${jsonFiles.length} 个工作流文件\n`);
        
        let validFiles = 0;
        
        for (const file of jsonFiles) {
            const filePath = path.join(WORKFLOW_DIR, file);
            const isValid = await validateWorkflowFile(filePath);
            if (isValid) {
                validFiles++;
            }
        }
        
        console.log(`📊 验证结果: ${validFiles}/${jsonFiles.length} 个文件通过验证`);
        
        if (validFiles === jsonFiles.length) {
            console.log('🎉 所有工作流文件验证成功！');
        } else {
            console.log('⚠️  部分文件验证失败，需要进一步修复');
        }
        
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
    }
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    validateCLIPTextEncodeNode,
    validateWorkflowFile
};