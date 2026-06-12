# 修复图例线束颜色与 LAYER_CONFIG 一致

## 分支
feature/node-spread (v0.1.46)

## 工作目录
~/projects/arch-scanner

## 问题
图例底部的 flow type 线色条（control/data/event/knowledge）使用 FLOW_COLORS 的旧色值，但实际连线使用 resolveLayerColor() 即 LAYER_CONFIG 的新颜色。

## 修改要求

### 1. 更新图例 HTML（viewer.html 约105-108行）
将 flow type 线色条改为显示 layer 颜色，与节点 dots 保持一致：

旧：
```
<span class="line-sample" style="background:#4FC3F7"></span>control
<span class="line-sample" style="background:#00BCD4;margin-left:6px"></span>data
<span class="line-sample" style="background:#E040FB;margin-left:6px"></span>event
<span class="line-sample" style="background:#7B1FA2;margin-left:6px"></span>knowledge
```

新（与 LAYER_CONFIG 颜色统一）：
```
基础设施层线 — 用 LAYER_CONFIG.infrastructure.color 的颜色值
数据层线 — 用 LAYER_CONFIG.data.color
...以此类推
```

### 2. 或者直接改为用 JS 动态生成图例
从 LAYER_CONFIG 读取颜色，确保一次性改到位不再脱节

## 修改文件
packages/3d-monitor/viewer.html — legend HTML 部分

## 验证
生成测试页，确认图例 dots 颜色与 line-sample 颜色一致，且与节点/连线颜色匹配
