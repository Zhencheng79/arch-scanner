#!/usr/bin/env node
/**
 * cli.js — 端口标签工具 (Port Tag Tool) CLI 入口
 *
 * 独立的 CLI 工具，任何 Agent 可以直接运行。
 * 支持内置示例数据或外部 JSON 数据文件。
 *
 * 用法：
 *   node cli.js --action scan                   # 扫描端口
 *   node cli.js --action tags                   # 查询所有标签
 *   node cli.js --action ports                  # 列出所有节点端口概况
 *   node cli.js --action ports --node <id>     # 查看指定节点的端口详情
 *   node cli.js --action validate               # 自检（端口+标签+冲突+覆盖率）
 *   node cli.js --action summarize              # 完整系统标签摘要
 *   node cli.js --action json                   # 输出完整 JSON
 *   node cli.js --action help                   # 显示帮助
 *   node cli.js --help                          # 显示帮助（简写）
 *   node cli.js --action scan --data-file ./data.json  # 使用外部数据文件
 *
 * 数据文件格式（JSON）：
 *   { "nodes": [...], "connections": [...] }
 */

import { scanPorts, PortRegistry } from './portRegistry.js';
import { createTagRegistry, TAG_DEFINITIONS } from './tagRegistry.js';
import { exampleNodes, exampleConnections, exampleLayers } from './hermesExampleData.js';
import { scanProject } from './projectScanner.js';
import { readFileSync, existsSync } from 'node:fs';

// ===== Argument parsing =====
const args = process.argv.slice(2);


// Handle --version before anything else
if (args.includes("--version") || args.includes("-v")) {
  console.log("port-tag-tool v0.1.0");
  process.exit(0);
}// Handle --help without --action
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const actionIndex = args.indexOf('--action');
const action = actionIndex !== -1 ? args[actionIndex + 1] : 'help';
const nodeIndex = args.indexOf('--node');
const nodeId = nodeIndex !== -1 ? args[nodeIndex + 1] : null;
const jsonFlag = args.includes('--json');

// ===== Data file loading =====
let dataFilePath = null;
const dataFileIndex = args.indexOf('--data-file');
if (dataFileIndex !== -1 && args[dataFileIndex + 1]) {
  dataFilePath = args[dataFileIndex + 1];
}

// ===== Project scan mode =====
let projectPath = null;
const projectIndex = args.indexOf("--project");
if (projectIndex !== -1 && args[projectIndex + 1]) {
  projectPath = args[projectIndex + 1];
}

function loadData() {
  if (!dataFilePath) {
    return { nodes: exampleNodes, connections: exampleConnections, layers: exampleLayers };
  }

  if (!existsSync(dataFilePath)) {
    console.error(`[error] 数据文件不存在: ${dataFilePath}`);
    process.exit(1);
  }

  try {
    const raw = readFileSync(dataFilePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.nodes || !data.connections) {
      console.error('[error] 数据文件格式错误：需要包含 nodes 和 connections 字段');
      process.exit(1);
    }
    console.error(`[info] 已加载外部数据: ${data.nodes.length} 节点, ${data.connections.length} 连接\n`);
    return {
      nodes: data.nodes,
      connections: data.connections,
      layers: data.layers || [],
    };
  } catch (err) {
    console.error(`[error] 数据文件解析失败: ${err.message}`);
    process.exit(1);
  }
}

// ===== Tag registry (shared) =====
const tagRegistry = createTagRegistry(TAG_DEFINITIONS);

function printJSON(data) {
  console.log(JSON.stringify(data, null, 2));
}

function loadAndScan() {
  const { nodes, connections } = loadData();
  const result = scanPorts(connections, nodes);
  const summary = tagRegistry.summarize(connections);
  const conflicts = tagRegistry.detectConflicts(connections);
  return { nodes, connections, result, summary, conflicts };
}

