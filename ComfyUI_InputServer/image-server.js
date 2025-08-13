const express = require('express');
const path = require('path');
const fs = require('fs');

// 解析配置字符串为 Map 对象
// 格式: alias1:path1;alias2:path2
function parseMounts(mountsString) {
    const mounts = new Map();
    if (!mountsString) return mounts;

    const pairs = mountsString.split(';');
    for (const pair of pairs) {
        const parts = pair.split(':');
        if (parts.length >= 2) {
            const alias = parts[0].trim();
            const mountPath = parts.slice(1).join(':').trim();
            if (alias && mountPath) {
                mounts.set(alias, mountPath);
            }
        }
    }
    return mounts;
}

function registerRoutes(app, pluginConfig, projectBasePath) {
    const debugMode = pluginConfig.DebugMode || false;
    const accessKey = pluginConfig.COMFYUI_ACCESS_KEY;
    const mountsString = pluginConfig.COMFYUI_MOUNTS;

    if (!accessKey || !mountsString) {
        console.error('[ComfyUI_InputServer] 错误: config.env 中缺少 COMFYUI_ACCESS_KEY 或 COMFYUI_MOUNTS。');
        return;
    }

    const mounts = parseMounts(mountsString);
    if (mounts.size === 0) {
        console.error('[ComfyUI_InputServer] 错误: 未能从 COMFYUI_MOUNTS 解析出任何有效的路径配置。');
        return;
    }

    // 使用正则表达式来定义路由，以正确处理 pw=<key> 格式
    const routeRegex = /^\/comfyui_server\/pw=([^\/]+)\/files\/([^\/]+)\/(.*)$/;

    app.get(routeRegex, (req, res) => {
        // 从正则表达式的捕获组中获取参数
        const requestKey = req.params[0];
        const mountAlias = req.params[1];
        const requestedFile = req.params[2];

        if (requestKey !== accessKey) {
            return res.status(401).send('Unauthorized');
        }

        const basePath = mounts.get(mountAlias);
        if (!basePath) {
            return res.status(404).send(`Mount point '${mountAlias}' not found.`);
        }

        if (!requestedFile) {
            return res.status(400).send('Bad Request: Missing filename.');
        }

        const resolvedBasePath = path.resolve(basePath);
        if (!fs.existsSync(resolvedBasePath)) {
            return res.status(500).send(`Server error: Configured path for '${mountAlias}' does not exist.`);
        }

        const fullFilePath = path.resolve(path.join(resolvedBasePath, requestedFile));

        if (!fullFilePath.startsWith(resolvedBasePath)) {
             return res.status(403).send('Forbidden');
        }
        
        res.sendFile(fullFilePath, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(404).send('File not found');
                }
            }
        });
    });

    console.log(`[ComfyUI_InputServer] ComfyUI 多路径文件服务已启动。`);
    mounts.forEach((value, key) => {
        console.log(`  - 别名 '${key}' -> 托管目录: ${value}`);
    });
    console.log(`[ComfyUI_InputServer] 访问路径格式: /comfyui_server/pw=<密钥>/files/<别名>/<文件名>`);
}

module.exports = { registerRoutes };
