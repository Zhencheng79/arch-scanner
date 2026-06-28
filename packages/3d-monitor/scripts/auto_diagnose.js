#!/usr/bin/env node

/**
 * auto_diagnose.js - 启发式自动诊断标注脚本
 *
 * 从 stdin 读取 hermes-agent-scan.json（标准架构扫描数据），
 * 对每个 node/module/global 层级添加 agentDiagnosis 标注字段。
 *
 * Phase 2a：只填充 status/role（节点）和 status（模块/全局），
 * summary/detail/suggestions 留空。
 *
 * 使用方式：
 *   cat hermes-agent-scan.json | node scripts/auto_diagnose.js > diagnosis.json
 *
 * 依赖：仅 Node.js 内置模块
 */

'use strict';

// ============================================================
// 1. 从 stdin 读取全部输入
// ============================================================
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', (err) => reject(new Error(`stdin 读取失败: ${err.message}`)));
  });
}

// ============================================================
// 2. 工具函数：统计连接数和跨模块连接
// ============================================================

/**
 * 从节点 ID 中提取模块前缀（-- 之前的部分）
 * 如 "data--systemData" → "data"
 */
function getModulePrefix(nodeId) {
  const idx = nodeId.indexOf('--');
  return idx === -1 ? nodeId : nodeId.slice(0, idx);
}

/**
 * 判断节点是否为"文件节点"（description 以 "File:" 开头）
 * 文件节点是扫描工具对源代码文件的清单记录，架构意义较弱
 */
function isFileNode(nodeData) {
  return (nodeData.description || '').startsWith('File:');
}

/**
 * 判断节点是否为"模块头节点"（ID 中不含 "--"，description 含 "Module:"）
 * 模块头节点是目录分组的标记节点，不是实际程序组件
 */
function isModuleHeader(nodeData) {
  return !nodeData.id.includes('--') && (nodeData.description || '').includes('Module:');
}

/**
 * 判断节点是否为"外部依赖节点"（ID 以 "dep-" 开头）
 */
function isExternalDep(nodeData) {
  return nodeData.id.startsWith('dep-');
}

/**
 * 判断节点是否为"轻量入口节点"（description 以 Entry/Types/Config 等开头）
 * 这类节点通常是模块的 re-export 入口或类型定义，零连接属于正常现象
 */
function isLightweightNode(nodeData) {
  // Test/verify scripts should never be considered lightweight entry points
  const id = (nodeData.id || "").toLowerCase();
  if (id.includes("verify") || id.includes("test")) {
    return false;
  }
  const desc = (nodeData.description || '').toLowerCase();
  const prefixes = ['entry', 'types', 'type', 'config', 'setup', 'middleware',
    'models', 'model', 'schema', 'store', 'hooks'];
  for (const prefix of prefixes) {
    if (desc.startsWith(prefix) || desc.startsWith(prefix + ' ') ||
        desc.startsWith(prefix + '\u2014') || desc.startsWith(prefix + ':')) {
      return true;
    }
  }
  return false;
}

/**
 * 判断节点是否为"架构组件节点"（具有架构意义，需要参与诊断评分）
 * 架构组件 = 非文件节点 && 非模块头节点
 */
function isArchComponent(nodeData) {
  return !isFileNode(nodeData) && !isModuleHeader(nodeData);
}

/**
 * 构建连接索引：为每个节点统计连接数及跨模块连接数
 */
function buildConnectionIndex(nodes, connections) {
  const connMap = new Map();

  // 初始化
  for (const n of nodes) {
    connMap.set(n.id, { total: 0, crossModule: 0, modulePrefix: getModulePrefix(n.id) });
  }

  // 遍历连接并统计
  for (const c of connections) {
    const from = connMap.get(c.from);
    const to = connMap.get(c.to);
    if (from) {
      from.total++;
      if (getModulePrefix(c.to) !== from.modulePrefix) from.crossModule++;
    }
    if (to) {
      to.total++;
      if (getModulePrefix(c.from) !== to.modulePrefix) to.crossModule++;
    }
  }

  return connMap;
}

