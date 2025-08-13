# ComfyUI Plugin for VCP


## 概述

ComfyUI插件是一个为VCP设计的同步插件，用于通过调用本地ComfyUI API来生成图像。该插件支持工作流执行、参数动态修改、图像下载和文件管理等功能。

ComfyUI_InputServer服务器插件基于VCPDistImageServer基础上修改而成

本插件适用于分布式服务器 ComfyUI_InputServer 为服务器所建
[基本原理](./ComfyUI_Architecture.md)
[联动机制](./ComfyUI_Integration.md)

## 功能特性

- 🎨 **工作流执行**：支持运行预定义的ComfyUI工作流
- 🔧 **参数动态修改**：可以动态修改工作流节点的参数
- 🖼️ **图像处理**：支持URL图片下载和本地图片处理
- 📁 **文件管理**：自动管理输入输出文件
- 🔗 **文件服务器集成**：与ComfyUI_InputServer无缝集成
- 🎲 **智能随机化**：自动生成随机种子和文件名

## 安装要求

- Node.js 16+
- 运行中的ComfyUI服务器
- ComfyUI_InputServer插件（用于文件访问）

## 配置说明

### 1. 创建配置文件

复制 `config.env.example` 为 `config.env` 并根据您的环境修改配置：

```bash
cp config.env.example config.env
```

### 2. 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `COMFYUI_BASE_URL` | ComfyUI服务器地址 | `http://127.0.0.1:8188` |
| `COMFYUI_SERVER_INPUT_DIR` | ComfyUI的input目录路径 | - |
| `FILE_SERVER_PUBLIC_IP` | 文件服务器(公网)IP(确保VCP主服务器能连接) | `127.0.0.1` |
| `FILE_SERVER_PORT` | 文件服务器端口 | `5974` |
| `FILE_SERVER_ACCESS_KEY` | 文件服务器访问密钥 | `123456` |

### 3. 工作流文件

将ComfyUI工作流文件（.json格式）放置在 `workflows/` 目录中：

- `text2img_api.json` - 文本转图像
- `img2img_api.json` - 图像转图像
- `inpaint_api.json` - 图像修复
- `controlnet_canny_api.json` - ControlNet边缘检测
- `upscale_api.json` - 图像放大

## 使用方法

### 1. 运行工作流

```javascript
// 基本使用
{
  "workflow": "text2img_api.json",
  "prompt": "a beautiful cat in a spaceship, masterpiece"
}

// 高级参数修改
{
  "workflow": "img2img_api.json",
  "params": [
    {
      "node_title": "Load Checkpoint",
      "inputs": {
        "ckpt_name": "sd_xl_base_1.0.safetensors"
      }
    },
    {
      "node_title": "Positive Prompt", 
      "inputs": {
        "text": "a beautiful cat in a spaceship, masterpiece"
      }
    }
  ]
}
```

### 2. 查询信息

```javascript
// 查看可用工作流
{
  "info": "workflows"
}

// 查看可用模型
{
  "info": "checkpoints"
}

// 查看可用LoRA
{
  "info": "loras"
}
```

### 3. 图像处理

#### URL图片处理
插件会自动下载URL图片到input目录：

```javascript
{
  "workflow": "img2img_api.json",
  "params": [
    {
      "node_title": "Load Image",
      "inputs": {
        "image": "https://example.com/image.jpg"
      }
    }
  ]
}
```

#### 本地图片处理
支持attachments目录中的图片文件：

```javascript
{
  "workflow": "img2img_api.json", 
  "params": [
    {
      "node_title": "Load Image",
      "inputs": {
        "image": "my_image.png"
      }
    }
  ]
}
```

## 工作流要求

工作流文件必须包含以下节点：

- **Positive Prompt** - 正向提示词节点
- **Save Image** - 图像保存节点  
- **KSampler** - 采样器节点（用于随机种子）

### 节点标题映射

| 工作流中的节点标题 | 功能 |
|-------------------|------|
| `Positive Prompt` | 设置正向提示词 |
| `Negative Prompt` | 设置负向提示词 |
| `Load Image` | 加载输入图像 |
| `Load Checkpoint` | 加载模型检查点 |
| `Save Image` | 保存生成图像 |
| `KSampler` | 执行采样过程 |

## 输出管理

生成的图像会保存到 `output/` 目录，文件名格式为：

```
{prefix}_{sequence_number}.png
```

其中prefix根据提示词自动生成，例如：
- `beautiful_cat_00001_.png`
- `anime_girl_00002_.png`

## 错误处理

插件包含完整的错误处理机制：

- 网络连接错误
- 工作流执行错误  
- 文件操作错误
- 参数验证错误

## 日志输出

插件会输出详细的日志信息：

```
[ComfyUI] WebSocket opened, queueing prompt...
[ComfyUI] Prompt queued with ID: 12345
[ComfyUI] Applied patch: Positive Prompt.text = a beautiful cat (was: old prompt)
[ComfyUI] Updated KSampler seed: 42 -> 123456789
[ComfyUI] Execution finished.
[ComfyUI] Image downloaded successfully. Size: 1024567 bytes.
```

## 故障排除

### 常见问题

1. **ComfyUI连接失败**
   - 检查 `COMFYUI_BASE_URL` 配置
   - 确认ComfyUI服务器正在运行
   - 检查防火墙设置

2. **图像下载失败**
   - 检查 `COMFYUI_SERVER_INPUT_DIR` 路径是否正确
   - 确认目录权限
   - 检查磁盘空间

3. **文件服务器访问失败**
   - 检查ComfyUI_InputServer插件状态
   - 确认 `FILE_SERVER_*` 配置正确
   - 检查网络连通性

### 调试模式

启用调试输出：

```javascript
// 在comfyui.js中修改
const debugMode = true;
```

## 开发信息

- **作者**: Gemini
- **版本**: 1.1.0
- **插件类型**: 同步插件
- **通信协议**: stdio
- **超时设置**: 600000ms (10分钟)

## 许可证

此插件遵循VCP项目的许可证条款。
