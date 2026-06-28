# v0.1.40-node-spread.13: 让图能讲清楚故事

## 工作目录
~/projects/arch-scanner
分支: feature/node-spread

## 问题（基于用户实际读图反馈）
1. 流向箭头看不清 → 太细/颜色不够亮/流动光点不明显
2. 模块背景框没名字 → 台面上看不到这层叫什么
3. 详情页没功能说明 → 点了节点不知道它是干嘛的
4. 旧5层颜色和模块颜色打架 → 移除旧layer着色，统一用模块颜色
5. 节点穿模 → 碰撞检测加强

## 修改

### 1. 流向箭头加粗加亮
- tubeRadius: 0.14 → 0.25
- opacity: 0.75 → 0.9
- 流动光点从6个增加到12个，速度加快
- 箭头锥体加大一倍

### 2. 模块背景框加标签
在模块背景框上方添加3D文字标签（使用CSS2DRenderer或Sprite）
显示模块名称：如「提取模块」「存储模块」「解析模块」...

### 3. 详情面板加功能说明
在节点详情面板中增加：
- 中文名（已有）
- **功能说明**（从nodeData.description或chineseDesc读取，并展示）
- 所属模块
- 连接的目标节点列表

### 4. 移除旧layer颜色系统
- 不再使用LAYER_CONFIG的颜色
- 所有节点统一用模块颜色（MODULE_CONFIG）
- 图例也更新为模块颜色

### 5. 节点碰撞检测加强
- collisionCheck 中增加 margin
- 确保节点之间最小距离

## 版本
v0.1.40-node-spread.13

## 技能
design-taste-frontend, js-code-quality
