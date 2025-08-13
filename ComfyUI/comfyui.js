// comfyui.js - VCP Plugin for ComfyUI
// Author: Gemini

const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// --- Configuration --- //

async function loadConfig() {
    // 尝试读取配置文件
    let serverInputDir = path.join(__dirname, 'input');
    try {
        const configContent = await fs.readFile(path.join(__dirname, 'config.env'), 'utf8');
        const lines = configContent.split('\n');
        for (const line of lines) {
            if (line.startsWith('COMFYUI_SERVER_INPUT_DIR=')) {
                serverInputDir = line.split('=')[1].trim();
                break;
            }
        }
    } catch (error) {
        console.error('[ComfyUI] Warning: Could not read config.env, using default input directory');
    }
    
    const config = {
        baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
        clientId: process.env.COMFYUI_CLIENT_ID || uuidv4(),
        serverInputDir: serverInputDir,
        fileServerIp: process.env.FILE_SERVER_PUBLIC_IP || '172.30.93.161',
        fileServerPort: process.env.FILE_SERVER_PORT || '5974',
        fileServerKey: process.env.FILE_SERVER_ACCESS_KEY || '123456'
    };
    if (config.baseUrl.endsWith('/')) {
        config.baseUrl = config.baseUrl.slice(0, -1);
    }
    return config;
}

let CONFIG = null;
const WORKFLOW_DIR = path.join(__dirname, 'workflows');
const OUTPUT_DIR = path.join(__dirname, 'output');

async function initConfig() {
    if (!CONFIG) {
        CONFIG = await loadConfig();
    }
    return CONFIG;
}

// --- ComfyUI API Client --- //

async function get(urlPath) {
    const config = await initConfig();
    const response = await fetch(`${config.baseUrl}${urlPath}`);
    if (!response.ok) throw new Error(`API GET request failed for ${urlPath}: ${response.status}`);
    return response.json();
}

async function post(urlPath, body) {
    const config = await initConfig();
    const response = await fetch(`${config.baseUrl}${urlPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API POST request failed for ${urlPath}: ${response.status}\n${errorText}`);
    }
    return response.json();
}

async function getImage(filename, subfolder, type = 'output') {
    const config = await initConfig();
    const url = `${config.baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${type}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to get image: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}

async function downloadImageToInput(imageUrl, filename) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);
        
        // 保存到ComfyUI的input目录
        const inputDir = path.join(__dirname, 'input');
        await fs.mkdir(inputDir, { recursive: true });
        const inputPath = path.join(inputDir, filename);
        await fs.writeFile(inputPath, imageBuffer);
        
        console.error(`[ComfyUI] Downloaded image to input: ${filename}`);
        return filename;
    } catch (error) {
        console.error(`[ComfyUI] Failed to download image: ${error.message}`);
        throw error;
    }
}

async function copyLocalImageToInput(imagePath, filename) {
    try {
        const config = await initConfig();
        
        // 检查是否是绝对路径
        let absolutePath = imagePath;
        if (!path.isAbsolute(imagePath)) {
            // 如果是相对路径，尝试在attachments目录中查找
            const attachmentsDir = path.join(__dirname, '..', '..', '..', 'AppData', 'UserData', 'attachments');
            absolutePath = path.join(attachmentsDir, imagePath);
        }
        
        // 检查文件是否存在
        try {
            await fs.access(absolutePath);
        } catch (accessError) {
            throw new Error(`Image file not found: ${absolutePath}`);
        }
        
        // 读取图片文件
        const imageBuffer = await fs.readFile(absolutePath);
        
        // 保存到插件本地的input目录
        const localInputDir = path.join(__dirname, 'input');
        await fs.mkdir(localInputDir, { recursive: true });
        const localInputPath = path.join(localInputDir, filename);
        await fs.writeFile(localInputPath, imageBuffer);
        
        // 同时保存到ComfyUI服务器的input目录
        const serverInputDir = config.serverInputDir;
        await fs.mkdir(serverInputDir, { recursive: true });
        const serverInputPath = path.join(serverInputDir, filename);
        await fs.writeFile(serverInputPath, imageBuffer);
        
        console.error(`[ComfyUI] Copied local image to both local and server input: ${filename} (from: ${absolutePath})`);
        console.error(`[ComfyUI] Local path: ${localInputPath}`);
        console.error(`[ComfyUI] Server path: ${serverInputPath}`);
        return filename;
    } catch (error) {
        console.error(`[ComfyUI] Failed to copy local image: ${error.message}`);
        throw error;
    }
}

async function checkIfImageExistsInAttachments(imagePath) {
    try {
        // 检查是否是相对路径
        if (path.isAbsolute(imagePath)) {
            return false;
        }
        
        // 检查文件是否在attachments目录中存在
        const attachmentsDir = path.join(__dirname, '..', '..', '..', 'AppData', 'UserData', 'attachments');
        const absolutePath = path.join(attachmentsDir, imagePath);
        
        try {
            await fs.access(absolutePath);
            return true;
        } catch (accessError) {
            return false;
        }
    } catch (error) {
        return false;
    }
}

async function getAttachmentImageUrl(imagePath) {
    const config = await initConfig();
    // 返回通过InputServer访问attachments目录的URL
    return `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/attachments/${imagePath}`;
}

async function queuePrompt(prompt) {
    const config = await initConfig();
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${config.baseUrl.replace('http', 'ws')}/ws?clientId=${config.clientId}`);
        let promptId = null;
        ws.on('open', async () => {
            try {
                console.error('[ComfyUI] WebSocket opened, queueing prompt...');
                const response = await post('/prompt', { prompt, client_id: CONFIG.clientId });
                promptId = response.prompt_id;
                console.error(`[ComfyUI] Prompt queued with ID: ${promptId}`);
            } catch (err) { reject(err); ws.close(); }
        });
        ws.on('message', async (data, isBinary) => {
            if (isBinary) { console.error('[ComfyUI] Received binary message, ignoring.'); return; }
            const msg = JSON.parse(data.toString());
            if (msg.type === 'executing' && msg.data.node === null && msg.data.prompt_id === promptId) {
                console.error('[ComfyUI] Execution finished.');
                ws.close();
                try {
                    const history = await get(`/history/${promptId}`);
                    const historyData = history[promptId];
                    const outputs = historyData.outputs;
                    const saveImageNodeId = Object.keys(outputs).find(key => outputs[key].images);
                    if (!saveImageNodeId || !outputs[saveImageNodeId].images) throw new Error('Could not find image output in history.');
                    resolve(outputs[saveImageNodeId].images);
                } catch (err) { reject(err); }
            } else if (msg.type === 'execution_error') {
                reject(new Error(`Execution failed: ${JSON.stringify(msg.data.exception_message)}`));
                ws.close();
            }
        });
        ws.on('error', (err) => { reject(err); });
        ws.on('close', () => { console.error('[ComfyUI] WebSocket closed.'); });
    });
}

