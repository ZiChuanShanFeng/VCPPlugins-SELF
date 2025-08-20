// ComfyUIself Hybrid 管理工具
const { ComfyUISelfHybrid } = require('./comfyui-self-hybrid');
const fs = require('fs').promises;
const path = require('path');

class ComfyUIselfManager {
    constructor() {
        this.hybrid = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        this.hybrid = new ComfyUISelfHybrid();
        this.initialized = true;
        console.log('[Manager] ComfyUIself Hybrid Manager initialized');
    }

    // ==================== 工作流管理 ====================
    
    async listWorkflows() {
        await this.initialize();
        
        const workflowDir = path.join(__dirname, 'workflows');
        const files = await fs.readdir(workflowDir);
        const workflows = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(workflowDir, file);
                const stats = await fs.stat(filePath);
                const content = await fs.readFile(filePath, 'utf8');
                const workflow = JSON.parse(content);
                
                const analysis = await this.hybrid.analyzeWorkflow(workflow);
                
                workflows.push({
                    name: file,
                    size: stats.size,
                    lastModified: stats.mtime,
                    complexity: analysis.complexity,
                    nodeCount: analysis.nodeCount,
                    hasAdvancedNodes: analysis.hasAdvancedNodes,
                    estimatedProcessingTime: this.estimateProcessingTime(analysis)
                });
            }
        }
        
        return workflows;
    }

    async analyzeWorkflow(workflowName) {
        await this.initialize();
        
        const workflowPath = path.join(__dirname, 'workflows', workflowName);
        const content = await fs.readFile(workflowPath, 'utf8');
        const workflow = JSON.parse(content);
        
        return this.hybrid.analyzeWorkflow(workflow);
    }

    estimateProcessingTime(analysis) {
        // 基于复杂度估算处理时间
        const baseTime = 10; // 基础时间10秒
        const complexityMultiplier = analysis.complexity || 0.5;
        const nodeMultiplier = analysis.nodeCount / 50;
        
        return Math.round(baseTime * (1 + complexityMultiplier + nodeMultiplier));
    }

    // ==================== 配置管理 ====================
    
    async getConfig() {
        await this.initialize();
        return this.hybrid.configManager.config;
    }

    async updateConfig(updates) {
        const config = this.hybrid.configManager.config;
        const updatedConfig = { ...config, ...updates };
        updatedConfig.lastUpdated = new Date().toISOString();
        
        const configPath = path.join(__dirname, 'comfyui-settings.json');
        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
        
        // 重新加载配置
        await this.hybrid.configManager.loadConfiguration();
        
        return updatedConfig;
    }

    async resetConfig() {
        const defaultConfig = {
            serverUrl: 'http://127.0.0.1:8188',
            defaultModel: 'anything-v5-PrtRE.safetensors',
            defaultWidth: 512,
            defaultHeight: 512,
            defaultSteps: 20,
            defaultCfg: 7.5,
            workflow: 'text2img_api.json',
            debugMode: false,
            version: '2.0.0',
            lastUpdated: new Date().toISOString()
        };
        
        return await this.updateConfig(defaultConfig);
    }

    // ==================== 执行管理 ====================
    
    async executeWithAnalysis(args) {
        await this.initialize();
        
        // 预分析
        const analysis = await this.preExecutionAnalysis(args);
        console.log('[Manager] Pre-execution analysis:', analysis);
        
        // 执行
        const result = await this.hybrid.execute(args);
        
        // 后分析
        const postAnalysis = await this.postExecutionAnalysis(result);
        console.log('[Manager] Post-execution analysis:', postAnalysis);
        
        return {
            ...result,
            analysis,
            postAnalysis
        };
    }

    async preExecutionAnalysis(args) {
        const workflowContext = await this.hybrid.selectAndLoadWorkflow(args);
        const mode = this.hybrid.selectProcessingMode(workflowContext, args);
        
        return {
            selectedWorkflow: workflowContext.name,
            workflowComplexity: workflowContext.analysis.complexity,
            processingMode: mode,
            estimatedTime: this.estimateProcessingTime(workflowContext.analysis),
            recommendations: this.generateRecommendations(workflowContext.analysis, args)
        };
    }

    async postExecutionAnalysis(result) {
        return {
            actualExecutionTime: result.stats?.duration || 0,
            modeUsed: result.mode,
            success: result.success,
            imageCount: result.result?.images?.length || 0,
            efficiency: this.calculateEfficiency(result)
        };
    }

    generateRecommendations(analysis, args) {
        const recommendations = [];
        
        if (analysis.complexity > 0.8) {
            recommendations.push('Consider simplifying the workflow for faster processing');
        }
        
        if (analysis.hasLoRANodes && !args.loras) {
            recommendations.push('Add LoRA parameters for enhanced style control');
        }
        
        if (analysis.nodeCount > 100) {
            recommendations.push('Large workflow detected, consider using template mode');
        }
        
        if (!analysis.hasAdvancedNodes && args.advanced_params) {
            recommendations.push('Advanced parameters specified but workflow lacks advanced nodes');
        }
        
        return recommendations;
    }

    calculateEfficiency(result) {
        if (!result.stats?.duration) return 0;
        
        const idealTime = 30; // 理想执行时间30秒
        const actualTime = result.stats.duration;
        
        return Math.max(0, Math.min(100, (idealTime / actualTime) * 100));
    }

    // ==================== 监控和统计 ====================
    
    async getSystemStats() {
        await this.initialize();
        
        const monitoring = this.hybrid.monitoring;
        const config = this.hybrid.configManager.config;
        
        return {
            execution: monitoring.getGlobalStats(),
            config: {
                serverUrl: config.serverUrl,
                defaultModel: config.defaultModel,
                defaultWorkflow: config.workflow,
                debugMode: config.debugMode
            },
            workflows: await this.listWorkflows(),
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };
    }

    async getExecutionHistory(limit = 50) {
        await this.initialize();
        
        const monitoring = this.hybrid.monitoring;
        const executions = Array.from(monitoring.executions.values())
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit);
        
        return executions.map(exec => ({
            id: exec.startTime,
            startTime: new Date(exec.startTime).toISOString(),
            endTime: exec.endTime ? new Date(exec.endTime).toISOString() : null,
            duration: exec.duration,
            status: exec.status,
            mode: exec.result?.mode,
            args: exec.args
        }));
    }

    // ==================== 优化建议 ====================
    
    async getOptimizationSuggestions() {
        await this.initialize();
        
        const stats = await this.getSystemStats();
        const suggestions = [];
        
        // 执行统计优化
        if (stats.execution.failedExecutions > stats.execution.successfulExecutions * 0.1) {
            suggestions.push({
                type: 'reliability',
                priority: 'high',
                title: 'High failure rate detected',
                description: 'Consider checking ComfyUI server connectivity and workflow validity',
                action: 'Check server logs and workflow configurations'
            });
        }
        
        if (stats.execution.averageExecutionTime > 120) {
            suggestions.push({
                type: 'performance',
                priority: 'medium',
                title: 'Slow execution times',
                description: 'Average execution time exceeds 2 minutes',
                action: 'Consider optimizing workflows or using template mode'
            });
        }
        
        // 模式使用优化
        const modeUsage = stats.execution.modeUsage;
        if (modeUsage.dynamic > modeUsage.template * 2) {
            suggestions.push({
                type: 'efficiency',
                priority: 'low',
                title: 'Consider using template mode more often',
                description: 'Dynamic mode is heavily used, template mode may be more efficient for complex workflows',
                action: 'Adjust mode thresholds in configuration'
            });
        }
        
        return suggestions;
    }

    // ==================== 测试和诊断 ====================
    
    async runDiagnostics() {
        await this.initialize();
        
        const diagnostics = {
            timestamp: new Date().toISOString(),
            tests: []
        };
        
        // 配置文件测试
        try {
            const config = await this.getConfig();
            diagnostics.tests.push({
                name: 'Configuration File',
                status: 'passed',
                message: 'Configuration loaded successfully'
            });
        } catch (error) {
            diagnostics.tests.push({
                name: 'Configuration File',
                status: 'failed',
                message: error.message
            });
        }
        
        // 工作流文件测试
        try {
            const workflows = await this.listWorkflows();
            diagnostics.tests.push({
                name: 'Workflow Files',
                status: 'passed',
                message: `${workflows.length} workflow files found`
            });
        } catch (error) {
            diagnostics.tests.push({
                name: 'Workflow Files',
                status: 'failed',
                message: error.message
            });
        }
        
        // 服务器连接测试
        try {
            const config = await this.getConfig();
            const response = await fetch(`${config.serverUrl}/system_stats`, {
                timeout: 5000
            });
            
            if (response.ok) {
                diagnostics.tests.push({
                    name: 'Server Connection',
                    status: 'passed',
                    message: 'Successfully connected to ComfyUI server'
                });
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            diagnostics.tests.push({
                name: 'Server Connection',
                status: 'failed',
                message: error.message
            });
        }
        
        // 文件服务器测试
        try {
            const config = await this.getConfig();
            const testUrl = `http://${config.fileServerIp}:${config.fileServerPort}/`;
            const response = await fetch(testUrl, { timeout: 5000 });
            
            if (response.ok) {
                diagnostics.tests.push({
                    name: 'File Server',
                    status: 'passed',
                    message: 'File server is accessible'
                });
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            diagnostics.tests.push({
                name: 'File Server',
                status: 'warning',
                message: `File server may not be accessible: ${error.message}`
            });
        }
        
        // 内存使用测试
        const memoryUsage = process.memoryUsage();
        const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
        
        if (memoryMB > 500) {
            diagnostics.tests.push({
                name: 'Memory Usage',
                status: 'warning',
                message: `High memory usage: ${memoryMB.toFixed(2)} MB`
            });
        } else {
            diagnostics.tests.push({
                name: 'Memory Usage',
                status: 'passed',
                message: `Memory usage normal: ${memoryMB.toFixed(2)} MB`
            });
        }
        
        diagnostics.overall = diagnostics.tests.every(t => t.status === 'passed') ? 'healthy' : 'needs_attention';
        
        return diagnostics;
    }

    // ==================== 批量操作 ====================
    
    async executeBatch(batchRequests) {
        await this.initialize();
        
        const results = [];
        
        for (const request of batchRequests) {
            try {
                const result = await this.executeWithAnalysis(request);
                results.push({
                    id: request.id || `batch_${Date.now()}`,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    id: request.id || `batch_${Date.now()}`,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // ==================== 导出和报告 ====================
    
    async generateReport() {
        await this.initialize();
        
        const stats = await this.getSystemStats();
        const suggestions = await this.getOptimizationSuggestions();
        const diagnostics = await this.runDiagnostics();
        
        return {
            generatedAt: new Date().toISOString(),
            summary: {
                totalExecutions: stats.execution.totalExecutions,
                successRate: (stats.execution.successfulExecutions / stats.execution.totalExecutions * 100).toFixed(1) + '%',
                averageExecutionTime: stats.execution.averageExecutionTime.toFixed(2) + 's',
                systemHealth: diagnostics.overall
            },
            executionStats: stats.execution,
            suggestions,
            diagnostics,
            workflowCount: stats.workflows.length
        };
    }
}

// ==================== 命令行接口 ====================
async function cli() {
    const manager = new ComfyUIselfManager();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
ComfyUIself Hybrid Manager

Usage:
  node manager.js <command> [options]

Commands:
  list-workflows              List all available workflows
  analyze <workflow>           Analyze a specific workflow
  config                      Show current configuration
  config-reset                 Reset configuration to defaults
  execute <prompt>            Execute with a simple prompt
  stats                       Show system statistics
  diagnostics                 Run system diagnostics
  report                      Generate system report
  batch <file>                Execute batch requests from file
  suggestions                 Get optimization suggestions

Examples:
  node manager.js list-workflows
  node manager.js execute "a beautiful landscape"
  node manager.js analyze text2img_api.json
        `);
        return;
    }
    
    const command = args[0];
    
    try {
        switch (command) {
            case 'list-workflows':
                const workflows = await manager.listWorkflows();
                console.table(workflows);
                break;
                
            case 'analyze':
                const workflowName = args[1];
                if (!workflowName) {
                    console.error('Please specify a workflow name');
                    return;
                }
                const analysis = await manager.analyzeWorkflow(workflowName);
                console.log(JSON.stringify(analysis, null, 2));
                break;
                
            case 'config':
                const config = await manager.getConfig();
                console.log(JSON.stringify(config, null, 2));
                break;
                
            case 'config-reset':
                await manager.resetConfig();
                console.log('Configuration reset to defaults');
                break;
                
            case 'execute':
                const prompt = args[1];
                if (!prompt) {
                    console.error('Please specify a prompt');
                    return;
                }
                const result = await manager.executeWithAnalysis({ prompt });
                console.log(JSON.stringify(result, null, 2));
                break;
                
            case 'stats':
                const stats = await manager.getSystemStats();
                console.log(JSON.stringify(stats, null, 2));
                break;
                
            case 'diagnostics':
                const diagnostics = await manager.runDiagnostics();
                console.log(JSON.stringify(diagnostics, null, 2));
                break;
                
            case 'report':
                const report = await manager.generateReport();
                console.log(JSON.stringify(report, null, 2));
                break;
                
            case 'suggestions':
                const suggestions = await manager.getOptimizationSuggestions();
                console.log(JSON.stringify(suggestions, null, 2));
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// 导出模块
module.exports = {
    ComfyUIselfManager,
    cli
};

// 如果直接运行此文件
if (require.main === module) {
    cli();
}