# ComfyUI 与 ComfyUI_InputServer 联动机制详解

## 概述

ComfyUI插件和ComfyUI_InputServer插件构成了一个完整的AI图像生成和文件服务系统。它们通过精心设计的接口和协议实现无缝协作，为用户提供端到端的图像生成体验。

## 联动架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户请求                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ComfyUI 插件                                   │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   工作流处理    │  │   图像处理      │  │   结果生成            │  │
│  │                 │  │                 │  │                         │  │
│  │  • 加载工作流   │  │  • URL图像下载  │  │  • 生成访问URL        │  │
│  │  • 参数修改     │  │  • 本地图像复制  │  │  • 返回结果给用户      │  │
│  │  • 节点查找     │  │  • 附件图像引用  │  │  • 保存本地副本        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   ComfyUI 服务器     │ │   文件系统          │ │  InputServer       │
│                     │ │                     │ │                     │
│  • HTTP API         │ │  • input/ 目录      │ │  • 文件托管        │
│  • WebSocket API    │ │  • output/ 目录     │ │  • 安全访问        │
│  • 工作流执行       │ │  • 临时文件         │ │  • URL解析         │
│  • 图像生成         │ │                     │ │  • 路径映射         │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

## 详细联动流程

### 1. 初始化阶段

#### ComfyUI插件初始化
```javascript
async function initConfig() {
    const config = {
        baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
        fileServerIp: process.env.FILE_SERVER_PUBLIC_IP || '127.0.0.1',
        fileServerPort: process.env.FILE_SERVER_PORT || '5974',
        fileServerKey: process.env.FILE_SERVER_ACCESS_KEY || '123456'
    };
    return config;
}
```

#### InputServer插件初始化
```javascript
function registerRoutes(app, pluginConfig, projectBasePath) {
    const accessKey = pluginConfig.COMFYUI_ACCESS_KEY;
    const mounts = parseMounts(pluginConfig.COMFYUI_MOUNTS);
    
    // 注册文件服务路由
    app.get(routeRegex, (req, res) => {
        // 验证访问密钥和提供文件服务
    });
}
```

### 2. 图像输入处理联动

#### URL图像处理流程
```javascript
// ComfyUI插件：处理URL图像
if (imageValue.startsWith('http://') || imageValue.startsWith('https://')) {
    const filename = path.basename(new URL(imageValue).pathname);
    const downloadedFilename = await downloadImageToInput(imageValue, filename);
    patch.inputs.image = downloadedFilename;
}
```

#### 本地图像处理流程
```javascript
// ComfyUI插件：处理本地图像
const existsInAttachments = await checkIfImageExistsInAttachments(imageValue);
if (existsInAttachments) {
    // 通过InputServer访问附件
    const attachmentUrl = await getAttachmentImageUrl(imageValue);
    const filename = path.basename(imageValue);
    const downloadedFilename = await downloadImageToInput(attachmentUrl, filename);
    patch.inputs.image = downloadedFilename;
}
```

#### 附件URL生成
```javascript
// ComfyUI插件：生成InputServer访问URL
async function getAttachmentImageUrl(imagePath) {
    const config = await initConfig();
    return `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/attachments/${imagePath}`;
}
```

### 3. 工作流执行联动

#### 工作流提交
```javascript
// ComfyUI插件：提交工作流到ComfyUI服务器
async function queuePrompt(prompt) {
    const response = await post('/prompt', { prompt, client_id: CONFIG.clientId });
    return response.prompt_id;
}
```

#### 执行状态监控
```javascript
// ComfyUI插件：WebSocket监听执行状态
ws.on('message', async (data, isBinary) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'executing' && msg.data.node === null) {
        // 工作流执行完成
        const history = await get(`/history/${promptId}`);
        const outputs = history[promptId].outputs;
        // 处理输出图像
    }
});
```

### 4. 结果输出联动

#### 图像下载和保存
```javascript
// ComfyUI插件：下载生成的图像
const imageData = await getImage(filename, firstImageInfo.subfolder, firstImageInfo.type);
await fs.mkdir(OUTPUT_DIR, { recursive: true });
const savePath = path.join(OUTPUT_DIR, filename);
await fs.writeFile(savePath, imageData);
```

#### 生成访问URL
```javascript
// ComfyUI插件：生成通过InputServer的访问URL
const fileUrl = `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/${mountAlias}/${filename}`;
```

#### 返回结果给用户
```javascript
const result = {
    content: [
        {
            type: 'text',
            text: `🎉 图像已通过工作流 '${workflowFile}' 成功生成！\n\n![生成的图片](${fileUrl})`
        }
    ]
};
```

## 配置协同机制

### 1. 共享配置参数

两个插件通过以下配置参数实现协同：

```env
# ComfyUI插件配置
COMFYUI_BASE_URL=http://127.0.0.1:8188
FILE_SERVER_PUBLIC_IP=127.0.0.1
FILE_SERVER_PORT=5974
FILE_SERVER_ACCESS_KEY=123456

# ComfyUI_InputServer配置
COMFYUI_MOUNTS=output:C:\VCP\Plugin\ComfyUI\output;attachments:C:\VCP\AppData\attachments
COMFYUI_ACCESS_KEY=123456
```

### 2. 路径映射关系

```
InputServer挂载点                    实际路径
output/        →  C:\VCP\Plugin\ComfyUI\output\
attachments/    →  C:\VCP\AppData\attachments\
```

### 3. URL格式规范