// --- Plugin Logic --- //

function findNodeByTitle(prompt, title) {
    for (const id in prompt) { if (prompt[id]._meta?.title === title) return prompt[id]; }
    return null;
}

function generateFilenameFromPrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') {
        return 'ComfyUI';
    }
    
    // 清理和简化提示词
    let cleanText = promptText
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff,-]/g, ' ') // 保留中文、英文、数字、空格、逗号、横线
        .replace(/\s+/g, ' ')
        .trim();
    
    // 提取关键信息
    const keywords = [];
    
    // 常见角色/人物关键词
    const characterKeywords = ['girl', 'boy', 'woman', 'man', 'character', 'person', '人', '女孩', '男孩', '女性', '男性'];
    // 常见风格关键词  
    const styleKeywords = ['anime', 'realistic', 'cartoon', 'oil painting', 'watercolor', '动漫', '写实', '卡通', '油画', '水彩'];
    // 常见场景关键词
    const sceneKeywords = ['landscape', 'portrait', 'scenery', 'city', 'nature', '风景', '肖像', '城市', '自然'];
    
    // 检查关键词
    const words = cleanText.split(' ').filter(word => word.length > 1);
    
    for (const word of words) {
        if (characterKeywords.some(kw => word.includes(kw)) || 
            styleKeywords.some(kw => word.includes(kw)) || 
            sceneKeywords.some(kw => word.includes(kw)) ||
            word.length <= 10) { // 限制长度
            keywords.push(word);
        }
        if (keywords.length >= 3) break; // 限制关键词数量
    }
    
    // 如果没有找到关键词，使用简化的提示词
    if (keywords.length === 0) {
        const shortText = cleanText.split(' ').slice(0, 3).join('_');
        return shortText.length > 20 ? shortText.substring(0, 20) : shortText || 'ComfyUI';
    }
    
    return keywords.join('_');
}

