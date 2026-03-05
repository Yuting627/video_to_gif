# 视频转 GIF

在浏览器中上传视频，一键转换为 GIF 并下载。使用 React + Vite + Tailwind CSS + shadcn 风格组件，界面风格参考活泼卡通/马卡龙配色。

## 功能

- **上传视频**：支持 MP4、WebM 等常见格式
- **转为 GIF**：在页面内转换（最大宽度 480px、约 10fps、最长 6 秒、128 色）
- **下载 GIF**：一键下载，文件名与视频一致

所有处理在本地完成，视频不会上传到任何服务器。

## 本地运行

**方式一：批处理（推荐，避免 PowerShell 脚本限制）**

1. 双击运行 **`install.bat`** 安装依赖（只需首次执行）
2. 双击运行 **`start.bat`** 启动开发服务器
3. 在浏览器打开终端里显示的地址（一般为 http://localhost:5173）

**方式二：命令行**

```bash
npm install
npm run dev
```

若在 PowerShell 中遇到“禁止运行脚本”错误，请用 **CMD（命令提示符）** 进入项目目录再执行上述命令，或直接使用方式一。

## 构建

```bash
npm run build
npm run preview   # 预览构建结果
```

## 技术栈

- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- [gifenc](https://github.com/mattdesl/gifenc)：浏览器端 GIF 编码

## 界面说明

- 主背景：石灰绿
- 主按钮：亮黄绿色 + 粗深色描边 + 轻微阴影
- 卡片：白底 + 圆角 + 粗深色边框
- 上传区/进度区：马卡龙色块（淡黄、淡紫、淡蓝等）
