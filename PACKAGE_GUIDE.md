# 评审版打包指南

目标：评委在 Windows 上解压后双击 `start.bat`，自动打开：

```text
http://127.0.0.1:8001
```

## 1. 确认模型配置

后端默认使用 GLM：

```text
backend\.env
```

关键配置：

```env
LLM_PROVIDER=glm
GLM_API_KEY=你的评审临时 key
GLM_CHAT_MODEL=glm-5.1
GLM_VL_MODEL=glm-5v-turbo
```

建议使用临时 key，并在评审结束后停用或限额。

## 2. 准备内置 Python

下载 Windows embeddable Python zip，解压到：

```text
runtime\python
```

下载 `get-pip.py` 放到项目根目录，然后运行：

```powershell
.\prepare_runtime.bat
```

该脚本会启用 embedded Python 的 `site`，并把后端依赖安装到 `runtime\python`。

## 3. 构建评审包

```powershell
.\build_release.bat
```

生成目录：

```text
release\phase-diagram-assistant-review
```

确认里面至少有：

```text
start.bat
backend\
dist\
runtime\python\python.exe
knowledge_docs\
```

然后压缩 `phase-diagram-assistant-review` 文件夹发给评委。

## 4. 评委启动方式

解压后双击：

```text
start.bat
```

无需安装 Node、npm 或 Python。
