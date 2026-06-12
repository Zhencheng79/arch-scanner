# 3D监视器 taste-skill 视觉优化

## 分支
feature/node-spread (v0.1.46)

## 工作目录
~/projects/arch-scanner

## TASTE-SKILL 规范参考
已安装在 ~/.hermes/skills/design-taste-frontend/，核心原则：

### 1. 配色校准
- 最多 1 个强调色，饱和度 < 80%
- 不要用 AI 紫/蓝辉光默认色
- 用中性基色（Zinc/Slate/Stone）+ 高对比单一强调色
- 避免纯黑色 #000，用 off-black

### 2. 立体感与材质
- 阴影色调跟随背景色（非纯黑阴影）
- 表面质感：适当使用发光/透明分层
- 节点边缘光晕用内边框替代外发光

### 3. 排版
- 标签字体用无衬线（Geist/Satoshi/Inter）
- 不要使用 Fraunces 或 Instrument_Serif
- 字号层级：标题 > 组标签 > 节点标签

## 具体修改要求

### 1. 节点配色优化
当前颜色：
- infrastructure: #4A90D9 (蓝)
- data: #00BCD4 (青)
- business: #66BB6A (绿)
- presentation: #FFB74D (橙)
- external: #FF7043 (红橙)

目标：保持分层可识别性，但降低饱和度，统一色温风格
建议方案：冷色系渐变（从深蓝到青灰）
- infrastructure: #3B82F6 → #5B9EF4 (satu<80%)
- data: #60A5FA
- business: #34D399 (降低饱和度的绿)
- presentation: #FBBF24 (降低饱和度的黄)
- external: #F87171 (降低饱和度的红)

### 2. 材质感提升
- 节点表面：增加微妙的金属质感（metalness 调低到 0.3~0.5）
- 光泽度：roughness 统一到 0.4~0.6
- 边缘光晕：用内边框线替代现在的外发光
- 背景：从纯黑(#000)改为 off-black (#0a0a0f)

### 3. 标签排版
- 字体改为系统无衬线（-apple-system, SF Pro, sans-serif）
- 字号：组节点 14px bold，普通节点 11px normal
- 标签阴影：半透明黑底 + 微发光，取代纯黑阴影
- 标签与节点的间距统一为 0.6x 节点大小

### 4. 连线优化
- 连线颜色：使用目标节点的颜色但透明度降低(0.3)
- 连线粗细：普通 0.03，高亮时 0.06
- 流动光点：大小减半，颜色用目标节点色的亮色

## 修改文件
packages/3d-monitor/viewer.html — 修改 LAYER_CONFIG 颜色值、材质参数、标签样式、连线样式

## 验证方式
生成测试页后检查：
1. 颜色不刺眼，整体协调
2. 标签清晰可读
3. 节点有材质感
4. 连线不突兀