async function handleGetInfo(args) {
    const type = args.info.toLowerCase();
    let data, title, formattter;
    switch (type) {
        case 'workflows':
            const files = await fs.readdir(WORKFLOW_DIR);
            data = files.filter(f => f.endsWith('.json'));
            title = '📄 可用工作流';
            formattter = item => `- **${item}**`;
            break;
        case 'checkpoints':
            // 使用 ComfyUImodules 中的方法获取 checkpoints
            const objectInfo = await get('/object_info');
            const checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
            data = checkpoints;
            title = '📦 可用 Checkpoint 模型';
            formattter = item => `- **${item}**`;
            break;
        case 'loras':
            const loraInfo = await get('/object_info');
            const loras = loraInfo.LoraLoader?.input?.required?.lora_name?.[0] || [];
            data = loras;
            title = '📦 可用 LoRA 模型';
            formattter = item => `- **${item}**`;
            break;
        case 'vaes':
            const vaeInfo = await get('/object_info');
            const vaes = vaeInfo.VAELoader?.input?.required?.vae_name?.[0] || [];
            data = vaes;
            title = '📦 可用 VAE 模型';
            formattter = item => `- **${item}**`;
            break;
        case 'samplers':
            const samplerInfo = await get('/object_info');
            const samplers = samplerInfo.KSampler?.input?.required?.sampler_name?.[0] || [];
            data = samplers;
            title = '📦 可用采样器';
            formattter = item => `- **${item}**`;
            break;
        case 'schedulers':
            const schedulerInfo = await get('/object_info');
            const schedulers = schedulerInfo.KSampler?.input?.required?.scheduler?.[0] || [];
            data = schedulers;
            title = '📦 可用调度器';
            formattter = item => `- **${item}**`;
            break;
        default: throw new Error(`Invalid info type: ${args.info}`);
    }
    if (!Array.isArray(data)) throw new Error(`Could not construct a list for info type '${args.info}'.`);
    const list = data.map(formattter).join('\n');
    const resultText = `### ${title}\n\n${list}`;
    return { content: [{ type: 'text', text: resultText }] };
}

