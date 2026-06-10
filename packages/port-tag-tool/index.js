/**
 * index.js — port-tag-tool 入口
 *
 * 任何 Agent 可以 import 此模块使用。
 * 所有函数输入 JSON 输出 JSON，无 React / Three.js 依赖。
 *
 * 用法：
 *   import { fullScan, scanPorts, createTagRegistry, TAG_DEFINITIONS, PortRegistry } from './index.js';
 *   const result = await fullScan(nodes, connections);
 */

export { PortRegistry, scanPorts, PORT_TYPE_STYLES } from './portRegistry.js';
export { TagRegistry, createTagRegistry, TAG_DEFINITIONS, TAG_EDGE_MAP, ROLE_TAG_MAP } from './tagRegistry.js';
export { exampleNodes, exampleConnections, exampleLayers } from './hermesExampleData.js';
export { scanProject } from './projectScanner.js';

/**
 * 一站式扫描 + 标签生成
 *
 * 输入 JSON 格式：
 *   nodes: [{ id, layer, label, ... }]
 *   connections: [{ from, to, flowType, label, tagId, ... }]
 *
 * 输出 JSON 格式：
 *   {
 *     stats: { nodes, connections, ports, tagTypes },
 *     ports: { stats, ports, nodePorts },
 *     tags: { definitions, index, portLabels },
 *     flowTypes: { flowType: [labels] },
 *     conflicts: [{ type, message, severity }]
 *   }
 *
 * @param {Array} nodes - 节点数组
 * @param {Array} connections - 连接数组
 * @param {Object} [options] - 可选参数
 * @param {Object} [options.tagDefinitions] - 自定义标签定义
 * @returns {Promise<Object>}
 */
export async function fullScan(nodes, connections, options = {}) {
  const { createTagRegistry: ctr, TAG_DEFINITIONS: td } = await import('./tagRegistry.js');
  const { scanPorts: sp } = await import('./portRegistry.js');
  const tagRegistry = ctr(options.tagDefinitions || td);
  const portResult = sp(connections, nodes);
  const summary = tagRegistry.summarize(connections);

  return {
    stats: {
      nodes: nodes.length,
      connections: connections.length,
      ports: portResult.stats.ports,
      tagTypes: Object.keys(summary.tagIndex).length,
    },
    ports: portResult,
    tags: {
      definitions: tagRegistry.getAllTags(),
      index: summary.tagIndex,
      portLabels: summary.portLabels,
    },
    flowTypes: summary.flowTypeSummary,
    conflicts: summary.conflicts,
  };
}

/**
 * 从文件加载数据并执行全扫描
 *
 * @param {string} filePath - JSON 数据文件路径
 * @param {Object} [options] - 同 fullScan 的 options
 * @returns {Promise<Object>}
 */
export async function scanFile(filePath, options = {}) {
  const { readFileSync, existsSync } = await import('node:fs');
  if (!existsSync(filePath)) {
    throw new Error(`数据文件不存在: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.nodes || !data.connections) {
    throw new Error('数据文件格式错误：需要包含 nodes 和 connections 字段');
  }
  return fullScan(data.nodes, data.connections, options);
}

export default { fullScan, scanFile, scanProject };
