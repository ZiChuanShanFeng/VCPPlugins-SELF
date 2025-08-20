#!/usr/bin/env node

/**
 * ComfyUI 工作流修复工具
 * 修复 CLIPTextEncode 节点的参数问题
 */

const fs = require('fs').promises;
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, 'workflows');

// 检查和修复 CLIPTextEncode 节点
function fixCLIPTextEncodeNode(node) {
    if (node.class_type === 'CLIPTextEncode') {
        console.log('🔧 检查 CLIPTextEncode 节点...');
        
        // 确保 inputs 对象存在
        if (!node.inputs) {
            node.inputs = {};
        }
        
        // 确保 text 参数存在
        if (!node.inputs.text) {
            node.inputs.text = '';
        }
        
        // 确保 clip 参数存在且格式正确
        if (!node.inputs.clip) {
            node.inputs.clip = ['4', 1];
        } else if (Array.isArray(node.inputs.clip)) {
            // 确保 clip 数组格式正确
            if (node.inputs.clip.length !== 2) {
                node.inputs.clip = ['4', 1];
            }
        } else {
            // 如果 clip 不是数组，转换为数组格式
            node.inputs.clip = ['4', 1];
        }
        
        // 移除任何不正确的参数
        const invalidParams = ['model', 'name', 'prompt'];
        for (const param of invalidParams) {
            if (node.inputs.hasOwnProperty(param)) {
                console.log(`⚠️  移除无效参数: ${param}`);
                delete node.inputs[param];
            }
        }
        
        console.log('✅ CLIPTextEncode 节点已修复');
    }
    
    return node;
}

// 修复工作流文件
async function fixWorkflowFile(filePath) {
    try {
        console.log(`📁 处理文件: ${path.basename(filePath)}`);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const workflow = JSON.parse(content);
        
        let fixed = false;
        
        // 处理 API 格式的工作流
        if (workflow.prompt) {
            console.log('🔍 检测到 API 格式工作流');
            for (const nodeId in workflow.prompt) {
                const node = workflow.prompt[nodeId];
                const originalNode = JSON.stringify(node);
                const fixedNode = fixCLIPTextEncodeNode(node);
                if (originalNode !== JSON.stringify(fixedNode)) {
                    fixed = true;
                }
            }
        } 
        // 处理完整格式的工作流
        else if (workflow.nodes) {
            console.log('🔍 检测到完整格式工作流');
            for (const node of workflow.nodes) {
                if (node.type === 'CLIPTextEncode') {
                    // 将完整格式转换为 API 格式
                    if (!workflow.prompt) {
                        workflow.prompt = {};
                    }
                    
                    const nodeId = node.id.toString();
                    workflow.prompt[nodeId] = {
                        class_type: 'CLIPTextEncode',
                        inputs: {
                            text: node.widgets_values?.[0] || '',
                            clip: ['4', 1]
                        },
                        _meta: {
                            title: node.title || 'CLIPTextEncode'
                        }
                    };
                    
                    fixed = true;
                    console.log(`🔄 转换 CLIPTextEncode 节点 ${nodeId} 到 API 格式`);
                }
            }
        }
        // 处理直接的 API 格式
        else {
            console.log('🔍 检测到直接 API 格式工作流');
            for (const nodeId in workflow) {
                const node = workflow[nodeId];
                if (node.class_type === 'CLIPTextEncode') {
                    const originalNode = JSON.stringify(node);
                    const fixedNode = fixCLIPTextEncodeNode(node);
                    if (originalNode !== JSON.stringify(fixedNode)) {
                        fixed = true;
                    }
                }
            }
        }
        
        if (fixed) {
            await fs.writeFile(filePath, JSON.stringify(workflow, null, 2));
            console.log('✅ 文件已修复\n');
        } else {
            console.log('✅ 文件无需修复\n');
        }
        
    } catch (error) {
        console.error(`❌ 处理文件失败: ${error.message}\n`);
    }
}

// 主函数
async function main() {
    console.log('🛠️  ComfyUI 工作流修复工具\n');
    
    try {
        const files = await fs.readdir(WORKFLOW_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`📋 找到 ${jsonFiles.length} 个工作流文件\n`);
        
        for (const file of jsonFiles) {
            const filePath = path.join(WORKFLOW_DIR, file);
            await fixWorkflowFile(filePath);
        }
        
        console.log('🎉 工作流修复完成！');
        
    } catch (error) {
        console.error('❌ 修复失败:', error.message);
    }
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    fixCLIPTextEncodeNode,
    fixWorkflowFile
};