// ============================================================
// 3. 节点启发式判定
// ============================================================

/**
 * 判定节点的 role
 *
 * 规则：
 * - bridge: 跨模块连接占比 > 50%（优先级最高，标记跨模块协作节点）
 * - leaf:   连接数 0-2，终端节点
 * - normal: 连接数 3-8，普通工作节点
 * - hub:    连接数 >8，中心枢纽节点
 */
function determineNodeRole(nodeId, connInfo) {
  const total = connInfo ? connInfo.total : 0;
  const cross = connInfo ? connInfo.crossModule : 0;
  const crossPct = total > 0 ? cross / total : 0;

  // bridge 优先判定：跨模块连接占比 > 50%
  if (crossPct > 0.5 && total >= 3) {
    return 'bridge';
  }

  if (total <= 2) return 'leaf';
  if (total <= 8) return 'normal';
  return 'hub';
}

/**
 * 判定节点的 status
 *
 * 仅对"架构组件节点"（isArchComponent）应用诊断规则。
 * 文件节点和模块头节点仅作为静态标记存在，不参与诊断。
 *
 * 规则（优先级从高到低）：
 * - risk:       死代码存根（skeleton/stub）、废弃代码（deprecated）、
 *               过时版本号脚本（v0117/0_old/legacy）
 * - warning:    架构组件零连接（孤立组件）
 * - overloaded: 连接数 ≥ top 5% 阈值
 * - healthy:    默认状态
 */
function determineNodeStatus(nodeId, nodeData, connInfo, overloadedThreshold) {
  const desc = (nodeData.description || '').toLowerCase();
  const id = nodeId.toLowerCase();

  // === risk 判定（前置检测：在非架构组件过滤前，捕获存根/死代码节点） ===
  if (id.includes("nebulalink") || id.includes("stub") || desc.includes("stub") || desc.includes("return null")) {
    return "risk";
  }

  // 测试/验证脚本零连接 -> warning（孤立测试脚本，即使为文件节点也应标记）
  if ((id.includes('verify') || id.includes('test')) && connInfo && connInfo.total === 0) {
    return 'warning';
  }

  // 非架构组件节点（文件节点/模块头）统一为 healthy
  if (!isArchComponent(nodeData)) {
    return 'healthy';
  }

  // === risk 判定 ===
  if (desc.includes('skeleton') || desc.includes('stub') || desc.includes('deprecated')) {
    return 'risk';
  }
  if (id.includes('v0117') || id.includes('v0_old') || id.includes('legacy')) {
    return 'risk';
  }

  // === warning 判定 ===
  // 孤立组件：零连接 && 非轻量入口 && 非外部依赖
  if (!isLightweightNode(nodeData) && !isExternalDep(nodeData) && connInfo && connInfo.total === 0) {
    return 'warning';
  }
  // 外部依赖零连接
  if (isExternalDep(nodeData) && connInfo && connInfo.total === 0) {
    return 'warning';
  }

  // === overloaded 判定 ===
  if (connInfo && connInfo.total >= overloadedThreshold) {
    return 'overloaded';
  }

  // === healthy（默认）===
  return 'healthy';
}

/**
 * 计算 overloaded 阈值（架构组件连接数的 95 百分位）
 */
function computeOverloadedThreshold(connMap, nodes) {
  const connCounts = [];
  for (const n of nodes) {
    if (!isArchComponent(n)) continue;
    const info = connMap.get(n.id);
    if (info && info.total > 0) connCounts.push(info.total);
  }
  connCounts.sort((a, b) => a - b);
  if (connCounts.length === 0) return Infinity;
  const idx = Math.min(Math.floor(connCounts.length * 0.95), connCounts.length - 1);
  return connCounts[idx];
}

// ============================================================
// 4. 模块聚合
// ============================================================

/**
 * 按模块前缀分组节点
 */
function groupNodesByModule(nodes) {
  const moduleMap = new Map();
  for (const n of nodes) {
    const prefix = getModulePrefix(n.id);
    if (!moduleMap.has(prefix)) {
      moduleMap.set(prefix, { nodes: [], layer: n.layer || '' });
    }
    moduleMap.get(prefix).nodes.push(n);
  }
  return moduleMap;
}

