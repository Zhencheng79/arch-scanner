# 3D监视器 v0.1.40-node-spread.10: 模块间流向箭头 + Y轴模块分层

## 工作目录
~/projects/arch-scanner

## 分支
feature/node-spread

## 前置条件
v0.1.40-node-spread.09 已完成：
- MODULE_CONFIG 定义了 8 个模块类型
- detectModule() 按节点ID前缀识别模块
- moduleGroup 分组已建立

## 本轮需要完成

### 1. 模块间流向箭头
在 moduleGroup 中，按数据流向绘制粗管道箭头：
```
提取模块 → 存储模块 → 解析模块 → 图查询模块 → 上下文模块 → MCP服务模块
                    ↘                     ↗
                  安装模块            CLI模块
```
- 用 Three.js TubeGeometry，管径 0.08，颜色蓝渐变紫
- 箭头带流动光点动画（像数据在管道里流动）
- 箭头两端用锥体表示方向

### 2. Y轴按模块分层
目前所有模块都在同一 Y 层（presentation）。改为：
- 每个模块一个独立的 Y 层
- 按管道顺序从上到下排列（提取→存储→解析→图查询→上下文→MCP）
- 模块之间 Y 间距 = 1.5
- 未被识别的节点（'other'）放在最底层

### 3. 模块背景框
每个模块组的节点外面加半透明背景框（圆角矩形）
- 颜色 = 模块配置颜色，透明度 0.08
- 虚线边框，透明度 0.15
- 框上面加模块名标签

## 版本号
v0.1.40-node-spread.10

## 验证
对照 5 问验收标准：
1. 3 大模块（扫描引擎/3D监视器/MCP服务）是否可分辨？→ 扫描引擎=extraction+db+resolution+graph，3D监视器=context，MCP=mcp+cli
2. 核心是否突出？→ projectScanner.js viewer.html 是否明显
3. 数据流向是否一目了然？→ 箭头指向是否清晰
4. 是否看出哪些是一伙的？→ extraction+db+resolution+graph 颜色相近形成大块
5. 整体能否看懂？→ 找不懂技术的人看一眼试试

## 技能要求
- design-taste-frontend — 视觉规范
- js-code-quality — 代码质量
- architecture-visualization-standard — 验收标准
