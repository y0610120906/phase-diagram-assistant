# 相图学习助手

《物理化学》课程苏格拉底式 AI 助教，专精相图教学。Electron + React + Python FastAPI 桌面应用。

## 快速开始

### 1. 安装依赖

```bash
# 前端
npm install

# 后端
cd backend
pip install -r requirements.txt
```

### 2. 配置 API Key

在 `backend/.env` 中填入千问 API Key：

```
DASHSCOPE_API_KEY=你的key
LLM_PROVIDER=qwen
```

### 3. 启动

双击 `start.bat`，或分别开两个终端：

```bash
# 后端 (端口 8001)
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8001

# 前端 (端口 5173)
npx vite
```

浏览器打开 `http://localhost:5173`

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面 | Electron |
| 前端 | React + TypeScript + Tailwind CSS + Zustand |
| 后端 | Python FastAPI |
| LLM | DashScope API (qwen-max / qwen-vl-max) |
| 知识库 | ChromaDB + PyMuPDF + python-docx |
| 可视化 | matplotlib |

## 项目结构

```
├── electron/          # Electron 主进程
├── src/               # React 渲染进程
│   ├── components/    # UI 组件
│   ├── store/         # Zustand 状态
│   ├── services/      # API 调用
│   ├── hooks/         # 自定义 hooks
│   └── styles/        # 全局样式 + 主题
├── backend/           # Python FastAPI
│   ├── routers/       # API 路由
│   ├── services/      # 业务逻辑
│   ├── tools/         # Function Calling 工具
│   ├── skills/        # 教学技能提示词
│   ├── models/        # Pydantic 模型
│   └── storage/       # 会话 + ChromaDB
├── knowledge_docs/    # 知识库源文件（上传后自动索引）
├── index.html         # 入口 HTML
├── start.bat          # 一键启动脚本
└── README.md
```

## 主要功能

- 📖 苏格拉底式对话教学（概念讲解、图表分析、习题引导、知识回顾）
- 🛠️ 5 个工具：杠杆定律计算、冷却曲线模拟、铁碳相图渲染、通用相图渲染、反应辨析
- 📝 出题自测：5 种题型 + 自动批改
- 📚 知识库：PDF/DOCX 上传 + ChromaDB 向量检索
- 📊 学习档案：时间线、趋势、知识图谱
- 🧾 学习总结：自动生成 + 导出图片
- 🌓 明暗双主题（暖沙）
- 💬 多段消息输出 + 流式渲染

## 注意事项

- 首次启动后端会自动创建 `backend/storage/` 目录
- 知识库文件放到 `backend/knowledge_docs/`，前端上传或拖拽即可
- 切换模型：改 `backend/.env` 中 `LLM_PROVIDER=qwen|glm`
- 浅色主题：侧边栏底部 ☀️ 按钮
