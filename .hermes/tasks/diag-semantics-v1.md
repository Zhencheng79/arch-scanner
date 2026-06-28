# 诊断语义修正方案

## 根因
auto_diagnose.js 把"连接数高"标为 overloaded（过载/负面），
但连接数高的模块实际上是核心/枢纽模块（正面/中性）。

## 修复
在 status 体系中新增 `hub` 状态（正面），替换 `overloaded`：
- healthy → 健康（绿色）
- hub → 枢纽（金色 #FFD700）— 连接数最高的模块
- warning → 预警（橙色）— 零连接（非外部依赖）
- needs-split → 需拆分（红色）— 结构异常

## 改动文件
auto_diagnose.js + viewer.html（颜色映射+图例+标签）
