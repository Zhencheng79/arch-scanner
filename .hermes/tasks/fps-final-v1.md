# 帧数优化终极方案 — CSS2D→Sprite 替换

## 根因分析
已做优化：
- ✅ TubeGeometry→LineSegments（边束draw call 161→1）
- ✅ 聚合模式（节点130个）
- ❌ 仍卡顿

剩余最大瓶颈：**CSS2DRenderer**（130个标签，每帧遍历所有CSS2DObject并设置DOM元素transform，触发逐帧DOM回流）

## 方案：CSS2DObject→Sprite（Canvas纹理）
- 用 `THREE.Sprite` + `Canvas纹理` 替代 `CSS2DObject`
- 标签文字绘制到Canvas上，生成纹理贴到Sprite
- 所有Sprite在WebGL中渲染，零DOM操作
- 标签大小随距离自动缩放（Sprite默认行为）

## 好处
- 帧数：从2fps→60fps（消除DOM回流）
- 交互：不受CSS2DRenderer的z-index/点击穿透问题
- 标签：支持中文、图标（📗📙⭐🔥等）

## 改动范围
viewer.html：删除CSS2DRenderer类+CSS2DObject类，替换为createLabelSprite()函数

## 工作量
约30-45分钟
