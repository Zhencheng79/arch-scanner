# 3d-monitor 稳定化方案 v1

> 状态：待军师审阅
> 目标：3d-monitor 在 node-spread 和 force-layout 两分支都稳定通过验收五问
> 评分标准：≤5不能接受，6-7有重大缺陷，8接近但不够，9+可执行

---

## 一、当前状态审计

### 分支版本对比

```
main (v0.1.40 稳定版, 744KB)
  ├── feature/node-spread (v0.1.40.20, 756KB, ✅ 最新活跃)
  │    12 commits on top of main
  │    v.07 连线端点精确对齐
  │    v.10 模块Y轴分层+流向箭头+圆形虚线背景框
  │    v.11 流向箭头+背景框+连线端点修复
  │    v.12 缩小间距+枢纽高亮+修复流向箭头动画
  │    v.13 箭头加粗+模块标签+详情功能说明+统一模块配色
  │    v.14 恢复层配色+模块色边框辅助
  │    v.15 架构角色+单节点台面+背景框加粗+间距再缩
  │    v.16 修复 module bg/label/arrow Y 位置
  │    v.17 修复 node.module 未赋值（buildScene缺detectModule调用）
  │    v.18 修复 module bg/arrows/detail 不渲染（computeLayout全局扫描）
  │    v.19 修复 detectModule + 台面/箭头/详情面板
  │    v.20 修复穿模 + 图例多类型展示(节点/连接/模块/枢纽)
  │
  └── feature/force-layout (v0.1.40.15, 769KB, ⏸️ 落后)
        3 commits on top of main
        v.11 模块聚类+流向箭头+背景框+连线修复
        v.12 同步v12间距缩小+枢纽高亮到force-layout
        v.15 同步v15架构角色+单节点台面+背景框加粗+间距再缩
```

### force-layout 落后内容（7个版本）

| 版本 | 变更 | 影响范围 |
|------|------|----------|
| v.13 | 箭头加粗+模块标签+详情功能说明+统一模块配色 | 视觉/交互 |
| v.14 | 恢复层配色+模块色边框辅助 | 视觉 |
| v.16 | 修复module bg/label/arrow Y位置 | bug修复 |
| v.17 | 修复node.module未赋值 | **关键bug** |
| v.18 | 修复module bg/arrows/detail不渲染 | **关键bug** |
| v.19 | 修复detectModule模块检测+台面/箭头/详情面板 | **关键bug** + 功能 |
| v.20 | 修复穿模+图例多类型展示 | bug修复 + 视觉 |

### 代码质量问题（单文件 756KB）

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 单文件 756KB | 中 | 加载慢，编辑器卡顿，多人协作困难 |
| 无模块拆分 | 中 | buildScene ~1500行，computeLayout ~600行，全部内联 |
| 无TypeScript | 低 | 纯JS，类型不安全 |
| CSS内联 | 低 | 全部在<style>块内，响应式混在一起 |
| 无单元测试 | 高 | 改完只能肉眼验证 |

---

## 二、稳定化三大支柱

### 支柱A：force-layout 分支同步

**目标**：将 node-spread v.13-v.20 的变更逐步移植到 force-layout

**策略**：逐个版本cherry-pick + 适配（force-layout的力导向算法不同，不能直接合并）

```mermaid
force-layout v.15 ──→ 适配v.13箭头加粗/模块标签 ──→ 适配v.14层配色
                    ──→ 适配v.16 Y位置修复 ──→ 适配v.17 node.module赋值
                    ──→ 适配v.18 渲染修复 ──→ 适配v.19 detectModule
                    ──→ 适配v.20 穿模修复/图例
```

**注意**：每个版本都需要在 force-layout 的力导向算法上下文中验证，不是简单复制代码。

**风险**：力导向算法中节点位置实时计算，模块聚类等需要适配。

### 支柱B：代码质量提升

**目标**：在不改变功能的前提下，从单文件 756KB 拆分为合理模块

**方案**：
- viewer.html → 保留为入口文件（~50KB）
- 拆分 buildScene → scene-builder.js
- 拆分 computeLayout → layout-engine.js
- 拆分 UI 相关（图例/详情面板/提示框）→ ui-layer.js
- CSS 抽离 → styles.css
- Three.js 保持 CDN 加载

