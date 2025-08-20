#!/usr/bin/env node

/**
 * 修复莱恩文生图全功能模组工作流文件
 */

const fs = require('fs').promises;
const path = require('path');

async function fixLayneWorkflow() {
    const filePath = path.join(__dirname, 'workflows', '莱恩文生图全功能模组.json');
    
    try {
        console.log('🔧 修复莱恩文生图全功能模组工作流...');
        
        const content = await fs.readFile(filePath, 'utf-8');
        const workflow = JSON.parse(content);
        
        // 确保有 prompt 对象
        if (!workflow.prompt) {
            workflow.prompt = {};
        }
        
        // 查找所有的 CLIPTextEncode 节点
        const clipTextEncodeNodes = workflow.nodes.filter(node => node.type === 'CLIPTextEncode');
        
        console.log(`🔍 找到 ${clipTextEncodeNodes.length} 个 CLIPTextEncode 节点`);
        
        for (const node of clipTextEncodeNodes) {
            const nodeId = node.id.toString();
            
            // 获取 text 内容，优先从 widgets_values[0] 获取
            let textContent = '';
            if (node.widgets_values && node.widgets_values.length > 0) {
                textContent = node.widgets_values[0] || '';
            }
            
            // 创建 API 格式的节点
            workflow.prompt[nodeId] = {
                class_type: 'CLIPTextEncode',
                inputs: {
                    text: textContent,
                    clip: ['4', 1]
                },
                _meta: {
                    title: node.title || 'CLIPTextEncode'
                }
            };
            
            console.log(`✅ 修复节点 ${nodeId}: "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}"`);
        }
        
        // 保存修复后的文件
        await fs.writeFile(filePath, JSON.stringify(workflow, null, 2));
        console.log('🎉 莱恩文生图全功能模组工作流修复完成！');
        
    } catch (error) {
        console.error('❌ 修复失败:', error.message);
    }
}

// 运行修复
if (require.main === module) {
    fixLayneWorkflow().catch(console.error);
}

module.exports = { fixLayneWorkflow };