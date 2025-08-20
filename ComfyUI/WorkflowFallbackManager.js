// ComfyUISelf工作流回退机制 - 借鉴ComfyUIGen的容错设计
const fs = require('fs').promises;
const path = require('path');
const EnhancedConfigManager = require('./EnhancedConfigManager');
const ComfyUISelfTemplateProcessor = require('./ComfyUISelfTemplateProcessor');

class WorkflowFallbackManager {
    constructor() {
        this.configManager = new EnhancedConfigManager();
        this.templateProcessor = new ComfyUISelfTemplateProcessor();
        this.workflowDir = path.join(__dirname, 'workflows');
        this.attemptHistory = [];
    }

    /**
     * 主要执行函数 - 带回退机制的工作流执行
     */
    async executeWithFallback(args) {
        const startTime = Date.now();
        const executionId = this.generateExecutionId();
        
        console.log(`[Fallback] Starting execution ${executionId}`);
        
        // 构建工作流候选列表
        const workflowCandidates = this.buildWorkflowCandidates(args);
        console.log(`[Fallback] Workflow candidates: ${workflowCandidates.join(', ')}`);
        
        let lastError = null;
        let successfulResult = null;
        let usedWorkflow = null;
        
        // 尝试每个工作流候选
        for (const workflowName of workflowCandidates) {
            const attemptStart = Date.now();
            
            try {
                console.log(`[Fallback] Attempting workflow: ${workflowName}`);
                
                // 加载和验证工作流
                const workflow = await this.loadAndValidateWorkflow(workflowName);
                
                // 处理工作流参数
                const processedWorkflow = this.processWorkflow(workflow, args);
                
                // 执行工作流
                const result = await this.executeWorkflow(processedWorkflow, args);
                
                // 成功执行
                const attemptDuration = Date.now() - attemptStart;
                console.log(`[Fallback] Workflow ${workflowName} succeeded in ${attemptDuration}ms`);
                
                successfulResult = result;
                usedWorkflow = workflowName;
                
                // 记录成功历史
                this.recordAttempt(executionId, workflowName, true, attemptDuration, null);
                
                break; // 成功，退出回退循环
                
            } catch (error) {
                const attemptDuration = Date.now() - attemptStart;
                lastError = error;
                
                console.error(`[Fallback] Workflow ${workflowName} failed after ${attemptDuration}ms:`, error.message);
                
                // 记录失败历史
                this.recordAttempt(executionId, workflowName, false, attemptDuration, error.message);
                
                // 继续尝试下一个工作流
            }
        }
        
        const totalDuration = Date.now() - startTime;
        
        if (successfulResult) {
            // 成功完成
            console.log(`[Fallback] Execution ${executionId} completed successfully in ${totalDuration}ms`);
            return {
                success: true,
                executionId,
                usedWorkflow,
                result: successfulResult,
                totalDuration,
                attempts: this.attemptHistory[executionId]
            };
        } else {
            // 所有尝试都失败
            console.error(`[Fallback] Execution ${executionId} failed after ${totalDuration}ms`);
            
            const error = new Error(`All workflow attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
            error.executionId = executionId;
            error.totalDuration = totalDuration;
            error.attempts = this.attemptHistory[executionId];
            
            throw error;
        }
    }

    /**
     * 构建工作流候选列表
     */
    buildWorkflowCandidates(args) {
        const candidates = [];
        
        // 1. 优先使用运行时指定的工作流
        if (args.workflow) {
            candidates.push(args.workflow);
        }
        
        // 2. 使用配置中的默认工作流
        const config = this.configManager.config;
        if (config.workflow && !candidates.includes(config.workflow)) {
            candidates.push(config.workflow);
        }
        
        // 3. 使用配置中的回退工作流
        if (config.workflowFallback && Array.isArray(config.workflowFallback)) {
            config.workflowFallback.forEach(wf => {
                if (!candidates.includes(wf)) {
                    candidates.push(wf);
                }
            });
        }
        
        // 4. 确保至少有基础工作流
        const fallbackWorkflows = ['text2img_api.json', 'text2img_basic.json'];
        fallbackWorkflows.forEach(wf => {
            if (!candidates.includes(wf)) {
                candidates.push(wf);
            }
        });
        
        return candidates;
    }

    /**
     * 加载和验证工作流
     */
    async loadAndValidateWorkflow(workflowName) {
        // 确保文件名有.json扩展名
        const filename = workflowName.endsWith('.json') ? workflowName : `${workflowName}.json`;
        const workflowPath = path.join(this.workflowDir, filename);
        
        try {
            // 检查文件是否存在
            await fs.access(workflowPath);
            
            // 读取工作流文件
            const workflowContent = await fs.readFile(workflowPath, 'utf8');
            const workflow = JSON.parse(workflowContent);
            
            // 验证工作流结构
            this.validateWorkflowStructure(workflow, workflowName);
            
            console.log(`[Fallback] Loaded workflow: ${workflowName}`);
            return workflow;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Workflow file not found: ${workflowPath}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in workflow file: ${workflowName}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * 验证工作流结构
     */
    validateWorkflowStructure(workflow, workflowName) {
        if (!workflow || typeof workflow !== 'object') {
            throw new Error(`Invalid workflow structure: ${workflowName}`);
        }
        
        // 检查是否为ComfyUI API格式
        const nodes = workflow.prompt || workflow;
        if (!nodes || typeof nodes !== 'object') {
            throw new Error(`Workflow missing prompt/nodes: ${workflowName}`);
        }
        
        // 检查必需的节点类型
        const nodeTypes = Object.values(nodes).map(node => node.class_type).filter(Boolean);
        
        const hasRequiredNodes = [
            'KSampler',
            'CheckpointLoaderSimple',
            'CLIPTextEncode'
        ].some(type => nodeTypes.includes(type));
        
        if (!hasRequiredNodes) {
            console.warn(`[Fallback] Workflow ${workflowName} may be missing required nodes`);
        }
        
        // 检查节点数量
        if (Object.keys(nodes).length === 0) {
            throw new Error(`Workflow contains no nodes: ${workflowName}`);
        }
        
        console.log(`[Fallback] Workflow ${workflowName} validated: ${nodeTypes.length} nodes, types: ${[...new Set(nodeTypes)].join(', ')}`);
    }

    /**
     * 处理工作流参数
     */
    processWorkflow(workflow, args) {
        // 合并运行时参数和配置
        const mergedParams = this.configManager.mergeParameters(args);
        
        // 使用模板处理器处理工作流
        const processedWorkflow = this.templateProcessor.processWorkflow(workflow, mergedParams);
        
        // 验证处理后的工作流
        const validation = this.templateProcessor.validateWorkflow(processedWorkflow);
        
        if (!validation.isValid) {
            throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
        }
        
        if (validation.warnings.length > 0) {
            console.warn(`[Fallback] Workflow validation warnings: ${validation.warnings.join(', ')}`);
        }
        
        console.log(`[Fallback] Workflow processed: ${validation.stats.replacedNodes} replacements, ${validation.stats.preservedNodes} preserved`);
        
        return processedWorkflow;
    }

    /**
     * 执行工作流（调用原有的执行逻辑）
     */
    async executeWorkflow(workflow, args) {
        // 这里需要导入原有的执行函数
        // 由于模块依赖，我们将在实际集成时处理
        const { queuePrompt } = require('./comfyui');
        return await queuePrompt(workflow);
    }

    /**
     * 记录尝试历史
     */
    recordAttempt(executionId, workflowName, success, duration, error) {
        if (!this.attemptHistory[executionId]) {
            this.attemptHistory[executionId] = [];
        }
        
        this.attemptHistory[executionId].push({
            workflowName,
            success,
            duration,
            error,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 生成执行ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取执行统计
     */
    getExecutionStats() {
        const stats = {
            totalExecutions: Object.keys(this.attemptHistory).length,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageDuration: 0,
            workflowSuccessRates: {},
            totalAttempts: 0
        };
        
        let totalDuration = 0;
        const workflowStats = {};
        
        for (const [executionId, attempts] of Object.entries(this.attemptHistory)) {
            const successfulAttempt = attempts.find(a => a.success);
            const executionSuccess = successfulAttempt !== undefined;
            
            if (executionSuccess) {
                stats.successfulExecutions++;
                totalDuration += attempts.reduce((sum, a) => sum + a.duration, 0);
            } else {
                stats.failedExecutions++;
            }
            
            // 统计工作流成功率
            for (const attempt of attempts) {
                if (!workflowStats[attempt.workflowName]) {
                    workflowStats[attempt.workflowName] = { attempts: 0, successes: 0 };
                }
                
                workflowStats[attempt.workflowName].attempts++;
                if (attempt.success) {
                    workflowStats[attempt.workflowName].successes++;
                }
                stats.totalAttempts++;
            }
        }
        
        // 计算平均持续时间和成功率
        stats.averageDuration = stats.successfulExecutions > 0 ? totalDuration / stats.successfulExecutions : 0;
        
        for (const [workflowName, workflowStat] of Object.entries(workflowStats)) {
            stats.workflowSuccessRates[workflowName] = {
                attempts: workflowStat.attempts,
                successes: workflowStat.successes,
                successRate: workflowStat.attempts > 0 ? (workflowStat.successes / workflowStat.attempts * 100).toFixed(1) + '%' : '0%'
            };
        }
        
        return stats;
    }

    /**
     * 清理历史记录（可选）
     */
    cleanupHistory(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
        const cutoffTime = Date.now() - maxAge;
        let cleanedCount = 0;
        
        for (const [executionId, attempts] of Object.entries(this.attemptHistory)) {
            const executionTime = new Date(attempts[0].timestamp).getTime();
            if (executionTime < cutoffTime) {
                delete this.attemptHistory[executionId];
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[Fallback] Cleaned up ${cleanedCount} old execution records`);
        }
        
        return cleanedCount;
    }
}

module.exports = WorkflowFallbackManager;