async function handleRunWorkflow(args) {
    const workflowFile = args.workflow;
    if (!workflowFile.endsWith('.json')) throw new Error('Workflow file must be a .json file.');
    const workflowPath = path.join(WORKFLOW_DIR, workflowFile);
    const workflowJson = await fs.readFile(workflowPath, 'utf-8');
    const prompt = JSON.parse(workflowJson).prompt;
    if (args.prompt && !args.params) {
        args.params = [{ node_title: "Positive Prompt", inputs: { text: args.prompt } }];
    }
    let params = args.params || [];
    
    // 处理字符串化的JSON参数
    if (typeof params === 'string') {
        try {
            params = JSON.parse(params);
        } catch (e) {
            console.error('[ComfyUI] Failed to parse stringified params:', e);
            throw new Error('Invalid params format: could not parse JSON string');
        }
    }
    
    if (Array.isArray(params)) {
        for (const patch of params) {
            let targetNode = null;
            if (patch.node_title) { targetNode = findNodeByTitle(prompt, patch.node_title); }
            else if (patch.node_id) { targetNode = prompt[patch.node_id]; }
            if (!targetNode) { 
                console.error(`[ComfyUI] Warning: Could not find node for patch:`, patch); 
                console.error(`[ComfyUI] Available node titles:`, Object.keys(prompt).map(id => prompt[id]._meta?.title).filter(Boolean));
                continue; 
            }
            
            // 特殊处理LoadImage节点的图片
            if (patch.node_title === 'Load Image' && patch.inputs.image) {
                const imageValue = patch.inputs.image;
                
                if (imageValue.startsWith('http://') || imageValue.startsWith('https://')) {
                    // 处理URL图片
                    try {
                        const filename = path.basename(new URL(imageValue).pathname);
                        const downloadedFilename = await downloadImageToInput(imageValue, filename);
                        patch.inputs.image = downloadedFilename;
                        console.error(`[ComfyUI] Converted URL to local file: ${imageValue} -> ${downloadedFilename}`);
                    } catch (error) {
                        console.error(`[ComfyUI] Failed to download image from URL: ${imageValue}`, error);
                        continue;
                    }
                } else {
                    // 处理本地图片路径
                    try {
                        // 首先检查是否在attachments目录中
                        const existsInAttachments = await checkIfImageExistsInAttachments(imageValue);
                        
                        if (existsInAttachments) {
                            // 如果在attachments目录中，使用InputServer的URL
                            const attachmentUrl = await getAttachmentImageUrl(imageValue);
                            const filename = path.basename(imageValue);
                            const downloadedFilename = await downloadImageToInput(attachmentUrl, filename);
                            patch.inputs.image = downloadedFilename;
                            console.error(`[ComfyUI] Using InputServer for attachment: ${imageValue} -> ${downloadedFilename}`);
                        } else {
                            // 否则使用传统复制方式
                            const filename = path.basename(imageValue);
                            const copiedFilename = await copyLocalImageToInput(imageValue, filename);
                            patch.inputs.image = copiedFilename;
                            console.error(`[ComfyUI] Copied local file to input: ${imageValue} -> ${copiedFilename}`);
                        }
                    } catch (error) {
                        console.error(`[ComfyUI] Failed to process local image: ${imageValue}`, error);
                        continue;
                    }
                }
            }
            
            for (const key in patch.inputs) {
                if (targetNode.inputs.hasOwnProperty(key)) {
                    const oldValue = targetNode.inputs[key];
                    const newValue = patch.inputs[key];
                    targetNode.inputs[key] = newValue;
                    console.error(`[ComfyUI] Applied patch: ${patch.node_title || patch.node_id}.${key} = ${newValue} (was: ${oldValue})`);
                } else { console.error(`[ComfyUI] Warning: Node does not have an input named '${key}'. Available inputs:`, Object.keys(targetNode.inputs)); }
            }
        }
    }
    
    // 动态生成文件名前缀
    let filenamePrefix = 'ComfyUI';
    const positivePromptNode = findNodeByTitle(prompt, 'Positive Prompt');
    if (positivePromptNode && positivePromptNode.inputs && positivePromptNode.inputs.text) {
        const promptText = positivePromptNode.inputs.text;
        filenamePrefix = generateFilenameFromPrompt(promptText);
        console.error(`[ComfyUI] Generated filename prefix: ${filenamePrefix}`);
    }
    
    // 应用文件名前缀到SaveImage节点
    const saveImageNode = findNodeByTitle(prompt, 'Save Image');
    if (saveImageNode && saveImageNode.inputs) {
        const oldPrefix = saveImageNode.inputs.filename_prefix || 'ComfyUI';
        saveImageNode.inputs.filename_prefix = filenamePrefix;
        console.error(`[ComfyUI] Updated SaveImage prefix: ${oldPrefix} -> ${filenamePrefix}`);
    }
    
    // 设置随机种子到KSampler节点
    const kSamplerNode = findNodeByTitle(prompt, 'KSampler');
    if (kSamplerNode && kSamplerNode.inputs && kSamplerNode.inputs.seed !== undefined) {
        const oldSeed = kSamplerNode.inputs.seed;
        const newSeed = Math.floor(Math.random() * 1000000000000000);
        kSamplerNode.inputs.seed = newSeed;
        console.error(`[ComfyUI] Updated KSampler seed: ${oldSeed} -> ${newSeed}`);
    }
    
    const outputImages = await queuePrompt(prompt);
    if (!outputImages || outputImages.length === 0) throw new Error('Workflow did not produce any images.');
    const firstImageInfo = outputImages[0];
    console.error(`[ComfyUI] ComfyUI generated image info:`, firstImageInfo);
    const filename = firstImageInfo.filename;
    const mountAlias = 'output'; // All generated images are in the output folder
    console.error(`[ComfyUI] Downloading image from ComfyUI: ${filename}`);
    const imageData = await getImage(filename, firstImageInfo.subfolder, firstImageInfo.type);
    console.error(`[ComfyUI] Image downloaded successfully. Size: ${imageData.length} bytes.`);
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const savePath = path.join(OUTPUT_DIR, filename);
    console.error(`[ComfyUI] Saving image to absolute path: ${path.resolve(savePath)}`);
    await fs.writeFile(savePath, imageData);
    console.error(`[ComfyUI] Image saved successfully.`);
    const config = await initConfig();
    const fileUrl = `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/${mountAlias}/${filename}`;
    const result = {
        content: [
            {
                type: 'text',
                text: `🎉 图像已通过工作流 '${workflowFile}' 成功生成！\n\n✨ **应用参数**:\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\`\n\n📂 **输出文件**: ${filename}\n\n![生成的图片](${fileUrl})`
            }
        ]
    };
    return result;
}

// --- Main Execution --- //

async function main() {
    let inputString = '';
    try {
        inputString = await new Promise((resolve) => {
            process.stdin.on('data', (chunk) => inputString += chunk);
            process.stdin.on('end', () => resolve(inputString.trim()));
        });
        if (!inputString) throw new Error('No input received from stdin.');
        const args = JSON.parse(inputString);
        let result;
        if (args.info) { result = await handleGetInfo(args); }
        else if (args.workflow) { result = await handleRunWorkflow(args); }
        else { throw new Error("Invalid command. Must provide either 'info' or 'workflow' parameter."); }
        console.log(JSON.stringify({ status: 'success', result }));
    } catch (e) {
        console.error(`[ComfyUI] Fatal Error: ${e.message}`);
        console.error(e.stack);
        console.log(JSON.stringify({ status: 'error', error: e.message }));
        process.exit(1);
    }
}

main();