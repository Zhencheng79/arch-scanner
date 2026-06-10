#!/usr/bin/env node

/**
 * 3d-monitor MCP Server (v0.1.10) — 内嵌 Three.js 版本
 *
 * 生成 HTML 时自动将 Three.js 核心库、OrbitControls、CSS2DRenderer
 * 内联注入到 HTML 中，不依赖 CDN 加载，实现离线可用。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { networkInterfaces } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, 'output');
const VIEWER_PATH = join(__dirname, 'viewer.html');

// ─── Three.js 库文件路径 ──────────────────────────────────
const ROOT = join(__dirname, '..', '..');
const THREE_MIN_PATH = join(ROOT, 'public', 'three.min.js');
const ORBIT_CONTROLS_PATH = join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'controls', 'OrbitControls.js');
const CSS2D_RENDERER_PATH = join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'renderers', 'CSS2DRenderer.js');

// ─── CDN 备选地址 ─────────────────────────────────────────
const ORBIT_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
const CSS2D_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js';

// ─── CLI 参数解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
let dataFilePath = null;
let projectPath = null;
let renderMode = 'three';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--data-file' && i + 1 < args.length) {
    dataFilePath = args[i + 1];
    i++;
  } else if (args[i] === '--project' && i + 1 < args.length) {
    projectPath = args[i + 1];
    i++;
  } else if (args[i] === '--mode' && i + 1 < args.length) {
    renderMode = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('用法: node mcp-server.js [--data-file <path>] [--project <path>] [--mode three|2d]');
    process.exit(0);
  }
}

// ─── 工具定义 ──────────────────────────────────────────────
const TOOL_DEFINITION = {
  name: '3d-monitor',
  description: '根据系统架构数据生成3D可视化拓扑HTML文件，返回文件路径',
  inputSchema: {
    type: 'object',
    properties: {
      dataFile: {
        type: 'string',
        description: 'port-tag-tool输出的JSON数据文件路径',
      },
      project: {
        type: 'string',
        description: '要扫描的项目路径（不填则只用dataFile）',
      },
      title: {
        type: 'string',
        description: '展示标题（可选）',
      },
    },
  },
};

// ─── 将 jsm 模块转换为内联 UMD ──────────────────────────
function convertJsmToUmd(source) {
  // 提取 import 语句中的变量名列表
  const importMatch = source.match(/^import\s*\{([^}]*)}\s*from\s*['"]three['"];?\s*$/m);
  let destructurePrefix = '';
  if (importMatch) {
    const names = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (names.length > 0) {
      destructurePrefix = 'const { ' + names.join(', ') + ' } = THREE;\n';
    }
  }

  let result = source;
  // 移除 import { ... } from 'three';
  result = result.replace(/^import\s+\{[^}]*\}\s*from\s+['"]three['"];?\s*$/gm, destructurePrefix);
  // 移除 export { ... };
  result = result.replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
  // 移除 "export" 关键字（class/function/const/let/var）
  result = result.replace(/^export\s+(default\s+)?(class|function|const|let|var)\s+/gm, '$2 ');
  // 移除行末 export { Xxx }
  result = result.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  // 移除裸 export;
  result = result.replace(/^\s*export\s*;\s*$/gm, '');
  return result;
}

// ─── 读取 Three.js 核心库 ─────────────────────────────────
function readThreeJs() {
  if (existsSync(THREE_MIN_PATH)) {
    return readFileSync(THREE_MIN_PATH, 'utf-8');
  }
  throw new Error(
    'three.min.js not found at ' + THREE_MIN_PATH +
    '. Please ensure three.min.js exists in public/ directory.'
  );
}

// ─── 读取 OrbitControls ────────────────────────────────────
function readOrbitControls() {
  if (existsSync(ORBIT_CONTROLS_PATH)) {
    const source = readFileSync(ORBIT_CONTROLS_PATH, 'utf-8');
    const converted = convertJsmToUmd(source);
    return wrapOrbitControls(converted);
  }
  // fallback: 尝试从 CDN 下载 UMD 版本
  console.error('[3d-monitor] OrbitControls.js not found locally, downloading from CDN...');
  const cdnSource = downloadFromCdn(ORBIT_CDN_URL);
  return '<script>' + cdnSource + '</script>';
}

// ─── 读取 CSS2DRenderer ───────────────────────────────────
function readCss2dRenderer() {
  if (existsSync(CSS2D_RENDERER_PATH)) {
    const source = readFileSync(CSS2D_RENDERER_PATH, 'utf-8');
    const converted = convertJsmToUmd(source);
    return wrapCss2dRenderer(converted);
  }
  // fallback: 尝试从 CDN 下载 UMD 版本
  console.error('[3d-monitor] CSS2DRenderer.js not found locally, downloading from CDN...');
  const cdnSource = downloadFromCdn(CSS2D_CDN_URL);
  return '<script>' + cdnSource + '</script>';
}

// ─── CDN 下载 ──────────────────────────────────────────────
function downloadFromCdn(url) {
  try {
    const result = execSync(`curl -sL "${url}"`, { timeout: 15000, encoding: 'utf-8' });
    if (!result || result.trim().length === 0) throw new Error('Empty response');
    return result;
  } catch (err) {
    throw new Error(`Failed to download ${url}: ${err.message}`);
  }
}

// ─── 包裹 OrbitControls ────────────────────────────────────
function wrapOrbitControls(innerCode) {
  return `<script>
(function(){
${innerCode}
if (typeof THREE !== 'undefined' && typeof OrbitControls !== 'undefined') {
  THREE.OrbitControls = OrbitControls;
}
})();
</script>`;
}

// ─── 包裹 CSS2DRenderer ───────────────────────────────────
function wrapCss2dRenderer(innerCode) {
  return `<script>
(function(){
${innerCode}
if (typeof THREE !== 'undefined' && typeof CSS2DRenderer !== 'undefined') {
  THREE.CSS2DRenderer = CSS2DRenderer;
  THREE.CSS2DObject = CSS2DObject;
}
})();
</script>`;
}

// ─── 生成 HTML ─────────────────────────────────────────────
function generateViewer(data, title) {
  let template = readFileSync(VIEWER_PATH, 'utf-8');

  // 1. 替换 Three.js 核心库
  const threeJsCode = readThreeJs();
  template = template.replace(
    '<!-- THREE_JS_INLINE -->',
    '<script>' + threeJsCode + '</script>'
  );

  // 2. 替换 OrbitControls
  const orbitTag = readOrbitControls();
  template = template.replace('<!-- ORBIT_CONTROLS_INLINE -->', orbitTag);

  // 3. 替换 CSS2DRenderer
  const css2dTag = readCss2dRenderer();
  template = template.replace('<!-- CSS2D_RENDERER_INLINE -->', css2dTag);

  // 4. 注入嵌入式数据
  const dataStr = JSON.stringify(data)
    .replace(/\\/g, '\\\\')
    .replace(/</g, '\\x3C');

  template = template.replace(
    '</head>',
    `<script>window.__EMBEDDED_DATA__ = ${dataStr};</script></head>`
  );

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const filename = `3d-monitor-${timestamp}-${rand}.html`;
  const filepath = join(OUTPUT_DIR, filename);

  writeFileSync(filepath, template, 'utf-8');
  return filepath;
}


// ─── Canvas 2D 版生成 ──────────────────────────────────────
function generateCanvas2DViewer(data, title) {
  const html = generateCanvas2DHTML(data, title || '3D 系统拓扑图');

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const filename = `3d-monitor-${timestamp}-${rand}-2d.html`;
  const filepath = join(OUTPUT_DIR, filename);

  writeFileSync(filepath, html, 'utf-8');
  return filepath;
}

function generateCanvas2DHTML(data, title) {
  const dataStr = JSON.stringify(data)
    .replace(/\\/g, '\\\\')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');

  var safeTitle = (title || "3D 系统拓扑图").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${safeTitle} — Canvas 2D</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{overflow:hidden;background:#0a0a12;font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#e0e0e0;touch-action:none}
canvas{display:block;width:100%;height:100%}
#stats{position:fixed;top:16px;left:16px;z-index:10;font-size:12px;color:rgba(255,255,255,0.4);pointer-events:none;font-family:'SF Mono','Fira Code',monospace;line-height:1.6;text-shadow:0 0 8px rgba(0,0,0,0.9)}
#stats b{color:#4FC3F7}
#info{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.3);font-size:12px;z-index:10;text-align:center;letter-spacing:0.5px;pointer-events:none;text-shadow:0 0 8px rgba(0,0,0,0.8)}
#legend{position:fixed;bottom:60px;right:20px;z-index:10;background:rgba(8,8,16,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;font-size:11px;color:#999;line-height:1.8;pointer-events:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#legend .row{display:flex;align-items:center;gap:8px}
#legend .dot{width:8px;height:8px;border-radius:2px;display:inline-block;flex-shrink:0}
#legend .line-sample{width:18px;height:2px;display:inline-block;flex-shrink:0;border-radius:1px}
#nodeInfoPanel{position:fixed;bottom:24px;right:24px;z-index:100;background:rgba(8,8,16,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:16px 20px;min-width:200px;max-width:280px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.6);display:none;pointer-events:none;font-size:13px;color:#e0e0e0;line-height:1.6}
#nodeInfoPanel .nip-name{color:#fff;font-weight:600;font-size:15px;margin-bottom:4px}
#nodeInfoPanel .nip-desc{color:#aaa;font-size:12px;margin-bottom:6px}
#nodeInfoPanel .nip-id{color:#4FC3F7;font-size:11px;font-family:monospace}
</style>
</head>
<body>
<div id="stats"><b id="fps">0</b> FPS · <b id="nodeCount">0</b> nodes · <b id="edgeCount">0</b> edges</div>
<div id="info">🖱 拖拽旋转 · 滚轮缩放 · 点击节点查看详情 · 双击空白脱选</div>
<div id="legend">
<div class="row"><span class="dot" style="background:#FFEB3B"></span>Command</div>
<div class="row"><span class="dot" style="background:#00BCD4"></span>Data</div>
<div class="row"><span class="dot" style="background:#E040FB"></span>Event</div>
<div class="row"><span class="dot" style="background:#7B1FA2"></span>Knowledge</div>
<div class="row" style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">
<span class="line-sample" style="background:#FFEB3B"></span>control
<span class="line-sample" style="background:#00BCD4;margin-left:6px"></span>data
<span class="line-sample" style="background:#E040FB;margin-left:6px"></span>event
<span class="line-sample" style="background:#7B1FA2;margin-left:6px"></span>knowledge
</div>
</div>
<div id="nodeInfoPanel"></div>
<canvas id="canvas"></canvas>
<script>
(function() {
'use strict';

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

// ─── Data ──────────────────────────────────────────────────
var data = ${dataStr};
var nodes = data.nodes || [];
var connections = data.connections || [];

// layer -> color mapping
var layerColors = {
  command: '#FFEB3B',
  analysis: '#00BCD4',
  management: '#4CAF50',
  risk: '#FF5722',
  knowledge: '#7B1FA2',
  execution: '#E040FB',
  data: '#00BCD4',
  frontend: '#FF9800'
};
var defaultNodeColor = '#78909C';

var flowTypeColors = {
  control: '#FFEB3B',
  data: '#00BCD4',
  event: '#E040FB',
  knowledge: '#7B1FA2'
};
var defaultFlowColor = '#90A4AE';

// ─── 3D Projection ────────────────────────────────────────
var rotX = 0.3;
var rotY = -0.4;
var zoom = 1.0;
var targetZoom = 1.0;
var centerX = 0, centerY = 0, centerZ = 0;

function project(x, y, z) {
  // rotate around Y
  var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  var x1 = x * cosY - z * sinY;
  var z1 = x * sinY + z * cosY;
  var y1 = y;
  // rotate around X
  var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  var y2 = y1 * cosX - z1 * sinX;
  var z2 = y1 * sinX + z1 * cosX;
  // perspective
  var fov = 500 * zoom;
  var scale = fov / (fov + z2);
  var w = canvas.width / 2;
  var h = canvas.height / 2;
  return {
    sx: w + x1 * scale,
    sy: h - y2 * scale,
    scale: scale,
    depth: z2
  };
}

// ─── Node geometry ─────────────────────────────────────────
var nodeHalfSize = 30;

function getNodeColor(node) {
  return layerColors[node.layer] || defaultNodeColor;
}

function getFlowColor(flowType) {
  return flowTypeColors[flowType] || defaultFlowColor;
}

// ─── Build scene data ─────────────────────────────────────
var nodePositions = {};
var edgeList = [];

function buildScene() {
  // Auto-layout: arrange nodes by layer
  var layers = {};
  nodes.forEach(function(n) {
    if (!layers[n.layer]) layers[n.layer] = [];
    layers[n.layer].push(n);
  });
  var layerNames = Object.keys(layers);
  var spacingX = 220;
  var spacingZ = 200;
  var spacingY = 150;
  layerNames.forEach(function(layer, li) {
    var layerNodes = layers[layer];
    var count = layerNodes.length;
    var totalAngle = Math.min(count * 0.6, Math.PI * 1.2);
    layerNodes.forEach(function(n, ni) {
      var angle = -totalAngle/2 + (count > 1 ? (ni / (count-1)) * totalAngle : 0);
      var radius = spacingZ * 0.6;
      var z = Math.sin(angle) * radius;
      var x = Math.cos(angle) * radius + (li - (layerNames.length-1)/2) * spacingX;
      var y = Math.sin(angle) * spacingY * 0.3 + (li - (layerNames.length-1)/2) * spacingY * 0.15;
      if (n.x !== undefined && n.y !== undefined && n.z !== undefined) {
        nodePositions[n.id] = {x: n.x, y: n.y, z: n.z};
      } else {
        nodePositions[n.id] = {x: x, y: y, z: z};
      }
    });
  });

  edgeList = connections.map(function(c) {
    var fromPos = nodePositions[c.from];
    var toPos = nodePositions[c.to];
    if (!fromPos || !toPos) return null;
    return {
      from: c.from,
      to: c.to,
      flowType: c.flowType || 'data',
      label: c.label || '',
      fromPos: fromPos,
      toPos: toPos,
      color: getFlowColor(c.flowType || 'data')
    };
  }).filter(Boolean);
}

buildScene();

// ─── Interaction state ─────────────────────────────────────
var isDragging = false;
var dragStartX = 0, dragStartY = 0;
var rotXStart = 0, rotYStart = 0;
var hoveredNodeId = null;
var selectedNodeId = null;
var touchZoomBase = 0;

// ─── Mouse / Touch events ──────────────────────────────────
function getPos(e) {
  var rect = canvas.getBoundingClientRect();
  if (e.touches) {
    return {x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top};
  }
  return {x: e.clientX - rect.left, y: e.clientY - rect.top};
}

function getNodeAt(sx, sy) {
  var best = null;
  var bestDist = 20;
  nodes.forEach(function(n) {
    var pos = nodePositions[n.id];
    if (!pos) return;
    var p = project(pos.x, pos.y, pos.z);
    var dx = p.sx - sx;
    var dy = p.sy - sy;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var hitRadius = nodeHalfSize * Math.max(p.scale, 0.3);
    if (dist < hitRadius && dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  });
  return best;
}

function onPointerDown(e) {
  e.preventDefault();
  var pos = getPos(e);
  isDragging = true;
  dragStartX = pos.x;
  dragStartY = pos.y;
  rotXStart = rotX;
  rotYStart = rotY;
}

function onPointerMove(e) {
  e.preventDefault();
  var pos = getPos(e);
  if (isDragging) {
    var dx = pos.x - dragStartX;
    var dy = pos.y - dragStartY;
    rotY = rotYStart + dx * 0.005;
    rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotXStart - dy * 0.005));
    return;
  }
  // Hover detection
  var n = getNodeAt(pos.x, pos.y);
  hoveredNodeId = n ? n.id : null;
  canvas.style.cursor = n ? 'pointer' : 'default';
}

function onPointerUp(e) {
  if (!isDragging) return;
  isDragging = false;
  var pos = getPos(e);
  var dx = Math.abs(pos.x - dragStartX);
  var dy = Math.abs(pos.y - dragStartY);
  // If it's a click (not drag), select node
  if (dx < 5 && dy < 5) {
    var n = getNodeAt(pos.x, pos.y);
    if (n) {
      selectedNodeId = n.id;
      updateNodeInfoPanel(n);
    } else {
      selectedNodeId = null;
      updateNodeInfoPanel(null);
    }
  }
}

function onWheel(e) {
  e.preventDefault();
  targetZoom *= (e.deltaY > 0 ? 0.9 : 1.1);
  targetZoom = Math.max(0.2, Math.min(5, targetZoom));
}

// Touch events
function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    onPointerDown(e);
  } else if (e.touches.length === 2) {
    touchZoomBase = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}

function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1 && isDragging) {
    onPointerMove(e);
  } else if (e.touches.length === 2) {
    var dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (touchZoomBase > 0) {
      targetZoom *= dist / touchZoomBase;
      targetZoom = Math.max(0.2, Math.min(5, targetZoom));
      touchZoomBase = dist;
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  if (e.touches.length === 0) {
    onPointerUp(e);
    isDragging = false;
  }
}

// Double-click to deselect
function onDblClick(e) {
  selectedNodeId = null;
  updateNodeInfoPanel(null);
}

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseleave', function() { isDragging = false; });
canvas.addEventListener('wheel', onWheel, {passive: false});
canvas.addEventListener('dblclick', onDblClick);
canvas.addEventListener('touchstart', onTouchStart, {passive: false});
canvas.addEventListener('touchmove', onTouchMove, {passive: false});
canvas.addEventListener('touchend', onTouchEnd, {passive: false});

// ─── Node info panel ───────────────────────────────────────
function updateNodeInfoPanel(node) {
  var panel = document.getElementById('nodeInfoPanel');
  if (!node) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  panel.style.pointerEvents = 'auto';
  panel.innerHTML = '<div class="nip-name">' + escapeHtml(node.label) + '</div>' +
    (node.chineseName ? '<div class="nip-desc">' + escapeHtml(node.chineseName) + '</div>' : '') +
    '<div class="nip-id">' + escapeHtml(node.id) + ' · ' + escapeHtml(node.layer) + '</div>';
}

function escapeHtml(s) {
  if (typeof s !== 'string') s = String(s || '');
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Resize ────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

// ─── Flow dots ─────────────────────────────────────────────
var flowDots = [];

function initFlowDots() {
  flowDots = [];
  edgeList.forEach(function(e) {
    // 1-3 dots per edge
    var count = 1 + Math.floor(Math.random() * 2);
    for (var i = 0; i < count; i++) {
      flowDots.push({
        edge: e,
        progress: Math.random(),
        speed: (0.3 + Math.random() * 0.4) * (e.flowType === 'control' ? 1.5 : 1.0)
      });
    }
  });
}
initFlowDots();

// ─── Drawing ───────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sort edges by depth for correct Z-order
  var sortedEdges = edgeList.slice().sort(function(a, b) {
    var az = (a.fromPos.z + a.toPos.z) / 2;
    var bz = (b.fromPos.z + b.toPos.z) / 2;
    return az - bz;
  });

  // Draw edges
  sortedEdges.forEach(function(e) {
    var p1 = project(e.fromPos.x, e.fromPos.y, e.fromPos.z);
    var p2 = project(e.toPos.x, e.toPos.y, e.toPos.z);
    var alpha = Math.min(1, (p1.scale + p2.scale) * 0.5 + 0.2);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.strokeStyle = e.color;
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = Math.max(1, (p1.scale + p2.scale) * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Draw flow dots
  var now = performance.now() / 1000;
  if (flowDots._lastTime === undefined) flowDots._lastTime = now;
  var delta = Math.min(now - flowDots._lastTime, 0.1);
  flowDots._lastTime = now;

  flowDots.forEach(function(fd) {
    fd.progress += fd.speed * delta;
    if (fd.progress > 1.0) fd.progress -= 1.0;
    var e = fd.edge;
    var x = e.fromPos.x + (e.toPos.x - e.fromPos.x) * fd.progress;
    var y = e.fromPos.y + (e.toPos.y - e.fromPos.y) * fd.progress;
    var z = e.fromPos.z + (e.toPos.z - e.fromPos.z) * fd.progress;
    var p = project(x, y, z);
    var radius = Math.max(2, 4 * p.scale);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  // Sort nodes by depth
  var sortedNodes = nodes.slice().sort(function(a, b) {
    var pa = nodePositions[a.id];
    var pb = nodePositions[b.id];
    if (!pa || !pb) return 0;
    return pa.z - pb.z;
  });

  // Draw nodes
  sortedNodes.forEach(function(n) {
    var pos = nodePositions[n.id];
    if (!pos) return;
    var p = project(pos.x, pos.y, pos.z);
    var color = getNodeColor(n);
    var halfSize = nodeHalfSize * p.scale;
    var isSelected = n.id === selectedNodeId;
    var isHovered = n.id === hoveredNodeId;

    // Glow for selected
    if (isSelected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
    }

    // Node rectangle
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    var rx = halfSize * 1.4;
    var ry = halfSize * 0.9;
    ctx.beginPath();
    ctx.roundRect(p.sx - rx, p.sy - ry, rx * 2, ry * 2, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Border
    var bw = isSelected ? 2 : (isHovered ? 1.5 : 1);
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = bw * p.scale;
    ctx.beginPath();
    ctx.roundRect(p.sx - rx, p.sy - ry, rx * 2, ry * 2, 4);
    ctx.stroke();

    // Label
    var fontSize = Math.max(9, 12 * p.scale);
    ctx.font = fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(n.label, p.sx, p.sy);
    ctx.shadowBlur = 0;
  });
}

// roundRect polyfill for canvas
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}

// ─── Stats ─────────────────────────────────────────────────
var frameCount = 0;
var lastFpsUpdate = 0;

function updateStats() {
  var now = performance.now();
  frameCount++;
  if (now - lastFpsUpdate >= 1000) {
    document.getElementById('fps').textContent = frameCount;
    document.getElementById('nodeCount').textContent = nodes.length;
    document.getElementById('edgeCount').textContent = connections.length;
    frameCount = 0;
    lastFpsUpdate = now;
  }
}

// ─── Animation loop ───────────────────────────────────────
function animate() {
  // Smooth zoom
  zoom += (targetZoom - zoom) * 0.08;
  if (Math.abs(zoom - targetZoom) < 0.001) zoom = targetZoom;

  resize();
  draw();
  updateStats();
  requestAnimationFrame(animate);
}

resize();
animate();
})();
</script>
</body>
</html>`;
}

// ─── 读取数据文件 ──────────────────────────────────────────
function readDataFile(filePath) {
  const resolvedPath = join(process.cwd(), filePath);
  const content = readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

// ─── MCP JSON-RPC 通信 ─────────────────────────────────────

// ─── HTTP Server 工具函数 ──────────────────────────────────

const MIME_MAP = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getMimeType(path) {
  return MIME_MAP[extname(path).toLowerCase()] || 'application/octet-stream';
}

function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && iface.address !== '127.0.0.1' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function findAvailablePort(startPort, maxAttempts) {
  return new Promise((resolve, reject) => {
    function tryPort(port, attempt) {
      if (attempt >= maxAttempts) {
        reject(new Error(`无法找到可用端口（尝试 ${startPort}-${startPort + maxAttempts - 1}）`));
        return;
      }
      const server = createNetServer();
      server.once('error', () => {
        server.close(() => tryPort(port + 1, attempt + 1));
      });
      server.listen(port, '0.0.0.0', () => {
        server.close(() => resolve(port));
      });
    }
    tryPort(startPort, 0);
  });
}

function startHttpServer(port) {
  const server = createServer((req, res) => {
    // 解析请求路径，默认到 index.html
    let urlPath = new URL(req.url, 'http://localhost').pathname;
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = join(OUTPUT_DIR, urlPath);

    // 安全检查：防止目录遍历
    if (!filePath.startsWith(OUTPUT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Access-Control-Allow-Origin': '*',
        'Content-Length': content.length,
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  });

  server.listen(port, '0.0.0.0');
  return server;
}

async function ensureHttpServer() {
  if (global.__httpServer) {
    return global.__httpPort;
  }

  try {
    const port = await findAvailablePort(8080, 10);
    const server = startHttpServer(port);
    global.__httpServer = server;
    global.__httpPort = port;

    server.on('error', (err) => {
      process.stderr.write(`[3d-monitor] HTTP Server error: ${err.message}\n`);
    });

    return port;
  } catch (err) {
    process.stderr.write(`[3d-monitor] HTTP Server 启动失败: ${err.message}\n`);
    return null;
  }
}

function formatHttpAddresses(filename) {
  const port = global.__httpPort;
  if (!port) return '';

  const ip = getLocalIP();
  const httpUrl = `http://${ip}:${port}/${filename}`;
  const fileUrl = `file://${join(OUTPUT_DIR, filename)}`;

  return (
    `📡 HTTP Server 已启动\n` +
    `   桌面访问: ${fileUrl}\n` +
    `   iOS访问:  ${httpUrl}`
  );
}


function sendMessage(msg) {
  const str = JSON.stringify(msg) + '\n';
  process.stdout.write(str);
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendMessage({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '0.1.0',
        capabilities: { tools: {} },
        serverInfo: { name: '3d-monitor', version: '0.1.10' },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    sendMessage({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [TOOL_DEFINITION],
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName !== '3d-monitor') {
      sendMessage({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      });
      return;
    }

    try {
      // 支持直接在 arguments 中传入 nodes/connections
      let data = args;
      let title = args.title || '3D 系统拓扑图';

      // 支持传入 dataFile 路径
      if (args.dataFile) {
        const fileData = readDataFile(args.dataFile);
        data = fileData;
      }

      if (!data.nodes || !Array.isArray(data.nodes)) {
        sendMessage({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: '无效数据：缺少 nodes 数组。请提供含 nodes/connections 的 JSON 数据',
          },
        });
        return;
      }

      const callMode = args.mode || renderMode;
      let filepath;
      if (callMode === '2d') {
        filepath = generateCanvas2DViewer(data, title);
      } else {
        filepath = generateViewer(data, title);
      }

      // 启动 HTTP Server（如果尚未启动）
      await ensureHttpServer();

      const nodeCount = data.nodes.length;
      const connCount = (data.connections || []).length;

      // 获取 HTML 文件名
      const htmlFilename = filepath.split('/').pop();

      let responseText = `3D 拓扑图已生成\n\n文件路径: ${filepath}\n节点数: ${nodeCount}\n连接数: ${connCount}\n\n双击 HTML 文件在浏览器中打开查看。`;
      if (global.__httpPort) {
        responseText += `\n\n` + formatHttpAddresses(htmlFilename);
      }

      sendMessage({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        },
      });
    } catch (err) {
      sendMessage({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `生成失败: ${err.message}` },
      });
    }
    return;
  }

  sendMessage({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

// ─── CLI 模式 ──────────────────────────────────────────────
function runCLI() {
  if (!dataFilePath) {
    console.error('错误: 请指定 --data-file <path>');
    console.error('用法: node mcp-server.js --data-file test-data.json');
    process.exit(1);
  }

  try {
    const data = readDataFile(dataFilePath);
    let filepath;
    if (renderMode === '2d') {
      filepath = generateCanvas2DViewer(data);
    } else {
      filepath = generateViewer(data);
    }
    console.log(`✅ ${renderMode === '2d' ? 'Canvas 2D' : '3D'} 拓扑图已生成`);
    console.log(`   文件: ${filepath}`);
    console.log(`   节点: ${data.nodes?.length || 0}`);
    console.log(`   连接: ${data.connections?.length || 0}`);

    // 启动 HTTP Server 以便 iOS 访问
    const htmlFilename = filepath.split('/').pop();
    ensureHttpServer().then(() => {
      console.log('');
      console.log(formatHttpAddresses(htmlFilename));
      console.log('');
      console.log('   按 Ctrl+C 停止 HTTP Server');
    });

    // 不退出进程，保持 Server 运行
    process.on('SIGINT', () => {
      console.log('\n正在关闭 HTTP Server...');
      if (global.__httpServer) {
        global.__httpServer.close(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  } catch (err) {
    console.error(`❌ 生成失败: ${err.message}`);
    process.exit(1);
  }
}

// ─── 启动 ──────────────────────────────────────────────────

if (dataFilePath) {
  runCLI();
} else {
  process.stderr.write('[3d-monitor] MCP server started (stdio transport, v2.1 - inline Three.js)\n');

  let buffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        handleRequest(msg).catch(e => process.stderr.write(`[3d-monitor] handler error: ${e.message}\n`));
      } catch (e) {
        process.stderr.write(`[3d-monitor] Failed to parse: ${trimmed}\n`);
      }
    }
  });

  process.stdin.on('end', () => {
    process.stderr.write('[3d-monitor] stdin closed, exiting.\n');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    if (global.__httpServer) global.__httpServer.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    if (global.__httpServer) global.__httpServer.close();
    process.exit(0);
  });
}
