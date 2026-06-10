#!/usr/bin/env node
/**
 * mcp-server.js — port-tag-tool MCP Server (stdio transport)
 *
 * 独立的 MCP Server，使用 stdio 传输协议。
 * 任何 Agent 都可以直接使用，不依赖 Three.js / React。
 *
 * 提供以下工具：
 *   scan_system    — 扫描系统 connections/nodes
 *   get_tags       — 查询所有标签定义
 *   get_node_ports — 查询指定节点的端口详情
 *   validate       — 执行自检
 *   summarize      — 生成系统标签摘要
 *
 * 支持 --data-file <path> 加载外部项目架构数据文件。
 *
 * 用法：
 *   node mcp-server.js
 *   node mcp-server.js --data-file ./complete-hermes-data.json
 */

import { scanPorts, PortRegistry } from './portRegistry.js';
import { createTagRegistry, TAG_DEFINITIONS } from './tagRegistry.js';
import { scanProject } from './projectScanner.js';
import { exampleNodes, exampleConnections } from './hermesExampleData.js';
import { readFileSync, existsSync } from 'node:fs';

// ===== Parse --data-file from command line =====
const args = process.argv.slice(2);
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

// ===== Load data (external file or built-in) =====
let dataNodes = exampleNodes;
let dataConnections = exampleConnections;

if (dataFilePath) {
  if (!existsSync(dataFilePath)) {
    process.stderr.write(`[error] 数据文件不存在: ${dataFilePath}\n`);
    process.exit(1);
  }
  try {
    const raw = readFileSync(dataFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.nodes || !parsed.connections) {
      process.stderr.write('[error] 数据文件格式错误：需要包含 nodes 和 connections 字段\n');
      process.exit(1);
    }
    dataNodes = parsed.nodes;
    dataConnections = parsed.connections;
    process.stderr.write(`[port-tag-tool] 已加载外部数据: ${dataNodes.length} 节点, ${dataConnections.length} 连接\n`);
  } catch (err) {
    process.stderr.write(`[error] 数据文件解析失败: ${err.message}\n`);
    process.exit(1);
  }
} else {
  process.stderr.write(`[port-tag-tool] 使用内置示例数据: ${exampleNodes.length} 节点, ${exampleConnections.length} 连接\n`);
}

const tagRegistry = createTagRegistry(TAG_DEFINITIONS);

// Reusable scan helper that uses the loaded data
function runScan() {
  return scanPorts(dataConnections, dataNodes);
}

// ===== Tool Implementations =====

/**
 * scan_system — 扫描系统 connections/nodes
 */
function toolScanSystem(args) {
  const result = runScan();
  const portStats = result.stats;

  // Build flow type distribution
  const flowTypes = {};
  dataConnections.forEach(c => {
    const ft = c.flowType || 'unknown';
    flowTypes[ft] = (flowTypes[ft] || 0) + 1;
  });

  // Build layer distribution
  const layerNodes = {};
  dataNodes.forEach(n => {
    if (!layerNodes[n.layer]) layerNodes[n.layer] = [];
    layerNodes[n.layer].push(n.id);
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ports: result,
        stats: {
          nodes: dataNodes.length,
          connections: dataConnections.length,
          ports: portStats.ports,
          nodePortsCount: Object.keys(result.nodePorts).length,
        },
        nodePorts: result.nodePorts,
        flowTypes,
        layers: Object.fromEntries(
          Object.entries(layerNodes).map(([k, v]) => [k, { count: v.length, nodes: v }])
        ),
      }, null, 2),
    }],
  };
}

/**
 * get_tags — 查询所有标签定义
 */
function toolGetTags(args) {
  const filter = args?.filter || {};
  let tags = tagRegistry.getAllTags();

  if (filter.flowType) {
    tags = tags.filter(t => t.flowType === filter.flowType);
  }
  if (filter.color) {
    tags = tags.filter(t => t.color && t.color.toLowerCase() === filter.color.toLowerCase());
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total: tags.length,
        tags: tags.map(t => ({
          id: t.id,
          label: t.label,
          shortLabel: t.shortLabel || '',
          flowType: t.flowType,
          color: t.color,
          format: t.format || '',
          description: t.description,
          sourceLabel: t.sourceLabel || '',
          targetLabel: t.targetLabel || '',
          transportContent: t.transportContent || '',
        })),
      }, null, 2),
    }],
  };
}

/**
 * get_node_ports — 查询指定节点的端口详情
 */
