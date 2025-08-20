// ComfyUIself 综合型插件功能演示
const { ComfyUISelfHybrid } = require('./comfyui-self-hybrid');

async function demonstrateHybridFeatures() {
    console.log('🚀 ComfyUIself 综合型插件功能演示');
    console.log('=====================================\n');

    const hybrid = new ComfyUISelfHybrid();
    
    // 1. 展示配置管理
    console.log('📋 企业级配置管理:');
    console.log(JSON.stringify(hybrid.configManager.config, null, 2));
    console.log('');
    
    // 2. 展示工作流分析
    console.log('🔍 智能工作流分析:');
    const simpleAnalysis = await hybrid.analyzeWorkflow({
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 42,
                "steps": 20,
                "cfg": 7.5,
                "sampler_name": "euler",
                "scheduler": "normal"
            }
        }
    });
    console.log('简单工作流复杂度:', simpleAnalysis.complexity);
    
    const complexAnalysis = await hybrid.analyzeWorkflow({
        "1": {"class_type": "CheckpointLoaderSimple"},
        "2": {"class_type": "CLIPTextEncode"},
        "3": {"class_type": "CLIPTextEncode"},
        "4": {"class_type": "EmptyLatentImage"},
        "5": {"class_type": "KSampler"},
        "6": {"class_type": "VAEDecode"},
        "7": {"class_type": "SaveImage"},
        "8": {"class_type": "FaceDetailer"},
        "9": {"class_type": "ControlNetApply"},
        "10": {"class_type": "LoRALoader"}
    });
    console.log('复杂工作流复杂度:', complexAnalysis.complexity);
    console.log('');
    
    // 3. 展示智能模式选择
    console.log('🧠 智能模式选择:');
    const mode1 = hybrid.selectProcessingMode(
        {analysis: simpleAnalysis, name: 'simple_workflow'},
        {prompt: 'test'}
    );
    console.log('简单工作流选择模式:', mode1);
    
    const mode2 = hybrid.selectProcessingMode(
        {analysis: complexAnalysis, name: 'complex_workflow'},
        {prompt: 'test'}
    );
    console.log('复杂工作流选择模式:', mode2);
    console.log('');
    
    // 4. 展示监控系统
    console.log('📊 实时监控系统:');
    console.log('执行统计:', hybrid.monitoring.getGlobalStats());
    console.log('');
    
    // 5. 展示管理工具
    console.log('🛠️ 管理工具功能:');
    console.log('- 工作流管理: 列出、分析、优化工作流');
    console.log('- 配置管理: 多层级配置、实时重载');
    console.log('- 批量处理: 支持大规模批量任务');
    console.log('- 诊断工具: 系统健康检查');
    console.log('- 性能监控: 实时执行统计');
    console.log('');
    
    console.log('✅ 综合型插件演示完成！');
    console.log('');
    console.log('🎯 核心优势:');
    console.log('1. 智能双模式引擎 - 自动选择最佳处理方式');
    console.log('2. 企业级配置管理 - 多层级配置系统');
    console.log('3. 工作流回退机制 - 保证系统可靠性');
    console.log('4. 实时监控系统 - 全面的性能监控');
    console.log('5. 强大管理工具 - 完整的系统管理');
}

// 运行演示
if (require.main === module) {
    demonstrateHybridFeatures().catch(console.error);
}

module.exports = { demonstrateHybridFeatures };