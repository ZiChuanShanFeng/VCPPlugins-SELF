# ComfyUI Input Server Plugin for VCP

[English](README.md) | [中文](README_CN.md)

## 概述

ComfyUI Input Server是一个为VCP设计的文件服务插件，提供多路径文件访问服务。它允许通过HTTP协议安全地访问多个指定目录中的文件，特别适用于ComfyUI的output目录和AppData的attachments目录。

## 功能特性

- 🗂️ **多路径支持**：同时托管多个文件目录
- 🔒 **安全认证**：基于访问密钥的身份验证
- 🛡️ **路径安全**：防止目录遍历攻击
- 🌐 **HTTP服务**：提供标准的HTTP文件访问
- 🔧 **灵活配置**：支持动态路径映射
- 📊 **调试支持**：可选的调试模式

## 架构设计

### 核心组件

1. **Express.js服务器**：提供HTTP服务
2. **路径解析器**：解析配置的挂载点
3. **安全中间件**：处理认证和路径验证
4. **文件服务**：提供静态文件访问

### 路由结构

```
/comfyui_server/pw=<access_key>/files/<mount_alias>/<filename>
```

- `pw=<access_key>`：访问密钥认证
- `files/<mount_alias>`：挂载点别名
- `<filename>`：目标文件名

## 安装要求

- Node.js 16+
- Express.js
- 文件系统访问权限

## 配置说明

### 1. 创建配置文件

复制 `config.env.example` 为 `config.env`：

```bash
cp config.env.example config.env
```

### 2. 配置参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `COMFYUI_MOUNTS` | 多路径配置，格式：`alias:path;alias2:path2` | `output:C:\ComfyUI\output;attachments:C:\AppData\attachments` |
| `COMFYUI_ACCESS_KEY` | 访问密钥 | `123456` |
| `DebugMode` | 调试模式 | `false` |

### 3. 路径配置示例

#### Windows配置
```env
COMFYUI_MOUNTS=output:C:\Users\username\VCP\Plugin\ComfyUI\output;attachments:C:\Users\username\VCP\AppData\attachments
```

#### Linux配置
```env
COMFYUI_MOUNTS=output:/home/username/vcp/plugin/comfyui/output;attachments:/home/username/vcp/appdata/attachments
```

## 使用方法

### 1. 启动服务

插件会在VCP启动时自动启动HTTP服务：

```
[ComfyUI_InputServer] ComfyUI 多路径文件服务已启动。
  - 别名 'output' -> 托管目录: C:\VCP\Plugin\ComfyUI\output
  - 别名 'attachments' -> 托管目录: C:\VCP\AppData\attachments
[ComfyUI_InputServer] 访问路径格式: /comfyui_server/pw=<密钥>/files/<别名>/<文件名>
```

### 2. 访问文件

#### 访问ComfyUI输出图像
```
http://localhost:5974/comfyui_server/pw=123456/files/output/beautiful_cat_00001_.png
```

#### 访问附件文件
```
http://localhost:5974/comfyui_server/pw=123456/files/attachments/my_image.png
```

### 3. 在其他插件中使用

#### ComfyUI插件集成
ComfyUI插件使用InputServer来访问生成的图像：

```javascript
// 在comfyui.js中
const fileUrl = `http://${config.fileServerIp}:${config.fileServerPort}/comfyui_server/pw=${config.fileServerKey}/files/${mountAlias}/${filename}`;
```

#### 其他插件集成
任何插件都可以通过配置的参数访问文件：

```javascript
const imageUrl = `http://${FILE_SERVER_PUBLIC_IP}:${FILE_SERVER_PORT}/comfyui_server/pw=${FILE_SERVER_ACCESS_KEY}/files/attachments/image.jpg`;
```

## 安全特性

### 1. 访问认证

- 所有请求都需要提供正确的访问密钥
- 密钥验证失败返回401状态码

### 2. 路径安全

- 使用路径解析防止目录遍历攻击
- 检查请求文件是否在配置的挂载点内
- 使用绝对路径解析确保安全性

### 3. 错误处理

- 文件不存在返回404
- 权限不足返回403
- 配置错误返回500

## 调试和监控

### 1. 启用调试模式

```env
DebugMode=true
```

### 2. 日志输出

```javascript
// 启动日志
[ComfyUI_InputServer] ComfyUI 多路径文件服务已启动。
[ComfyUI_InputServer] 别名 'output' -> 托管目录: /path/to/output

// 错误日志
[ComfyUI_InputServer] 错误: config.env 中缺少 COMFYUI_ACCESS_KEY 或 COMFYUI_MOUNTS。
[ComfyUI_InputServer] 错误: 未能从 COMFYUI_MOUNTS 解析出任何有效的路径配置。
```

### 3. 健康检查

可以通过访问根路径来检查服务状态：

```bash
curl http://localhost:5974/
```

## 性能优化

### 1. 缓存策略

- Express.js默认使用内存缓存
- 大文件使用流式传输
- 支持浏览器缓存头

### 2. 并发处理

- 支持多个并发文件请求
- 异步文件处理
- 非阻塞I/O操作

## 故障排除

### 常见问题

1. **服务启动失败**
   - 检查 `COMFYUI_MOUNTS` 配置格式
   - 确认路径存在且可访问
   - 检查端口占用情况

2. **访问被拒绝**
   - 验证访问密钥是否正确
   - 检查文件路径是否在挂载点内
   - 确认文件存在且可读

3. **路径解析错误**
   - 使用绝对路径
   - 检查路径分隔符
   - 验证路径格式

### 调试步骤

1. 检查配置文件语法
2. 验证路径存在性
3. 测试访问密钥
4. 检查文件权限
5. 查看详细日志

## API参考

### 路由端点

```
GET /comfyui_server/pw=<key>/files/<alias>/<filename>
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | string | 访问密钥 |
| `alias` | string | 挂载点别名 |
| `filename` | string | 文件名 |

#### 响应

- **200 OK**: 文件内容
- **401 Unauthorized**: 访问密钥错误
- **403 Forbidden**: 路径越权
- **404 Not Found**: 文件不存在
- **500 Internal Server Error**: 服务器错误

## 开发信息

- **作者**: Gemini & Kilo Code
- **版本**: 1.1.0
- **插件类型**: 服务插件
- **通信协议**: direct
- **技术栈**: Node.js, Express.js

## 扩展开发

### 添加新的挂载点

1. 修改 `config.env` 中的 `COMFYUI_MOUNTS`
2. 重启服务
3. 测试新挂载点的访问

### 自定义中间件

可以在 `registerRoutes` 函数中添加自定义中间件：

```javascript
// 添加访问日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
```

### 添加认证方式

可以扩展支持多种认证方式：

```javascript
// 支持Bearer Token
const authHeader = req.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // 验证token
}
```

## 许可证

此插件遵循VCP项目的许可证条款。