**不做的**：
- ❌ 不迁移 TypeScript（成本高，收益有限）
- ❌ 不改 Three.js 版本（0.128 工作正常）
- ❌ 不加单元测试（3D 渲染测试成本极高）

### 支柱C：验收五问双分支验证

**目标**：两个分支对同一项目数据渲染出"同样的架构结论"

**验收五问**：
1. 项目分几块？→ 3块：扫描引擎、3D监视器、MCP服务
2. 核心是什么？→ projectScanner.js（扫）+ viewer.html（画）
3. 数据怎么流？→ 扫描 → JSON → 3D渲染
4. 哪些是一伙的？→ projectScanner + portRegistry + tagRegistry 紧耦合一体
5. 整体能干什么？→ 扫任何项目，生成3D架构图

**验证方法**：
1. 用 port-tag-tool 扫描 arch-scanner 自身（自举）
2. 在两个分支上分别渲染
3. 逐项检查验收五问的答案是否一致
4. 截图对比两个分支的视觉效果

---

## 三、具体执行步骤

### Step 1: force-layout 同步（预计 7个子任务）

| 子任务 | 内容 | 依赖 |
|--------|------|------|
| S1.1 | 适配v.13：箭头加粗样式、模块标签系统、详情功能说明 | 无 |
| S1.2 | 适配v.14：层配色、模块色边框辅助 | S1.1 |
| S1.3 | 适配v.16：修复 module bg/label/arrow Y 位置偏移 | S1.2 |
| S1.4 | 适配v.17：buildScene 中补全 detectModule() 调用 | S1.3 |
| S1.5 | 适配v.18：computeLayout 全局扫描所有模块前缀节点 | S1.4 |
| S1.6 | 适配v.19：动态 detectModule、台面/箭头/面板 | S1.5 |
| S1.7 | 适配v.20：穿模检测（maxIter机制）、图例多类型 | S1.6 |

### Step 2: 代码拆分（预计 3个子任务）

| 子任务 | 内容 | 风险 |
|--------|------|------|
| S2.1 | CSS 抽离 → styles.css | 低，纯样式 |
| S2.2 | UI层抽离 → ui-layer.js（图例/面板/提示框） | 中，需适配DOM操作 |
| S2.3 | 场景和布局逻辑抽离 → scene-builder.js / layout-engine.js | 高，buildScene 1500行依赖深 |

### Step 3: 验收（预计 2个子任务）

| 子任务 | 内容 |
|--------|------|
| S3.1 | 自举扫描 arch-scanner，生成 JSON |
| S3.2 | 分别在两个分支打开 viewer，截图+验收五问检查 |

---

## 四、风险清单

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 代码拆分破坏现有功能 | 中 | 高 | 先备份，每拆一步验证一次 |
| force-layout 力导向算法与模块聚类冲突 | 中 | 中 | v.18的全局扫描需要适配力导向的持续运动 |
| 单文件 756KB → 多文件导致加载变慢 | 低 | 低 | 本地加载不受影响 |
| 验收五问"一致"判断主观 | 中 | 中 | 截图+文字说明，主公裁决 |

---

## 五、执行顺序建议

```
先 Step1（force-layout同步）→ 同时 Step2（代码拆分，独立不影响功能）
                                       → Step3（验收，两个分支都完成后）
```

Step1 和 Step2 可以并行，因为它们修改的是不同的文件/分支。

---

## 六、完成标准

```
□ force-layout 功能与 node-spread 一致
  □ v.13 箭头/标签/详情面板
  □ v.14 层配色/边框辅助
  □ v.16 Y位置修复
  □ v.17 node.module 赋值
  □ v.18 全局模块扫描
  □ v.19 detectModule/台面/面板
  □ v.20 穿模修复/图例多类型

□ 代码拆分完成
  □ styles.css
  □ ui-layer.js
  □ scene-builder.js / layout-engine.js

□ 验收五问通过
  □ node-spread 自举通过
  □ force-layout 自举通过
  □ 两分支架构结论一致
```

**评分标准**：此方案综合评分达到 9+ 后方可调度 Codex 执行。