```
访问格式: /comfyui_server/pw=<access_key>/files/<mount_alias>/<filename>

示例: /comfyui_server/pw=123456/files/output/beautiful_cat_00001_.png
```

## 数据流向分析

### 1. 输入流向

```
用户请求 → ComfyUI插件 → 图像预处理 → ComfyUI服务器 → 工作流执行
    ↓           ↓              ↓              ↓              ↓
 参数验证 → 图像下载 → 文件保存 → input目录 → 图像生成
```

### 2. 输出流向

```
ComfyUI服务器 → 图像生成 → output目录 → ComfyUI插件 → 图像下载 → 本地保存
      ↓              ↓           ↓           ↓            ↓           ↓
  工作流完成 → 文件写入 → InputServer托管 → URL生成 → 用户访问
```

### 3. 文件生命周期

```
创建阶段: 用户请求 → 工作流定义 → 参数设置
处理阶段: 图像输入 → 工作流执行 → 图像生成
输出阶段: 文件保存 → URL生成 → 用户访问
清理阶段: 定期清理 → 空间释放 → 日志记录
```

## 错误处理联动

### 1. 网络错误处理

```javascript
// ComfyUI插件：网络错误重试
async function get(urlPath, retries = 3) {
    try {
        const response = await fetch(`${config.baseUrl}${urlPath}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    } catch (error) {
        if (retries > 0) {
            console.error(`[ComfyUI] Retrying (${retries}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return get(urlPath, retries - 1);
        }
        throw error;
    }
}
```

### 2. 文件访问错误处理

```javascript
// InputServer插件：文件访问错误
app.get(routeRegex, (req, res) => {
    try {
        // 路径验证和文件访问
        res.sendFile(fullFilePath, (err) => {
            if (err && !res.headersSent) {
                res.status(404).send('File not found');
            }
        });
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).send('Internal server error');
        }
    }
});
```

### 3. 认证错误处理

```javascript
// InputServer插件：认证失败
if (requestKey !== accessKey) {
    console.error(`[ComfyUI_InputServer] Unauthorized access attempt with key: ${requestKey}`);
    return res.status(401).send('Unauthorized');
}
```

## 性能优化联动

### 1. 并发处理

```javascript
// ComfyUI插件：并发图像下载
async function processMultipleImages(imageUrls) {
    const promises = imageUrls.map(url => downloadImageToInput(url, path.basename(url)));
    return Promise.all(promises);
}
```

### 2. 缓存机制

```javascript
// ComfyUI插件：配置缓存
let CONFIG = null;
async function initConfig() {
    if (!CONFIG) {
        CONFIG = await loadConfig();
    }
    return CONFIG;
}
```

### 3. 流式传输

```javascript
// InputServer插件：流式文件传输
res.sendFile(fullFilePath, {
    headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
    }
});
```

## 监控和日志联动

### 1. 操作日志

```javascript
// ComfyUI插件：操作日志
console.error(`[ComfyUI] Applied patch: ${patch.node_title}.${key} = ${newValue}`);
console.error(`[ComfyUI] Downloaded image to input: ${filename}`);
console.error(`[ComfyUI] Generated filename prefix: ${filenamePrefix}`);

// InputServer插件：访问日志
console.log(`[${new Date().toISOString()}] GET ${req.url} - ${res.statusCode}`);
```

### 2. 错误日志

```javascript
// ComfyUI插件：错误日志
console.error(`[ComfyUI] Failed to download image: ${error.message}`);
console.error(`[ComfyUI] Workflow execution failed: ${error.message}`);

// InputServer插件：错误日志
console.error(`[ComfyUI_InputServer] Path traversal attempt: ${requestedFile}`);
console.error(`[ComfyUI_InputServer] File not found: ${fullFilePath}`);
```

### 3. 性能监控

```javascript
// ComfyUI插件：性能监控
const startTime = Date.now();
const outputImages = await queuePrompt(prompt);
const executionTime = Date.now() - startTime;
console.error(`[ComfyUI] Workflow execution completed in ${executionTime}ms`);
```

## 安全联动机制

### 1. 访问控制

```javascript
// ComfyUI插件：访问密钥验证
const config = await initConfig();
const fileUrl = `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/${mountAlias}/${filename}`;

// InputServer插件：密钥验证
if (requestKey !== accessKey) {
    return res.status(401).send('Unauthorized');
}
```

### 2. 路径安全

```javascript
// InputServer插件：路径安全检查
if (!fullFilePath.startsWith(resolvedBasePath)) {
    console.error(`[ComfyUI_InputServer] Path traversal attempt: ${requestedFile}`);
    return res.status(403).send('Forbidden');
}
```

### 3. 输入验证

```javascript
// ComfyUI插件：输入验证
if (imageValue.startsWith('http://') || imageValue.startsWith('https://')) {
    try {
        new URL(imageValue); // 验证URL格式
    } catch (error) {
        throw new Error(`Invalid URL: ${imageValue}`);
    }
}
```

## 扩展性联动

### 1. 新的文件类型支持

```javascript
// 可以扩展支持更多文件类型
const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
```

### 2. 新的挂载点

```javascript
// 可以添加新的挂载点
COMFYUI_MOUNTS=output:/path/to/output;attachments:/path/to/attachments;temp:/path/to/temp
```

### 3. 新的认证方式

```javascript
// 可以扩展支持更多认证方式
const authHeader = req.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
    // Bearer Token认证
}
```

这种联动机制确保了两个插件能够高效、安全地协同工作，为用户提供完整的AI图像生成和文件访问服务。