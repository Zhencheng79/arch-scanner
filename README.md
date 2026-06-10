# System 3D Panorama

一个基于 React Three Fiber 的交互式 3D 系统架构可视化框架，用于在 3D 空间中直观展示 AI Agent 系统中的节点、连接和数据流。

## 功能特性

- **3D 交互式可视化** — 使用 Three.js/React Three Fiber 构建，支持旋转、缩放、平移
- **多层架构布局** — 支持按层级（Layer）组织节点，如外部接口层、基础设施层、Agent 层等
- **节点类型丰富** — 支持 Box/Sphere 等多种几何体，节点颜色、标签、状态可自定义
- **连接线/管道系统** — 支持实线、虚线、点线等多种管道样式，支持数据流动画
- **循环与闭环** — 支持定义数据循环回路（Loop Group），自动高亮闭环路径
- **信息面板** — 点击节点显示详细信息面板，展示节点属性和关联连接
- **可扩展设计** — 数据与渲染分离，只需定义 JSON 配置即可创建自定义系统全景图

## 快速开始

### 安装

```bash
npm install
```

### 运行开发服务器

```bash
npm run dev
```

默认在 http://localhost:3001 启动。

### 构建生产版本

```bash
npm run build
```

## 配置自定义系统

1. 在 `src/examples/` 目录下创建你的系统配置文件（参考 `hermes-config.js`）
2. 定义 `nodes` 数组（节点列表）和 `connections` 数组（连接列表）
3. 修改 `src/App.jsx` 中的 import 路径，指向你的配置文件
4. 运行 `npm run dev` 查看效果

详细的节点和连接配置说明请参考 [`docs/configuration.md`](docs/configuration.md)。

## 截图

> 📸 截图 Coming soon

## 技术栈

- **React 18** — UI 框架
- **Three.js / React Three Fiber** — 3D 渲染引擎
- **@react-three/drei** — R3F 辅助工具库
- **@react-three/postprocessing** — 后期处理特效
- **Vite** — 构建工具

## 许可协议

MIT License © 2026