function actionScan() {
  const { nodes, connections, result, summary, conflicts } = loadAndScan();
  const { stats } = result;

  if (jsonFlag) {
    printJSON({ stats: result.stats, nodePorts: result.nodePorts, tags: summary, conflicts });
    return;
  }

  console.log(`[scan] 扫描完成`);
  console.log(`  节点数: ${nodes.length}`);
  console.log(`  有端口节点数: ${stats.nodes}`);
  console.log(`  端口总数: ${stats.ports}`);
  console.log(`  连接数: ${connections.length}`);
  console.log();

  const flowTypes = {};
  (connections || []).forEach(c => {
    const ft = c.flowType || 'unknown';
    if (!flowTypes[ft]) flowTypes[ft] = 0;
    flowTypes[ft]++;
  });
  console.log(`  连接类型分布（共计 ${connections.length} 条）:`);
  Object.entries(flowTypes).forEach(([k, v]) => console.log(`    ${k}: ${v} 条`));
  console.log();

  // 按层展示
  const layerNodes = {};
  (nodes || []).forEach(n => {
    if (!layerNodes[n.layer]) layerNodes[n.layer] = [];
    layerNodes[n.layer].push(n.id);
  });
  const sortedLayers = ['user', 'frontend', 'agent', 'infrastructure', 'external'];
  console.log(`  按层节点分布:`);
  sortedLayers.forEach(layer => {
    if (layerNodes[layer]) {
      const v = layerNodes[layer];
      console.log(`    ${layer}: ${v.length} 个节点 (${v.slice(0, 8).join(', ')}${v.length > 8 ? ', ...' : ''})`);
    }
  });
  // Unrecognized layers
  Object.entries(layerNodes).filter(([k]) => !sortedLayers.includes(k)).forEach(([k, v]) => {
    console.log(`    ${k}: ${v.length} 个节点 (${v.slice(0, 5).join(', ')}${v.length > 5 ? ', ...' : ''})`);
  });

  console.log();
  console.log(`  标签类型数: ${Object.keys(summary.tagIndex).length}`);
  console.log(`  冲突数: ${conflicts.length}`);
}

function actionTags() {
  const allTags = tagRegistry.getAllTags();

  if (jsonFlag) {
    printJSON(allTags);
    return;
  }

  console.log(`[tags] 共 ${allTags.length} 个标签定义\n`);
  allTags.forEach(t => {
    console.log(`  ${t.id}`);
    console.log(`    标签: ${t.label} (${t.shortLabel || '-'})`);
    console.log(`    类型: ${t.flowType} | 格式: ${t.format || '-'}`);
    console.log(`    颜色: ${t.color}`);
    console.log(`    描述: ${t.description}`);
    if (t.transform) console.log(`    变换: ${t.transform}`);
    console.log();
  });
}

function actionPorts() {
  const { nodes, connections } = loadData();
  const result = scanPorts(connections, nodes);

  if (jsonFlag && !nodeId) {
    printJSON(result.nodePorts);
    return;
  }

  if (nodeId) {
    const nodePorts = result.nodePorts[nodeId];
    if (!nodePorts) {
      console.log(`[ports] 未找到节点 "${nodeId}"`);
      console.log(`  可用节点: ${Object.keys(result.nodePorts).join(', ')}`);
      return;
    }
    const node = nodes.find(n => n.id === nodeId);
    console.log(`[ports] 节点 "${nodeId}" (${node?.label || '-'})`);
    console.log(`  输出端口 (${nodePorts.outputs.length} 个):`);
    nodePorts.outputs.forEach(p => {
      console.log(`    ${p.id} | 颜色: ${p.color} | 标签: ${p.label} | 位置: ${p.position} (${p.position3d.map(v => v.toFixed(3)).join(', ')})`);
    });
    console.log(`  输入端口 (${nodePorts.inputs.length} 个):`);
    nodePorts.inputs.forEach(p => {
      console.log(`    ${p.id} | 颜色: ${p.color} | 标签: ${p.label} | 位置: ${p.position} (${p.position3d.map(v => v.toFixed(3)).join(', ')})`);
    });

    if (jsonFlag) {
      console.log();
      printJSON({ node, inputs: nodePorts.inputs, outputs: nodePorts.outputs });
    }
  } else {
    // List all nodes with port counts
    console.log(`[ports] 所有节点端口概况 (${Object.keys(result.nodePorts).length} 个有端口节点):\n`);
    Object.entries(result.nodePorts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([id, ports]) => {
        const node = nodes.find(n => n.id === id);
        const totalPorts = ports.outputs.length + ports.inputs.length;
        console.log(`  ${id} (${node?.label || '-'}): ${ports.outputs.length}出/${ports.inputs.length}入 [共${totalPorts}端口]`);
      });
  }
}

