# 3D监视器：按逻辑模块聚类 + 管道流向展示

## 分支
feature/node-spread (v0.1.40-node-spread.08)

## 工作目录
~/projects/arch-scanner

## 目标
让不懂技术的人看 3D 图能读出项目架构，不靠点击标签。

## 现状
扫描结果中有 7 个核心模块（extraction/db/resolution/graph/context/mcp/installer），
但全部混在 presentation 层的 141 个节点中，看不出来。

## 修改要求

### 1. 模块检测
在 viewer.html 的 buildScene 中，根据节点 ID 前缀自动检测模块归属：
```
extraction-* → 提取模块
db-* → 存储模块
resolution-* → 解析模块
graph-* → 图查询模块
context-* → 上下文模块
mcp-* → MCP服务模块
installer-* → 安装模块
bin-* → CLI模块
```
未被识别的节点归入「其他」。

### 2. 模块聚类布局
在同一 Y 层内，按模块做二次聚类：
- 同模块的节点在 XZ 平面上聚在一起
- 模块之间有明显间距
- 模块整体加半透明背景框（rounded rect）
- 模块上方加模块名标签

### 3. 管道流向
- 模块之间按数据流向（extraction→db→resolution→graph→context→mcp）用粗箭头连接
- 箭头颜色：从蓝色渐变到紫色
- 箭头带流动动画

### 4. 模块间连线降噪
- 模块内部的连线保持半透明
- 模块之间的主要连线加亮
- 无关的细碎连线淡化

### 5. 集成度高亮
- extraction+db → 高亮为「数据管道集成」
- graph+resolution → 高亮为「查询引擎集成」
- mcp+context → 高亮为「交付层集成」

## 版本号
v0.1.40-node-spread.09

## 验证标准
1. 7 个模块在 3D 图中可清晰分辨
2. 数据流向一目了然
3. node-spread 和 force-layout 两个版本读出同样的模块结构
4. 不懂技术的人看 3D 图能说出「这项目分 7 块、数据从提取→存储→解析→查询→输出」

## 技能要求
- design-taste-frontend — 视觉规范参考
- js-code-quality — 代码质量
- architecture-visualization-standard — 验收标准
