# 相图学习助手 - 评审版

双击 `start.bat` 启动，浏览器会打开：

```text
http://127.0.0.1:8001
```

本版本使用后端托管前端构建产物，只需要启动一个本地服务。模型提供方默认是 GLM：

```text
文字对话/出题/总结：GLM_CHAT_MODEL，默认 glm-5.1
图片理解：GLM_VL_MODEL，默认 glm-5v-turbo
```

配置文件在：

```text
backend\.env
```

如果本目录包含 `runtime\python\python.exe`，启动脚本会优先使用内置 Python；否则会尝试使用 `backend\.venv`，最后才使用系统 Python。