function toolGetNodePorts(args) {
  const { nodeId } = args || {};
  if (!nodeId) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'nodeId is required' }, null, 2) }],
      isError: true,
    };
  }

  const result = runScan();
  const nodePorts = result.nodePorts[nodeId];
  const node = dataNodes.find(n => n.id === nodeId);

  if (!nodePorts) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Node "${nodeId}" not found`,
          availableNodes: Object.keys(result.nodePorts),
        }, null, 2),
      }],
      isError: true,
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        node: node || { id: nodeId },
        inputs: nodePorts.inputs.map(p => ({
          id: p.id,
          color: p.color,
          type: p.type,
          label: p.label,
          direction: p.direction,
          shape: p.shape,
        })),
        outputs: nodePorts.outputs.map(p => ({
          id: p.id,
          color: p.color,
          type: p.type,
          label: p.label,
          direction: p.direction,
          shape: p.shape,
        })),
      }, null, 2),
    }],
  };
}

/**
 * validate — 执行自检
 */
function toolValidate(args) {
  const results = [];

  // 1. Port consistency
  const pReg = new PortRegistry();
  pReg.autoGenerate(dataConnections, dataNodes);
  const portResult = pReg.verify(dataConnections);

  // 2. Tag conflicts
  const conflicts = tagRegistry.detectConflicts(dataConnections);

  // 3. Coverage
  let tagged = 0;
  let untagged = [];
  dataConnections.forEach(c => {
    const tagId = c.tagId || tagRegistry.autoSuggestTag(c.from, c.to, c.label, c.flowType);
    if (tagId) tagged++;
    else untagged.push(`${c.from}→${c.to}`);
  });
  const coverage = dataConnections.length > 0 ? (tagged / dataConnections.length * 100).toFixed(1) : '100.0';

  // 4. Node completeness
  const scanResult = runScan();
  const nodeIds = new Set(dataNodes.map(n => n.id));
  const portNodeIds = new Set(Object.keys(scanResult.nodePorts));
  const missingNodes = [...nodeIds].filter(id => !portNodeIds.has(id));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        results: {
          portConsistency: portResult,
          tagConflicts: {
            count: conflicts.length,
            conflicts,
          },
          coverage: {
            tagged,
            total: dataConnections.length,
            percentage: parseFloat(coverage),
          },
          completeness: {
            nodesWithPorts: Object.keys(scanResult.nodePorts).length,
            totalNodes: dataNodes.length,
            missingNodes,
          },
        },
      }, null, 2),
    }],
  };
}

/**
 * summarize — 生成系统标签摘要
 */
function toolSummarize(args) {
  const summary = tagRegistry.summarize(dataConnections);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalConnections: summary.totalConnections,
        totalTagTypes: summary.totalTagTypes,
        flowTypeSummary: summary.flowTypeSummary,
        tagIndex: Object.fromEntries(
          Object.entries(summary.tagIndex).map(([id, entry]) => [id, {
            label: entry.label,
            flowType: entry.flowType,
            color: entry.color,
            fromNodes: entry.fromNodes,
            toNodes: entry.toNodes,
          }])
        ),
        conflicts: summary.conflicts,
      }, null, 2),
    }],
  };
}


/**
 * scan_project — 传感器模式：扫描项目目录
 */
async function toolScanProject(args) {
  const { projectPath: scanPath } = args || {};
  if (!scanPath) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "projectPath is required" }, null, 2) }],
      isError: true,
    };
  }

  try {
    const result = await scanProject(scanPath);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          nodes: result.nodes,
          connections: result.connections,
          ports: result.ports,
          tags: result.tags,
          flowTypes: result.flowTypes,
          conflicts: result.conflicts,
          source: result.source,
          projectPath: result.projectPath,
          quality: result.quality,
          buildTools: result.buildTools,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: err.message }, null, 2) }],
      isError: true,
    };
  }
}

// ===== Tool Registry =====
const TOOLS = {
  scan_project: {
    name: "scan_project",
    description: "Scan a project directory (sensor mode): auto-discover modules, dependencies, and auto-tag nodes/connections",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Path to the project directory to scan" },
      },
      required: ["projectPath"],
    },
    handler: toolScanProject,
  },
  scan_system: {
    name: 'scan_system',
    description: 'Scan system connections/nodes and return complete port scan results',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: toolScanSystem,
  },
  get_tags: {
    name: 'get_tags',
    description: 'Query all tag definitions with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            flowType: { type: 'string', description: 'Filter by flow type' },
            color: { type: 'string', description: 'Filter by color (hex)' },
          },
          required: [],
        },
      },
      required: [],
    },
    handler: toolGetTags,
  },
  get_node_ports: {
    name: 'get_node_ports',
    description: 'Query port details for a specific node',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node ID to query' },
      },
      required: ['nodeId'],
    },
    handler: toolGetNodePorts,
  },
  validate: {
    name: 'validate',
    description: 'Run self-check (port consistency + tag conflicts + coverage + completeness)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: toolValidate,
  },
  summarize: {
    name: 'summarize',
    description: 'Generate system tag summary (tag index, flow type distribution, conflicts)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: toolSummarize,
  },
};

// ===== MCP Protocol Implementation (stdio transport) =====

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  process.stdout.write(json + '\n');
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendMessage({
      id,
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: '@hermes/port-tag-tool',
          version: '0.1.0',
        },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // No response needed for initialized notification
    return;
  }

  if (method === 'tools/list') {
    const toolsList = Object.entries(TOOLS).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
    sendMessage({
      id,
      jsonrpc: '2.0',
      result: { tools: toolsList },
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params;
    const tool = TOOLS[name];
    if (!tool) {
      sendMessage({
        id,
        jsonrpc: '2.0',
        error: { code: -32601, message: `Tool not found: ${name}` },
      });
      return;
    }
    try {
      const result = await tool.handler(toolArgs || {});
      sendMessage({
        id,
        jsonrpc: '2.0',
        result,
      });
    } catch (err) {
      sendMessage({
        id,
        jsonrpc: '2.0',
        error: { code: -32603, message: err.message },
      });
    }
    return;
  }

  // Unknown method
  sendMessage({
    id,
    jsonrpc: '2.0',
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

// Read JSON messages from stdin
let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line in buffer
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      handleRequest(msg);
    } catch (e) {
      // Ignore malformed messages
    }
  }
});

process.stdin.on('end', () => {
  if (buffer.trim()) {
    try {
      const msg = JSON.parse(buffer.trim());
      handleRequest(msg);
    } catch (e) {
      // Ignore
    }
  }
});

// Startup banner (sent as log)
process.stderr.write("[port-tag-tool] v0.1.0 -- MCP server started\n");process.stderr.write('[port-tag-tool MCP Server] Started. Listening on stdio...\n');
process.stderr.write(`[port-tag-tool] ${dataFilePath ? `External data: ${dataNodes.length} nodes, ${dataConnections.length} connections` : `Built-in example data: ${exampleNodes.length} nodes, ${exampleConnections.length} connections`}\n`);
