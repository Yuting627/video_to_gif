# 视频转 GIF

在浏览器中上传视频，一键转换为 GIF 并下载。使用 React + Vite + Tailwind CSS + shadcn 风格组件，界面为活泼卡通/马卡龙配色。

## 网页功能

- **上传视频**：支持 MP4、WebM 等常见格式，选择后生成本地预览 URL。
- **视频预览**：左侧预览区播放所选视频，使用原生 `controls`，禁用画中画与远程播放（`disablePictureInPicture` / `disableRemotePlayback`），支持 `playsInline` 与静音。
- **转为 GIF**：在页面内转换，参数为最大宽度 480px、约 10fps、最长 6 秒、128 色调色板；转换过程显示进度条。
- **GIF 预览**：转换完成后右侧展示生成的 GIF。
- **下载**：支持「另存为…」（使用 File System Access API 选路径）与「下载到默认目录」；文件名与视频一致（扩展名改为 `.gif`）。
- **重新选择**：清空当前视频与 GIF，回到上传状态。

所有处理在本地完成，视频不会上传到任何服务器。

## 技术栈与框架

| 类别     | 技术 |
|----------|------|
| 框架     | React 18 + TypeScript |
| 构建     | Vite 5 |
| 样式     | Tailwind CSS |
| UI 组件  | shadcn 风格（Button、Card 等）+ [lucide-react](https://lucide.dev/) 图标 |
| GIF 编码 | [gifenc](https://github.com/mattdesl/gifenc)（浏览器端编码，Canvas 取帧 + 调色 + 编码） |
| 产出     | 单文件静态页（vite-plugin-singlefile，JS/CSS 内联到 `dist/index.html`） |

## 项目结构

```
video_to_gif/
├── index.html              # 开发入口 HTML
├── package.json
├── vite.config.ts          # Vite 配置：base "./"，React 插件，singlefile 插件，@/ → src/
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── install.bat              # 安装依赖（首次）
├── start.bat                # 启动开发服务器
├── src/
│   ├── main.tsx             # React 挂载与根组件
│   ├── App.tsx              # 主界面：上传、预览、转换、下载、状态与错误处理
│   ├── index.css            # 全局样式与 Tailwind 入口
│   ├── vite-env.d.ts
│   ├── lib/
│   │   ├── video-to-gif.ts  # 核心：从 <video> 取帧并编码为 GIF（gifenc）
│   │   └── utils.ts         # 通用工具（如 cn）
│   └── components/
│       └── ui/              # 基础 UI 组件（button、card）
├── dist/
│   └── index.html           # 构建产物：单文件静态页，可直接打开
└── README.md
```

- **入口**：`index.html` → `src/main.tsx` → `App.tsx`。
- **业务逻辑**：`App.tsx` 管理文件、URL、步骤（idle/ready/converting/done/error）、进度与错误；调用 `src/lib/video-to-gif.ts` 完成转换。
- **转换流程**：`videoToGif(video, options)` 等待视频可读 → 按 `maxDuration`/fps 计算帧数与时间点 → 逐帧 `video.currentTime` + Canvas 绘制 → gifenc 量化与编码 → 返回 `Blob`，由 App 生成 Object URL 用于预览与下载。

## 本地运行

**方式一：批处理（推荐）**

1. 双击 **`install.bat`** 安装依赖（仅首次）
2. 双击 **`start.bat`** 启动开发服务器
3. 浏览器打开终端提示的地址（一般为 http://localhost:5173）

**方式二：命令行**

```bash
npm install
npm run dev
```

若 PowerShell 报「禁止运行脚本」，可用 **CMD** 进入项目目录再执行，或使用方式一。

## 构建与预览

```bash
npm run build    # 输出 dist/index.html（单文件）
npm run preview  # 预览构建结果
```

构建后的 `dist/index.html` 可直接用浏览器打开（相对路径，无需服务器）。

## 界面说明

- 主背景：石灰绿（CSS 变量）
- 主按钮：亮黄绿 + 粗深色描边 + 轻微阴影
- 卡片：白底、圆角、粗深色边框
- 上传区/进度区：马卡龙色块（淡黄、淡紫、淡蓝等）


## Video Cutter功能
左边的视频预览模块改为极简的Video Cutter功能，核心约束：单次剪辑的视频片段最长仅5秒，视频播放时仅播放圈选的片段，功能极简、界面简洁，无冗余交互。

## 一、核心功能（仅保留必要项）
1. 视频预览：上传后显示视频播放器（仅保留播放/暂停按钮，无倍速/全屏/音量控制）；
3. 剪辑操作：
   - 方式1：时间轴拖拽（仅显示“开始点”“结束点”两个可拖拽标记，时间轴刻度仅显示秒数）；
   - 方式2：手动输入起止时间（输入框仅支持数字，单位为秒，如“3”代表00:00:03）；
4. 导出功能：剪辑确认后，点击转换gif，仅转换圈选的视频片段；
5. 片段播放：播放器仅播放圈选的起止时间范围内的片段，超出范围自动停止/循环。

## 二、核心交互规则
### （一）5秒限制交互（强制且极简）
1. 拖拽限制：
   - 拖拽开始/结束标记时，系统实时计算时长，超过5秒则标记点无法拖动（吸附到5秒上限）；
   - 时间轴下方仅显示“当前时长：X秒（最大5秒）”，X≤4秒为黑色，X=5秒为绿色；
2. 输入限制：
   - 输入框仅允许输入数字，输入结束时间后自动校验，若（结束-开始）>5秒，输入框边框变红，下方显示红色小字提示“最长仅可剪辑5秒”，导出按钮置灰；
   - 若（结束-开始）≤5秒，输入框恢复正常，导出按钮激活；
3. 特殊场景：若上传视频总时长<5秒，自动全选整个视频，提示“视频不足5秒，已全选”。

### （二）仅播放圈选片段的交互（核心新增）
1. 播放范围锁定：
   - 首次上传视频未圈选片段时，播放器默认播放整个视频，但时间轴无标记点，导出按钮置灰；
   - 一旦圈选片段（拖拽/输入起止时间），播放器立即锁定播放范围：
     - 播放到结束标记点时，自动暂停；
     - 若用户手动拖动进度条到圈选范围外，进度条自动回弹到开始标记点，并暂停播放；
2. 播放控制优化：
   - 点击“播放”按钮，从开始标记点开始播放，到结束标记点停止；
   - 无“循环播放”按钮，默认单次播放片段，如需重播需再次点击播放按钮（简化交互）；
3. 实时同步：
   - 拖拽标记点/修改输入框时间后，播放器立即更新播放范围，无需额外确认；
   - 播放过程中修改标记点，播放器立即暂停，并定位到新的开始标记点。

## 四、输出要求
1. 代码注释仅标注核心逻辑：5秒限制校验、拖拽吸附、播放范围锁定、进度条回弹；
2. 说明运行方式（仅需浏览器打开HTML文件）；
3. 列出关键交互逻辑的实现思路（如播放范围锁定的核心代码行说明）。

### 实现说明
- **运行方式**：构建后浏览器直接打开 `dist/index.html` 即可（单文件，无需服务器）。
- **5秒限制**：`setStartFromSec` / `setEndFromSec` 内用 `maxStart = end - MAX_CLIP_SEC`、`maxEnd = start + MAX_CLIP_SEC` 做拖拽吸附；输入框在 `handleStartInputChange` / `handleEndInputChange` 中校验并吸附。
- **播放范围锁定**：`timeupdate` 中若 `currentTime >= clipEnd` 则暂停；`seeked` 中若当前时间超出圈选范围则回弹到 `clipStart` 并暂停。
- **圈选变更**：`clipStart`/`clipEnd` 变更的 effect 中执行 `video.pause()` 并 `currentTime = clipStart`。