/**
 * 判定模块 status：取模块内所有节点的最低 status
 * （仅考虑架构组件节点的诊断结果）
 */
function determineModuleStatus(nodes) {
  const statusRank = { healthy: 0, warning: 1, overloaded: 2, risk: 3, 'needs-split': 4 };
  let worst = 'healthy';
  let worstRank = 0;
  for (const n of nodes) {
    if (!isArchComponent(n)) continue;
    const s = n.agentDiagnosis ? n.agentDiagnosis.status : 'healthy';
    const rank = statusRank[s] || 0;
    if (rank > worstRank) {
      worstRank = rank;
      worst = s;
    }
  }
  return worst;
}

// ============================================================
// 5. 全局评分
// ============================================================

/**
 * 全局评分规则（仅对架构组件节点进行扣分）：
 * - 基础分 10.0
 * - 每个 warning 架构组件 -0.3
 * - 每个 risk 架构组件 -0.5
 * - 每个 overloaded/needs-split 架构组件 -0.5
 */
function computeGlobalScore(nodes) {
  let score = 10.0;
  for (const n of nodes) {
    if (!isArchComponent(n)) continue;
    const status = n.agentDiagnosis ? n.agentDiagnosis.status : 'healthy';
    switch (status) {
      case 'warning':
        score -= 0.3;
        break;
      case 'risk':
        score -= 0.5;
        break;
      case 'overloaded':
      case 'needs-split':
        score -= 0.5;
        break;
    }
  }
  score = Math.max(0, Math.min(10, score));
  return Math.round(score * 10) / 10;
}

// ============================================================
// 6. 主流程
// ============================================================

async function main() {
  let input;
  try {
    input = await readStdin();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (!input || !input.trim()) {
    console.error('错误：stdin 输入为空');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (err) {
    console.error(`错误：JSON 解析失败 - ${err.message}`);
    process.exit(1);
  }

  const nodes = data.nodes || [];
  const connections = data.connections || [];

  // 构建连接索引
  const connMap = buildConnectionIndex(nodes, connections);
  const overloadedThreshold = computeOverloadedThreshold(connMap, nodes);

  // ---- 节点级标注 ----
  // 为每个节点添加 agentDiagnosis 字段
  const nodeEntries = [];
  for (const n of nodes) {
    const connInfo = connMap.get(n.id);
    const role = determineNodeRole(n.id, connInfo);
    const status = determineNodeStatus(n.id, n, connInfo, overloadedThreshold);

    // 在原节点上添加字段（供模块聚合使用）
    n.agentDiagnosis = {
      status,
      role,
      summary: '',
      detail: '',
      suggestions: [],
    };

    // 构建输出用节点条目（仅包含 id 和 agentDiagnosis）
    nodeEntries.push({
      id: n.id,
      agentDiagnosis: n.agentDiagnosis,
    });
  }

  // ---- 模块级标注 ----
  const moduleMap = groupNodesByModule(nodes);
  const modules = [];
  for (const [prefix, group] of moduleMap) {
    const mStatus = determineModuleStatus(group.nodes);
    modules.push({
      name: prefix,
      id: prefix,
      nodeCount: group.nodes.length,
      layer: group.layer,
      agentDiagnosis: {
        status: mStatus,
        summary: '',
        detail: '',
        suggestions: [],
      },
    });
  }

  // ---- 全局标注 ----
  const globalScore = computeGlobalScore(nodes);

  // ---- 构建输出 ----
  const output = {
    ...data,

    generatedBy: 'auto_diagnose.js (启发式自动标注)',
    generatedAt: new Date().toISOString().slice(0, 10),

    agentDiagnosis: {
      global: {
        score: globalScore,
        summary: '',
        detail: '',
        suggestions: [],
      },

      modules,
      nodes: nodeEntries,
    },
  };

  // 以人类可读格式输出到 stdout
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(`未预期错误: ${err.message}`);
  process.exit(1);
});
