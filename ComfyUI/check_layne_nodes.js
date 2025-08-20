#!/usr/bin/env node

/**
 * 检查莱恩工作流中的Note节点引用问题
 */

const fs = require('fs').promises;
const path = require('path');

async function checkLayneWorkflowNodes() {
    try {
        console.log('=== 检查莱恩工作流节点引用问题 ===\n');
        
        // 读取莱恩工作流
        const workflowPath = path.join(__dirname, 'workflows', '莱恩文生图全功能模组.json');
        const content = await fs.readFile(workflowPath, 'utf-8');
        const workflow = JSON.parse(content);
        
        console.log('📋 工作流结构分析:');
        console.log('- 有nodes数组:', !!workflow.nodes);
        console.log('- 有prompt对象:', !!workflow.prompt);
        console.log('- 节点总数:', workflow.nodes?.length || 0);
        
        if (workflow.nodes) {
            // 查找所有节点类型
            const nodeTypes = new Set();
            const nodeIds = new Set();
            
            workflow.nodes.forEach(node => {
                nodeTypes.add(node.type);
                nodeIds.add(node.id);
            });
            
            console.log('\n📊 节点类型统计:');
            Array.from(nodeTypes).sort().forEach(type => {
                const count = workflow.nodes.filter(n => n.type === type).length;
                console.log(`  ${type}: ${count}`);
            });
            
            console.log('\n🔍 查找Note节点:');
            const noteNodes = workflow.nodes.filter(node => node.type === 'Note');
            console.log(`找到 ${noteNodes.length} 个Note节点:`);
            noteNodes.forEach(node => {
                console.log(`  节点 ${node.id}: "${node.widgets_values?.[0] || 'empty'}"`);
            });
            
            // 检查是否有对Note节点的引用
            console.log('\n🔍 检查节点间的引用:');
            workflow.nodes.forEach(node => {
                // 检查inputs中是否有对Note节点的引用
                if (node.inputs) {
                    node.inputs.forEach(input => {
                        if (input.link !== null) {
                            // 查找这个链接指向的节点
                            const link = workflow.links.find(l => l[0] === input.link);
                            if (link) {
                                const targetNodeId = link[1];
                                const targetNode = workflow.nodes.find(n => n.id === targetNodeId);
                                if (targetNode && targetNode.type === 'Note') {
                                    console.log(`⚠️  节点 ${node.id} (${node.type}) 引用了Note节点 ${targetNodeId}`);
                                }
                            }
                        }
                    });
                }
                
                // 检查widgets_values中是否有对Note节点的引用
                if (node.widgets_values) {
                    node.widgets_values.forEach((value, index) => {
                        if (typeof value === 'string' && value.includes('#')) {
                            // 可能是节点ID引用
                            const nodeIdMatch = value.match(/#(\d+)/);
                            if (nodeIdMatch) {
                                const referencedId = parseInt(nodeIdMatch[1]);
                                const referencedNode = workflow.nodes.find(n => n.id === referencedId);
                                if (referencedNode) {
                                    console.log(`📝 节点 ${node.id} (${node.type}) widgets_values[${index}] 引用节点 ${referencedId} (${referencedNode.type})`);
                                } else {
                                    console.log(`❌ 节点 ${node.id} (${node.type}) widgets_values[${index}] 引用不存在的节点 ${referencedId}`);
                                }
                            }
                        }
                    });
                }
            });
            
            // 检查所有链接的有效性
            console.log('\n🔗 检查链接有效性:');
            workflow.links.forEach((link, index) => {
                const [linkId, sourceNodeId, sourceSlotIndex, targetNodeId, targetSlotIndex] = link;
                
                const sourceNode = workflow.nodes.find(n => n.id === sourceNodeId);
                const targetNode = workflow.nodes.find(n => n.id === targetNodeId);
                
                if (!sourceNode) {
                    console.log(`❌ 链接 ${index}: 源节点 ${sourceNodeId} 不存在`);
                }
                if (!targetNode) {
                    console.log(`❌ 链接 ${index}: 目标节点 ${targetNodeId} 不存在`);
                }
                if (sourceNode && targetNode) {
                    console.log(`✅ 链接 ${index}: ${sourceNode.type}(${sourceNodeId}) -> ${targetNode.type}(${targetNodeId})`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        console.error(error.stack);
    }
}

checkLayneWorkflowNodes().catch(console.error);