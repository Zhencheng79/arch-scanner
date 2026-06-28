# Phase 2a 执行方案：启发式自动标注

## 目标
创建独立脚本 `packages/3d-monitor/scripts/auto_diagnose.js`，读取 port-tag-tool 扫描输出的 JSON，自动为每个节点和模块添加 `agentDiagnosis` 字段。

## 输入输出

**输入**：port-tag-tool 扫描输出的 JSON（含 nodes/connections/modules）

**输出**：同结构 JSON，每个节点增加 `agentDiagnosis` 字段

```json
{
  "nodes": [
    {
      "id": "packages-port-tag-tool--projectScanner",
      "module": "packages-port-tag-tool",
      // ...原有字段不变
      "agentDiagnosis": {
        "status": "warning",     // 基于连接数判定
        "role": "hub",           // 基于连接数和模块数判定
        "summary": "",           // Phase 2a 不生成，留空
        "detail": "",            // Phase 2a 不生成，留空
        "suggestions": []        // Phase 2a 不生成
      }
    }
  ],
  "modules": [
    {
      "name": "packages-port-tag-tool",
      // ...原有字段
      "agentDiagnosis": {
        "status": "healthy",     // 基于模块内节点数判定
        "summary": "",
        "detail": "",
        "suggestions": []
      }
    }
  ],
  "global": {
    "score": 7.0,                // 加权计算
    "issues": [],
    "suggestions": []
  }
}
```

**注意**：summary/detail/suggestions 留空（Phase 2b LLM 诊断时才生成），但 viewer.html 已有 fallback 处理（空字段不显示）。

## 判定规则（直接来自 v2 方案）

### 节点 status

| 状态 | 判定条件 | 颜色 |
|------|----------|------|
| risk | 扇入+扇出 > 20，或有循环引用，或连接 ≥3 个不同模块 | 🔴 #F44336 |
| warning | 扇入或扇出 > 10 但 < 20，或跨 2 个模块 | 🟡 #FF9800 |
| healthy | 以上都不满足 | 🟢 #4CAF50 |

### 节点 role

| 角色 | 判定条件 | 颜色 |
|------|----------|------|
| hub | 扇入+扇出 > 15，或连接 ≥3 个不同模块 | 金 #FFD700 |
| bridge | 连接 2 个模块且是唯一通信路径 | 紫 #9C27B0 |
| leaf | 扇出 = 0（只被引入不引入别人） | 灰 #9E9E9E |
| normal | 以上都不满足 | 白 #FFFFFF |

### 模块 status

| 状态 | 判定条件 |
|------|----------|
| overloaded | 模块内节点数 > 10，或模块间连接数 > 20 |
| needs-split | 模块内节点数 > 6 且存在 2 种以上不同的 layer |
| healthy | 以上都不满足 |

### 全局评分
各模块健康度加权平均：healthy=8分/needs-split=5分/overloaded=3分，按节点数加权。

## 实现方式

- 独立脚本 `packages/3d-monitor/scripts/auto_diagnose.js`
- Node.js 可执行：`node scripts/auto_diagnose.js < input.json > output.json`
- 也可作为模块被 load-data.html 或其他流程调用
- 不修改 viewer.html 或 projectScanner.js 的任何代码

## 验收条件

1. arch-scanner 自身项目跑通
2. hermes-agent 项目跑通（3349节点）
3. 与赵公明手动标注对比，status 准确率 ≥ 90%，role 准确率 ≥ 85%
4. 处理耗时 < 5 秒（3349节点）
5. 无 agentDiagnosis 的数据 viewer 仍正常显示（绿色 fallback）