function actionJson() {
  const { nodes, connections, result, summary, conflicts } = loadAndScan();
  printJSON({
    nodes,
    connections,
    stats: result.stats,
    ports: result.ports,
    nodePorts: result.nodePorts,
    tags: summary,
    conflicts
  });
}

function actionValidate() {
  const { nodes, connections } = loadData();
  const result = scanPorts(connections, nodes);
  const pReg = new PortRegistry();
  pReg.autoGenerate(connections, nodes);
  const portResult = pReg.verify(connections);
  const conflicts = tagRegistry.detectConflicts(connections);

  const taggedCount = connections.filter(c => c.tagId || tagRegistry.autoSuggestTag(c.from, c.to, c.label, c.flowType)).length;
  const coveragePct = connections.length > 0 ? (taggedCount / connections.length * 100).toFixed(1) : '100.0';

  const nodeIds = new Set(nodes.map(n => n.id));
  const portNodeIds = new Set(Object.keys(result.nodePorts));
  const missingNodes = [...nodeIds].filter(id => !portNodeIds.has(id));

  if (jsonFlag) {
    printJSON({
      portConsistency: portResult,
      tagConflicts: conflicts,
      coverage: { tagged: taggedCount, total: connections.length, percentage: parseFloat(coveragePct) },
      completeness: { nodesWithPorts: Object.keys(result.nodePorts).length, totalNodes: nodes.length, missingNodes }
    });
    return;
  }

  console.log(`========== 自检报告 ==========\n`);

  // 1. 端口一致性
  console.log(`--- 1/4 端口一致性 ---`);
  if (portResult.passed) {
    console.log(`  ✅ 端口定义一致`);
  } else {
    portResult.errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  console.log();

  // 2. 标签冲突
  console.log(`--- 2/4 标签冲突 ---`);
  if (conflicts.length === 0) {
    console.log(`  ✅ 无冲突`);
  } else {
    conflicts.forEach(c => console.log(`  ${c.severity === 'warning' ? '⚠️' : 'ℹ️'} ${c.message}`));
  }
  console.log();

  // 3. 标签覆盖率
  console.log(`--- 3/4 标签覆盖率 ---`);
  console.log(`  ${taggedCount}/${connections.length} (${coveragePct}%)`);
  console.log();

  // 4. 节点端口完整性
  console.log(`--- 4/4 节点端口完整性 ---`);
  if (missingNodes.length === 0) {
    console.log(`  ✅ 所有节点均已生成端口`);
  } else {
    missingNodes.slice(0, 10).forEach(id => console.log(`  ⚠️ ${id} 无任何连接，无端口生成`));
    if (missingNodes.length > 10) console.log(`  ... 还有 ${missingNodes.length - 10} 个`);
  }
  console.log();

  // 总结
  console.log(`========== 自检总结 ==========`);
  console.log(`  端口一致性: ${portResult.passed ? '✅' : '❌'}`);
  console.log(`  标签冲突: ${conflicts.length === 0 ? '✅' : `⚠️ ${conflicts.length} 个`}`);
  console.log(`  标签覆盖率: ${coveragePct}% ${parseFloat(coveragePct) >= 100 ? '✅' : '⚠️'}`);
  console.log(`  节点完整性: ${missingNodes.length === 0 ? '✅' : `⚠️ ${missingNodes.length} 个缺失`}`);
  const allPassed = portResult.passed && conflicts.length === 0 && parseFloat(coveragePct) >= 100 && missingNodes.length === 0;
  console.log(`\n  总体: ${allPassed ? '✅ 全部通过' : '⚠️ 需关注以上问题'}`);
}

function actionSummarize() {
  const { nodes, connections } = loadData();
  const summary = tagRegistry.summarize(connections);

  if (jsonFlag) {
    printJSON(summary);
    return;
  }

  console.log(`[summarize] Hermes 投研管家系统标签摘要\n`);
  console.log(`总连接数: ${summary.totalConnections}`);
  console.log(`标签类型数: ${summary.totalTagTypes}`);
  console.log();

  console.log(`--- 流类型分布 ---`);
  Object.entries(summary.flowTypeSummary).forEach(([ft, labels]) => {
    console.log(`  ${ft} (${labels.length} 种): ${labels.join(', ')}`);
  });
  console.log();

  console.log(`--- 冲突 ---`);
  if (summary.conflicts.length === 0) {
    console.log(`  无冲突`);
  } else {
    summary.conflicts.forEach(c => console.log(`  ${c.severity === 'warning' ? '⚠️' : 'ℹ️'} ${c.message}`));
  }
  console.log();

  console.log(`--- 详细标签索引 ---`);
  Object.entries(summary.tagIndex).forEach(([tagId, entry]) => {
    console.log(`  ${tagId} (${entry.label})`);
    console.log(`    类型: ${entry.flowType}`);
    console.log(`    来源: ${entry.fromNodes.join(', ')}`);
    console.log(`    去向: ${entry.toNodes.join(', ')}`);
  });
}


/**
 * actionScanProject — 传感器模式：自己去扫项目目录
 */
async function actionScanProject() {
  if (!projectPath) {
    console.error("[error] 请指定 --project <path>");
    process.exit(1);
  }
  console.error("[project-scan] 传感器模式启动");
  console.error("[project-scan] 扫描项目: " + projectPath);

  try {
    const result = await scanProject(projectPath);

    // --action json always outputs JSON; other actions use --json flag
    const shouldOutputJSON = jsonFlag || action === "json";
    if (shouldOutputJSON) {
      printJSON(result);
      return;
    }

    const { nodes, connections, quality, buildTools } = result;

    console.error("[project-scan] 传感器扫描完成\n");
    console.error("  项目路径: " + result.projectPath);
    console.error("  扫描目录数: " + quality.totalDirectoriesScanned);
    console.error("  发现文件数: " + quality.totalFilesFound);
    console.error("  生成节点数: " + quality.totalNodesGenerated);
    console.error("  生成连接数: " + quality.totalConnectionsGenerated);

    if (buildTools && buildTools.length > 0) {
      console.error("  构建工具: " + buildTools.join(", "));
    }
    console.error();
    // Layer distribution (via console.error)
    const layerNodes = {};
    nodes.forEach(n => {
      if (!layerNodes[n.layer]) layerNodes[n.layer] = [];
      layerNodes[n.layer].push(n.id);
    });
    console.error("  按层节点分布:");
    Object.entries(layerNodes).forEach(([layer, ids]) => {
      console.error("    " + layer + ": " + ids.length + " 个");
    });
    console.error();

    // Connection types
    const flowTypes = {};
    connections.forEach(c => {
      const ft = c.flowType || "unknown";
      flowTypes[ft] = (flowTypes[ft] || 0) + 1;
    });
    console.error("  连接类型分布:");
    Object.entries(flowTypes).forEach(([k, v]) => console.error("    " + k + ": " + v + " 条"));
    console.error();

    // Port stats
    console.error("  端口统计:");
    console.error("    有端口节点数: " + (result.ports.stats?.nodes || 0));
    console.error("    端口总数: " + (result.ports.stats?.ports || 0));
    console.error();

    console.error("[project-scan] 提示: 使用 --json 查看完整 JSON 输出");
    console.error("[project-scan] 提示: 输出可被 3D 全景直接消费");

  } catch (err) {
    console.error("[error] 项目扫描失败: " + err.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║        Port Tag Tool — 端口标签工具              ║`);
  console.log(`║        MCP 端口注册表与标签管理系统              ║`);
  console.log(`║              版本 v0.1.0                        ║`);  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log();
  console.log(`用法:`);
  console.log(`  node cli.js --action <命令> [选项]`);
  console.log(`  node cli.js --help`);
  console.log();
  console.log(`命令:`);
  console.log(`  scan               扫描所有端口并显示统计`);
  console.log(`  tags               列出所有标签定义`);
  console.log(`  ports              列出所有节点端口概况`);
  console.log(`  ports --node xxx   查看指定节点的端口详情`);
  console.log(`  validate           执行自检（端口+标签+冲突+覆盖率）`);
  console.log(`  summarize          生成完整系统标签摘要`);
  console.log(`  json               输出完整 JSON（nodes + connections + ports + tags + conflicts）`);
  console.log(`  help               显示此帮助`);
  console.log();
  console.log(`选项:`);
  console.log(`  --help, -h         显示帮助`);
  console.log(`  --data-file <path> 使用外部 JSON 数据文件`);
  console.log(`  --project <path>   传感器模式：扫描项目目录（自动发现模块、依赖、贴标签）`);
  console.log(`  --node <id>        指定节点 ID（与 --action ports 配合使用）`);
  console.log(`  --json             以 JSON 格式输出（机器可读，与 stdout 配合）`);
  console.log();
  console.log(`数据文件格式（JSON）:`);
  console.log(`  { "nodes": [...], "connections": [...] }`);
  console.log();
  console.log(`示例:`);
  console.log(`  # 使用内置示例数据`);
  console.log(`  node cli.js --action scan`);
  console.log(`  node cli.js --action ports --node zhaogongming`);
  console.log(`  node cli.js --action validate`);
  console.log();
  console.log(`  # 使用外部数据文件`);
  console.log(`  node cli.js --action scan --data-file ./my-data.json`);
  console.log(`  node cli.js --action validate --data-file ./my-data.json`);
  console.log(`  node cli.js --action json --data-file ./my-data.json`);
  console.log();
  console.log(`  # JSON 输出（管道友好）`);
  console.log(`  node cli.js --action scan --json`);
  console.log(`  node cli.js --action scan --data-file ./data.json --json`);
  console.log();
  console.log(`  # 传感器模式（扫项目目录）`);
  console.log(`  node cli.js --action scan --project ./my-project`);
  console.log(`  node cli.js --action validate --project ./my-project`);
  console.log(`  node cli.js --action json --project ./my-project`);
  console.log();
console.log(`内置示例数据: Hermes 投研管家系统 (${exampleNodes.length} 节点, ${exampleConnections.length} 连接)`);
}

// === 入口 ===
async function main() {
  // Project scan mode
  if (projectPath) {
    switch (action) {
      case "scan":
      case "validate":
      case "json":
      case "summarize":
      case "ports":
        await actionScanProject();
        break;
      case "tags":
        actionTags();
        break;
      case "help":
      default:
        printHelp();
        break;
    }
    return;
  }

  // Normal mode
  switch (action) {
    case "scan":
      actionScan();
      break;
    case "tags":
      actionTags();
      break;
    case "ports":
      actionPorts();
      break;
    case "validate":
      actionValidate();
      break;
    case "summarize":
      actionSummarize();
      break;
    case "json":
      actionJson();
      break;
    case "help":
    default:
      printHelp();
      break;
  }
}

main();
