# MindTree / 智语心聊

MindTree（智语心聊）是一个面向情绪记录与支持性对话的本地化 AI 应用。它不是普通聊天机器人，而是将“情绪支持对话”“本地 Markdown 心情库检索”“心理日志复盘写回”结合在一起，帮助用户在压力、焦虑、睡眠、人际关系等场景中更清楚地整理自己的状态。

<img width="2786" height="1462" alt="9770c99476332fdce14236f778558481" src="https://github.com/user-attachments/assets/f8f4bb4b-ef50-4bd1-a5e6-b3fd6a7592e5" />

项目强调三个关键词：

- **本地化**：用户可以导入自己的 Obsidian 库或任意 Markdown 文件夹作为心情库。
- **个性化**：对话时可检索历史心情记录，将相关片段作为背景线索，让回应更贴近用户自身状态。
- **支持性**：系统不做医学诊断，不替代心理咨询，只提供情绪陪伴、压力梳理和阶段性复盘。

---

<img width="2820" height="1470" alt="2c13c67b214d799d18ea6da372953276" src="https://github.com/user-attachments/assets/011a288e-9006-45b3-8cbc-6ed0e0c36357" />


## 1. 项目功能

### 1.1 情绪支持对话

用户可以输入当前的想法、压力来源或情绪困扰。后端会统一注入情绪支持类系统提示词，使模型回复更偏向：

- 先接住情绪
- 再帮助用户梳理压力来源
- 最后提供温和的追问或可执行的小建议

项目不提供医学诊断，也不会替代专业心理咨询或医疗服务。

---

### 1.2 本地 Markdown / Obsidian 心情库检索

MindTree 支持导入本地 Markdown 文件夹：

- 可以是 Obsidian 库
- 也可以是任意存放 Markdown 文件的普通文件夹
- 不强制依赖 Obsidian 软件本身

导入后，后端会扫描 `.md` 文件，将内容切分为片段并建立本地索引。对话时如果开启“检索”，系统会根据用户当前输入检索相关旧日志，并将这些片段作为上下文线索注入模型。

这部分的核心价值是：让模型不仅回应当前一句话，也能参考用户过去的情绪记录，帮助整理反复出现的压力模式。

---

### 1.3 路径重新配置与重新导入

前端底部的“心情库”面板支持：

- 更换路径
- 保存路径
- 重新导入
- 清空配置
- 开启 / 关闭检索
- 调整 Top K 检索数量

如果更换了 Obsidian / Markdown 文件夹，需要重新点击“重新导入”，让系统更新索引。

---

### 1.4 心理复盘生成与写回

在一段对话结束后，用户可以点击“生成心理复盘”。系统会根据当前会话，以及可选的心情库检索结果，生成一篇 Markdown 格式的心理日志复盘。

如果已经配置了本地 Markdown / Obsidian 库，还可以点击“写回 Obsidian”，将复盘写入指定文件夹中。

默认写回目录：

```text
MindTree Reviews
```

---

### 1.5 界面与视觉

当前版本已完成：

- 不同路由使用不同背景图
- 取消路由切换变底色功能
- 使用莫兰迪色系统一界面
- 对话气泡调整为更柔和的玻璃卡片风格
- 统一玉兰花图标视觉，包括 favicon、侧边栏、顶栏、欢迎页和关于页
- 欢迎页 / 空状态页优化
- 关于页视觉统一

---

## 2. 技术栈

### 前端

- Vue 3
- Vite
- Pinia
- Vue Router
- Markdown 渲染
- SSE 流式输出
- 本地会话存储

### 后端

- Node.js
- 原生 HTTP Server
- dotenv
- MiniSearch
- OpenAI-compatible Chat Completions API

### AI Provider

当前支持：

- DeepSeek
- 讯飞千问
- 自定义 OpenAI-compatible 接口

---

## 3. 项目结构

```text
mindtree
├── mindtree-frontend
│   ├── src
│   │   ├── api
│   │   ├── assets
│   │   ├── components
│   │   ├── composables
│   │   ├── router
│   │   ├── stores
│   │   └── views
│   ├── public
│   │   ├── images
│   │   └── favicon.svg
│   ├── package.json
│   └── vite.config.js
│
├── mindtree-backend
│   ├── index.js
│   ├── knowledge.js
│   ├── data
│   │   └── .gitkeep
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## 4. 安装与启动

### 4.1 启动后端

进入后端目录：

```bash
cd mindtree-backend
npm install
```

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，填入自己的 API Key。

然后启动：

```bash
npm run dev
```

默认后端地址：

```text
http://localhost:3000
```

可以打开以下地址检查后端状态：

```text
http://localhost:3000/health
```

如果看到 `hasApiKey: true`，说明 API Key 已经被读取。

---

### 4.2 启动前端

新开一个终端，进入前端目录：

```bash
cd mindtree-frontend
npm install
npm run dev
```

默认前端地址一般为：

```text
http://localhost:5173
```

---

## 5. 模型配置

后端通过 `.env` 中的 `AI_PROVIDER` 切换模型供应商。

---

### 5.1 使用 DeepSeek

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_PATH=/chat/completions
```

---

### 5.2 使用讯飞千问

```env
AI_PROVIDER=xunfei
XUNFEI_API_KEY=你的讯飞_API_Key
XUNFEI_MODEL=xop3qwen1b7
XUNFEI_BASE_URL=https://maas-api.cn-huabei-1.xf-yun.com
XUNFEI_API_PATH=/v2/chat/completions
```

---

### 5.3 使用其他 OpenAI-compatible 接口

```env
AI_PROVIDER=custom
OPENAI_COMPATIBLE_API_KEY=你的API_Key
OPENAI_COMPATIBLE_MODEL=模型名称
OPENAI_COMPATIBLE_BASE_URL=https://example.com
OPENAI_COMPATIBLE_API_PATH=/chat/completions
```

---

## 6. 心情库导入方法

### 6.1 准备 Markdown 文件夹

可以使用：

- Obsidian 库
- 普通 Markdown 日记文件夹
- 演示用 `MindTree_demo_mood_vault`

文件夹中只要包含 `.md` 文件即可。

---

### 6.2 获取文件夹真实路径


复制终端输出的完整路径

---

### 6.3 在前端导入

打开 MindTree 页面底部的“心情库”区域，按顺序操作：

1. 点击“更换路径”
2. 粘贴 Markdown 文件夹路径
3. 点击“保存路径”
4. 点击“重新导入”
5. 打开“检索”开关

导入成功后，页面会显示文件数量和片段数量。

---

### 6.4 清空旧路径

如果之前保存过错误路径，或者想换一个库，可以点击：

```text
清空配置
```

这只会清空 MindTree 后端保存的路径和索引文件，不会删除你的原始 Markdown 日记。

---

## 7. 安全边界

MindTree 是情绪记录与支持性对话工具，不是医疗产品。

它不会：

- 做医学诊断
- 判断用户是否患有某种心理疾病
- 替代心理咨询师或医生
- 处理即时危机中的专业干预

如果用户出现严重情绪危机、自伤或自杀念头，应优先联系身边可信的人、学校心理中心、当地心理援助热线或紧急医疗服务。

---

## 8. 当前版本说明

当前版本主要完成：

- DeepSeek / 讯飞千问 / custom provider 切换
- 本地 Markdown 心情库路径可重新配置
- 心情库重新导入与清空配置
- SSE 流式对话
- 心理复盘生成
- 心理复盘写回本地 Markdown 库
- 莫兰迪视觉系统
- 玉兰花图标统一

