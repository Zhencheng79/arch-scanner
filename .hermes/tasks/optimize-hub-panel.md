# 3D监视器优化：枢纽节点高亮 + 详情面板

## 分支
feature/node-spread (v0.1.40-node-spread.07)

## 工作目录
~/projects/arch-scanner

## 问题
当前254节点/760连接的场景中，所有节点视觉上一视同仁。
vitest（69连接）、Tests（64）、Types（59）、src（41）这些核心枢纽跟普通节点完全一样，用户看不出哪是重点。
且点击节点无任何反馈。

## 修改要求

### 1. 枢纽节点视觉高亮
在 buildScene 函数中，创建节点时根据连接数调整外观：

- **连接数 ≥ 50**（如 vitest 69条）: 
  - 节点尺寸放大 1.5 倍
  - 增加发光强度（emissiveIntensity 翻倍）
  - 添加光晕环（一个半透明的外圈 mesh）

- **连接数 20-49**（如 src 41条, Types 59条）:
  - 节点尺寸放大 1.2 倍
  - emissiveIntensity 增加 50%

- **连接数 < 20**:
  - 正常大小

### 2. 节点详情面板（点击显示）
点击节点时弹出一个固定位置的信息面板，显示：
- 节点名称（chineseName）
- 英文名（label/id）
- 所属层级（layer）
- 连接数统计：有多少条入站连接、多少条出站连接
- 该节点连接的主要目标列表（前10个）

面板样式：毛玻璃效果（参考 taste-skill 的 glassmorphism 规范）

### 3. 连接数统计函数
新增一个工具函数 computeNodeDegree(nodeId, connections)，返回 {inbound, outbound, total}

## 修改文件
packages/3d-monitor/viewer.html

## 版本号
v0.1.40-node-spread.08

## 验证
1. 枢纽节点（vitest/types/src）视觉上明显比其他节点大且亮
2. 点击任意节点弹出详情面板
3. 详情面板信息正确
4. 无 JS 报错

## 技能要求
- design-taste-frontend — 面板样式参考
- js-code-quality — 代码质量
