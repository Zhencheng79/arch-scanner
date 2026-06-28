# 多级折叠架构方案

## 问题
当前只有两级：文件(3349)→技术模块(125)。125节点+376边已到渲染瓶颈(2fps)。
砍TubeGeometry、禁动画都只到"有改观但不够"——说明125节点级别当前硬件支撑不住。

## 解决：三级架构（军队编制思想）
```
功能模块(6-8)  ← 默认显示，永远流畅
   ↓ 双击展开
技术模块(100+) ← 按需展开
   ↓ 再展开
文件节点(3349)  ← 按需展开
```

每级节点数：6-8个 → 帧数永远60fps。用户想看细节再展开下一级。

## 需要的改动

### 1. 功能模块映射表（新文件）
定义每个技术模块属于哪个功能模块。示例：
```yaml
功能模块:
  调度中心:
    - kanban, webhook, dispatcher, cron
  研究部:
    - research, analyst, data-collection
  风控部:
    - risk-control, compliance
  系统部:
    - system, devops, gateway
  知识管理:
    - knowledge-mgmt, obsidian, plur
  内容运营:
    - content, social-media, feishu
```

### 2. viewer.html 三级视图支持
- 默认显示功能模块级（根据映射表聚合）
- 双击功能模块 → 展开为技术模块
- 再双击技术模块 → 展开为文件节点
- 折叠回退

### 3. port-tag-tool 可选增强
- 扫描时读取映射表，在tagRegistry中标记功能域

## 好处
- 帧数：60fps（每层个位数节点）
- 可读性：用户看到"调度中心、研究部"而不是"dep-xxx"
- 架构表达：真正展现系统架构而非目录结构

## 工作量
映射表定义：~30分钟
viewer.html三级视图：~1-2小时
