/**
 * projectScanner.js — 启发式项目扫描器 (Heuristic Project Scanner)
 * v0.1.1
 *
 * 传感器模式：主动扫一个项目目录，自己发现模块和依赖，自动贴标签。
 * 输出与 --data-file 模式完全一致的标准 JSON 格式。
 *
 * 用法：
 *   import { scanProject } from './projectScanner.js';
 *   const result = await scanProject('/path/to/project');
 *
 * 输出：
 *   { nodes, connections, ports, tags, conflicts, source, projectPath }
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, basename, extname, dirname, sep } from 'node:path';
import { cwd } from 'node:process';
import { scanPorts } from './portRegistry.js';
import { createTagRegistry, TAG_DEFINITIONS } from './tagRegistry.js';

// ===== 文件系统工具 =====

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', 'build', '.next',
  '.gitkeep', '.DS_Store', 'coverage', '.vscode', '.idea',
  '.codex', 'target', '.venv', 'venv', 'env', '.env',
  'logs', 'tmp', 'temp', '.cache',
]);

const IGNORE_FILES = new Set([
  '.gitkeep', '.DS_Store', '.gitignore', '.npmrc', '.nvmrc',
  '.editorconfig', '.prettierrc', '.eslintrc', 'tsconfig.tsbuildinfo',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
]);

/**
 * Layer inference — 层划分规则 (v0.1.1)
 *
 * 优先级：先检查具体路径前缀匹配，再 fallback 到正则模式匹配。
 * 判断顺序：
 *   1. relPath 以 packages/ 开头且目录名包含 tool/cli/sensor → business（业务层）
 *   2. relPath 以 src 开头 → presentation（展示层）
 *   3. relPath 包含 dep- 前缀 → external（外部依赖）
 *   4. relPath 包含 plugins/ → infrastructure（构建插件）
 *   5. relPath 包含 server/ → infrastructure（MCP 服务端）
 *   6. relPath 包含 tools/ → infrastructure（辅助入口）
 *   7. 否则 fallback 到正则 LAYER_PATTERNS
 */
// v0.1.1 — Enhanced layer inference rules
// Directory/node keywords map to these layers:
//   api, client, store, data, hooks, db, database, query           → 'data'
//   components, views, ui, widget, display, pages, screens        → 'presentation'
//   services, controllers, routes, handlers, middleware            → 'business'
//   types, utils, helpers, config, constants, env, build, vite    → 'infrastructure'
//   dep-, node_modules, lib, vendor, external                      → 'external'
// If a node matches multiple keywords, the most specific wins.
// Unmatched nodes keep original layer or default to 'infrastructure'.
const LAYER_PATTERNS = [
  // ---- data ----
  { pattern: /api|client|store|data|hooks?|db|database|query/, layer: 'data' },
  // ---- presentation ----
  { pattern: /components?|views?|ui|widget|display|pages?|screens?/, layer: 'presentation' },
  // ---- business ----
  { pattern: /services?|controllers?|routes?|handlers?|middleware/, layer: 'business' },
  // ---- infrastructure ----
  { pattern: /types?|utils?|helpers?|config|constants?|env|build|vite/, layer: 'infrastructure' },
  // ---- external ----
  { pattern: /dep-|node_modules|lib|vendor|external/, layer: 'external' },
  // ---- legacy map (keep backward compat) ----
  { pattern: /frontend|ui|web|app\/pages|app\/components/, layer: 'presentation' },
  { pattern: /agent|agent[s]?|actor[s]?|bot[s]?|llm/, layer: 'business' },
  { pattern: /api|server|backend|service[s]?|graphql|trpc/, layer: 'data' },
  { pattern: /db|database|model[s]?|data|store|cache|queue/, layer: 'data' },
  { pattern: /config|util[s]?|helper[s]?|lib|shared|common/, layer: 'infrastructure' },
  { pattern: /plugin[s]?|extension[s]?|integration[s]?|connector/, layer: 'external' },
  { pattern: /test[s]?|spec[s]?|e2e|__test[s]?__/, layer: 'infrastructure' },
  { pattern: /docs?|doc|guide|wiki/, layer: 'infrastructure' },
  { pattern: /tool[s]?|cli|script[s]?|bin/, layer: 'infrastructure' },
  { pattern: /mcp|bridge|adapter|proxy|gateway/, layer: 'infrastructure' },
  { pattern: /public|static|assets|styles?|css/, layer: 'presentation' },
  { pattern: /component[s]?|layout[s]?|page[s]?|view[s]?/, layer: 'presentation' },
  { pattern: /hook[s]?|context[s]?|provider[s]?/, layer: 'data' },
  { pattern: /mcp/, layer: 'infrastructure' },
];

/**
 * 推断模块层归属 — 基于 relPath 的精确规则，优先级高于 LAYER_PATTERNS 正则
 */
function inferLayerFromPath(relPath) {
  // packages/ 下的 tool/cli 目录 → agent（工具层）
  if (/^packages\//.test(relPath)) {
    const dirnamePart = basename(relPath);
    if (/tool|cli|sensor|scanner/.test(dirnamePart)) return 'business';
    return 'infrastructure';
  }
  // src/ → frontend（展示层）
  if (/^src(\/|$)/.test(relPath)) return 'presentation';
  // dep- 前缀 → external
  if (/^dep-/.test(relPath)) return 'external';
  // plugins/ → infrastructure
  if (/^plugins(\/|$)/.test(relPath)) return 'infrastructure';
  // server/ → infrastructure
  if (/^server(\/|$)/.test(relPath)) return 'infrastructure';
  // tools/ → infrastructure
  if (/^tools(\/|$)/.test(relPath)) return 'infrastructure';
  return null;
}

// Color palette per layer
const LAYER_COLORS = {
  presentation: '#FFB74D',
  business: '#4CAF50',
  data: '#00BCD4',
  infrastructure: '#4A90D9',
  external: '#FF7043',
  default: '#9E9E9E',
};

/**
 * 中文名称和描述映射表
 * 根据路径或模块名推断中文信息
 */
const CHINESE_MAP = {
  'packages/port-tag-tool': { chineseName: '端口标签工具', chineseDesc: '核心传感器工具，扫描项目目录结构、生成端口和标签', description: 'Port Tag Tool — Core sensor that scans project directory structures, generates ports and tags' },
  'src': { chineseName: '3D全景前端', chineseDesc: '3D全景展示前端，基于Three.js渲染架构可视化', description: '3D Panorama Frontend — Three.js-based architecture visualization' },
  'plugins': { chineseName: '构建插件', chineseDesc: 'Vite构建插件，负责构建时注入和优化', description: 'Build Plugins — Vite build-time plugins for injection and optimization' },
  'server': { chineseName: 'MCP服务端', chineseDesc: 'MCP协议服务端，提供标准化接口', description: 'MCP Server — Standardized MCP protocol server' },
  'tools': { chineseName: '工具入口', chineseDesc: '辅助工具入口，提供Shell/CJS/Python等辅助脚本', description: 'Tool Entry — Helper entry points for Shell/CJS/Python scripts' },
  'src/data': { chineseName: '数据加载层', chineseDesc: 'MCP数据加载适配层，加载传感器扫描结果', description: 'Data Loader — MCP data loading adapter for sensor scan results' },
  'src/components': { chineseName: '3D渲染组件', chineseDesc: 'Three.js 3D场景渲染组件集合', description: '3D Render Components — Three.js scene rendering components' },
  'src/mcp': { chineseName: 'MCP前端适配', chineseDesc: '前端MCP协议适配模块', description: 'Frontend MCP Adapter' },
  'src/utils': { chineseName: '前端工具函数', chineseDesc: '前端通用工具函数和帮助方法', description: 'Frontend Utility Functions' },
  'src/examples': { chineseName: '示例数据', chineseDesc: '前端示例数据和演示配置', description: 'Example Data — Frontend demo data and configurations' },
};

/** 子文件中文名映射（packages/port-tag-tool 下的文件）*/
const FILE_CHINESE_MAP = {
  'cli.js': { chineseName: '命令行入口', chineseDesc: 'CLI命令行入口，支持scan/tags/ports等操作', description: 'CLI Entry — Command-line interface for scan/tags/ports actions' },
  'portRegistry.js': { chineseName: '端口注册表', chineseDesc: '端口注册与管理引擎，计算入口/出口端口', description: 'Port Registry — Port registration and management engine' },
  'tagRegistry.js': { chineseName: '标签注册表', chineseDesc: '标签定义与管理引擎，自动贴标签', description: 'Tag Registry — Tag definition and management engine' },
  'projectScanner.js': { chineseName: '项目扫描器', chineseDesc: '启发式项目扫描传感器，发现模块和依赖', description: 'Project Scanner — Heuristic sensor that discovers modules and dependencies' },
  'mcp-server.js': { chineseName: 'MCP服务器', chineseDesc: 'MCP协议服务器，对外暴露标准化工具接口', description: 'MCP Server — Exposes standardized tool interfaces via MCP protocol' },
  'index.js': { chineseName: '模块入口', chineseDesc: 'port-tag-tool模块导出入口', description: 'Module Entry — port-tag-tool package entry point' },
  'hermesExampleData.js': { chineseName: '示例数据', chineseDesc: 'Hermes系统内置示例数据', description: 'Hermes Example Data' },
};

// ===== 辅助函数 =====

function resolvePath(p) {
  if (p.startsWith('/')) return p;
  return join(cwd(), p);
}

function isSourceFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift'].includes(ext);
}

// ===== 目录树扫描 =====

function collectFiles(dirPath, maxDepth = 6, _depth = 0) {
  if (_depth > maxDepth) return { directories: [], files: [] };
  const result = { directories: [], files: [] };

  try {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || IGNORE_FILES.has(entry)) continue;
      const fullPath = join(dirPath, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        result.directories.push(fullPath);
        const sub = collectFiles(fullPath, maxDepth, _depth + 1);
        result.directories.push(...sub.directories);
        result.files.push(...sub.files);
      } else if (stat.isFile()) {
        result.files.push(fullPath);
      }
    }
  } catch {
    // skip directories we can't read
  }

  return result;
}

// ===== 配置文件读取 =====

function readPackageJson(dirPath) {
  const pkgPath = join(dirPath, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readRequirementsTxt(dirPath) {
  const reqPath = join(dirPath, 'requirements.txt');
  if (!existsSync(reqPath)) return [];
  try {
    const raw = readFileSync(reqPath, 'utf-8');
    return raw.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
      .map(l => l.split('==')[0].split('>=')[0].split('<=')[0].split('~=')[0].trim());
  } catch {
    return [];
  }
}

function readReadme(dirPath) {
  const readmePath = join(dirPath, 'README.md');
  if (!existsSync(readmePath)) return '';
  try {
    return readFileSync(readmePath, 'utf-8').slice(0, 2000);
  } catch {
    return '';
  }
}

function detectBuildTools(dirPath) {
  const tools = [];
  if (existsSync(join(dirPath, 'vite.config.js')) || existsSync(join(dirPath, 'vite.config.ts'))) tools.push('vite');
  if (existsSync(join(dirPath, 'next.config.js')) || existsSync(join(dirPath, 'next.config.mjs'))) tools.push('next');
  if (existsSync(join(dirPath, 'tsconfig.json'))) tools.push('typescript');
  if (existsSync(join(dirPath, 'nuxt.config.ts'))) tools.push('nuxt');
  if (existsSync(join(dirPath, 'webpack.config.js')) || existsSync(join(dirPath, 'webpack.config.ts'))) tools.push('webpack');
  return tools;
}

// ===== 导入/导出提取 =====

function extractImports(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    return { imports: [], exports: [] };
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports = [];
    const exports = [];

    // import ... from '...'
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+\s*(?:,\s*\{(?:[^}]*)\})?)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // export ... from '...'
    const exportRegex = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // export function/const/class ...
    const exportDeclRegex = /export\s+(?:default\s+)?(?:function|const|let|var|class|async\s+function)\s+(\w+)/g;
    while ((match = exportDeclRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // module.exports
    if (content.includes('module.exports')) {
      exports.push('module.exports');
    }

    return { imports, exports };
  } catch {
    return { imports: [], exports: [] };
  }
}

// ===== 模块发现 =====

/**
 * 发现项目中的模块。
 * 支持子结构：如果一个目录下有多个源文件，会为每个文件生成子节点。
 */
function discoverModules(projectPath, fileList) {
  const modules = new Map(); // id -> module info
  const sourceFiles = fileList.filter(f => isSourceFile(f));

  // Group source files by their parent directory
  const dirFiles = new Map();
  for (const file of sourceFiles) {
    const dir = dirname(file);
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir).push(file);
  }

  // Sort directories by depth (shallow first)
  const sortedDirs = [...dirFiles.keys()].sort((a, b) => a.split(sep).length - b.split(sep).length);

  // Track which parent modules get child nodes
  const parentChildFiles = new Map(); // parentModId -> [{ fileName, filePath, relPath }]

  for (const dir of sortedDirs) {
    const relPath = relative(projectPath, dir);
    const dirName = basename(dir);

    // Skip root
    if (dir === projectPath) continue;

    // Determine module ID from relative path
    const modId = relPath.replace(/\//g, '-').replace(/^src[-]/, '').toLowerCase();

    // === 问题1修复：精确层推断 ===
    let layer = inferLayerFromPath(relPath);
    if (!layer) {
      for (const { pattern, layer: l } of LAYER_PATTERNS) {
        if (pattern.test(relPath) || pattern.test(dirName)) {
          layer = l;
          break;
        }
      }
    }
    if (!layer) layer = 'infrastructure';

    // Collect imports from files in this directory
    const allImports = new Set();
    const allExports = new Set();
    const filesInDir = dirFiles.get(dir);
    for (const file of filesInDir) {
      const { imports, exports } = extractImports(file);
      for (const im of imports) allImports.add(im);
      for (const ex of exports) allExports.add(ex);
    }

    // Label from directory name
    const label = dirName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    // === 问题3修复：中文名称和描述 ===
    const chineseInfo = CHINESE_MAP[relPath] || CHINESE_MAP[dirName] || {};
    const description = chineseInfo.description || `Module: ${relPath} (${filesInDir.length} source files)`;
    const chineseName = chineseInfo.chineseName || label;
    const chineseDesc = chineseInfo.chineseDesc || `${label}模块`;

    modules.set(modId, {
      id: modId,
      label,
      layer,
      description,
      chineseName,
      chineseDesc,
      relPath,
      dirName,
      fileCount: filesInDir.length,
      files: filesInDir.map(f => basename(f)),
      imports: [...allImports],
      exports: [...allExports],
    });

    // === 问题4修复：检测子结构 ===
    // 如果这个目录在 packages/port-tag-tool 下（或其他包含多个源文件的子目录），
    // 记录需要生成子节点的文件
    if (filesInDir.length >= 2) {
      parentChildFiles.set(modId, filesInDir);
    }
  }

  // Generate child nodes for directories with multiple source files
  const childNodes = new Map(); // childId -> child module info
  for (const [parentModId, files] of parentChildFiles) {
    const parentMod = modules.get(parentModId);
    if (!parentMod) continue;

    // Only generate child nodes for key directories that benefit from substructure
    // Currently focused on packages/port-tag-tool and src/components
    const shouldExpand = parentMod.relPath === 'packages/port-tag-tool' ||
                         parentMod.relPath === 'src/components' ||
                         parentMod.relPath === 'src/data' ||
                         (parentMod.fileCount >= 3 && parentMod.layer !== 'external');

    if (!shouldExpand) continue;

    for (const fileName of files) {
      const fileBaseName = basename(fileName, extname(fileName));
      const childId = `${parentModId}--${fileBaseName}`;
      const childLabel = fileBaseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      // Get Chinese info for known files
      const fileChinese = FILE_CHINESE_MAP[basename(fileName)] || {};
      const childChineseName = fileChinese.chineseName || childLabel;
      const childChineseDesc = fileChinese.chineseDesc || `${parentMod.chineseName}的子模块${childLabel}`;
      const childDescription = fileChinese.description || `File: ${basename(fileName)} in ${parentMod.relPath}`;

      childNodes.set(childId, {
        id: childId,
        label: childLabel,
        layer: parentMod.layer,
        description: childDescription,
        chineseName: childChineseName,
        chineseDesc: childChineseDesc,
        relPath: join(parentMod.relPath, fileName),
        dirName: parentMod.dirName,
        fileCount: 1,
        files: [fileName],
        parent: parentModId,
        imports: [],
        exports: [],
      });
    }
  }

  // Merge child nodes into modules
  for (const [childId, childInfo] of childNodes) {
    modules.set(childId, childInfo);
  }

  return modules;
}

// ===== 连接发现 =====

function resolveModuleFromImport(importStr, modules) {
  const clean = importStr.replace(/^\.\.?\//, '').replace(/\/[^/]*$/, '').replace(/\//g, '-').toLowerCase();
  if (modules.has(clean)) return clean;

  // Try prefix/suffix match
  for (const [id, mod] of modules) {
    if (importStr.includes(mod.dirName)) return id;
    const importPath = importStr.replace(/^\.\.?\//, '');
    if (mod.relPath === importPath || mod.relPath.endsWith('/' + importPath) || importPath.endsWith(mod.relPath)) return id;
  }

  return null;
}

function resolveNpmDependency(importStr, pkg) {
  if (!pkg) return null;
  const firstSegment = importStr.split('/')[0];

  // Check scoped packages (@scope/pkg)
  const scopedMatch = importStr.match(/^(@[^/]+\/[^/]+)/);
  const depName = scopedMatch ? scopedMatch[1] : firstSegment;

  if (pkg.dependencies && pkg.dependencies[depName]) return depName;
  if (pkg.devDependencies && pkg.devDependencies[depName]) return depName;
  return null;
}

/**
 * 发现模块之间的连接关系。
 *
 * === 问题2修复 ===
 * 区分控制流（control）和数据流（data）：
 * - mcpLoader → projectScanner → 控制流
 * - 一般文件 import/require → 数据流
 * - workspace 关系 → config
 * - 外部依赖 → data
 */
function discoverConnections(projectPath, modules, pkg) {
  const connections = [];
  const seen = new Set();

  // === 控制流模式识别 ===
  // mcpLoader 调用 projectScanner → control 流
  const CONTROL_FLOW_PAIRS = [
    { fromPattern: /data/, toPattern: /project-scanner|projectScanner/, source: 'mcpLoader -> projectScanner' },
    { fromPattern: /mcp-loader|mcpLoader/, toPattern: /project-scanner|projectScanner/, source: 'mcpLoader -> projectScanner' },
    { fromPattern: /mcp-server/, toPattern: /project-scanner|projectScanner/, source: 'mcp-server -> projectScanner' },
    { fromPattern: /cli/, toPattern: /project-scanner|projectScanner|port-registry|tag-registry/, source: 'cli -> scanner/registries' },
  ];

  for (const [modId, mod] of modules) {
    // Check control flow patterns
    for (const cf of CONTROL_FLOW_PAIRS) {
      if (cf.fromPattern.test(modId)) {
        for (const [targetId, targetMod] of modules) {
          if (targetId !== modId && cf.toPattern.test(targetId)) {
            const key = `${modId}->${targetId}`;
            if (!seen.has(key)) {
              seen.add(key);
              connections.push({
                id: `conn-${modId}-${targetId}`,
                from: modId,
                to: targetId,
                flowType: 'control',
                label: cf.source,
                color: '#FF5722',
              });
            }
          }
        }
      }
    }

    // 1. From source file imports — data flow
    for (const imp of mod.imports) {
      if (imp.startsWith('node:')) continue;

      // Internal module reference
      const targetModId = resolveModuleFromImport(imp, modules);
      if (targetModId && targetModId !== modId) {
        const key = `${modId}->${targetModId}`;
        if (!seen.has(key)) {
          seen.add(key);
          connections.push({
            id: `conn-${modId}-${targetModId}`,
            from: modId,
            to: targetModId,
            flowType: 'data',
            label: 'import',
            color: '#00BCD4',
          });
        }
      }

      // External dependency — data flow
      const depName = resolveNpmDependency(imp, pkg);
      if (depName) {
        const extModId = `dep-${depName}`;
        const key = `${modId}->${extModId}`;
        if (!seen.has(key)) {
          seen.add(key);
          connections.push({
            id: `conn-${modId}-${extModId}`,
            from: modId,
            to: extModId,
            flowType: 'data',
            label: depName,
            color: '#FF7043',
          });
        }
      }
    }
  }

  // 2. From package.json workspaces — config flow
  if (pkg && pkg.workspaces) {
    const workspaceRoot = basename(projectPath);
    for (const ws of pkg.workspaces) {
      const wsId = ws.replace(/\//g, '-').toLowerCase();
      const key = `project-root->${wsId}`;
      if (!seen.has(key)) {
        seen.add(key);
        connections.push({
          id: `conn-root-${wsId}`,
          from: 'project-root',
          to: wsId,
          flowType: 'config',
          label: `workspace: ${ws}`,
          color: '#9C27B0',
        });
      }
    }
  }

  return connections;
}

// ===== 节点生成 =====

function buildDependencyNodes(pkg) {
  const nodes = [];
  if (!pkg) return nodes;

  // Seeded random for deterministic positions
  const SEED = 42;
  let seedCounter = 0;
  function seededRandom() {
    seedCounter++;
    const x = Math.sin(SEED + seedCounter * 100) * 10000;
    return x - Math.floor(x);
  }


  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [depName, depVersion] of Object.entries(allDeps)) {
    nodes.push({
      id: `dep-${depName}`,
      label: depName,
      layer: 'external',
      description: `External dependency: ${depName}@${depVersion}`,
      chineseName: depName,
      chineseDesc: `外部依赖: ${depName}@${depVersion}`,
      color: '#FF7043',
      geometryType: 'box',
      status: 'External',
      position: [16 + (seededRandom() - 0.5) * 4, 0, 12 + seededRandom() * 2],
    });
  }

  return nodes;
}

function buildEntryNodes(projectPath, pkg) {
  const nodes = [];
  const projectName = pkg?.name || basename(projectPath);
  const projectDesc = pkg?.description || '';

  // === 问题1修复：根节点 layer 改为 infrastructure ===
  nodes.push({
    id: 'project-root',
    label: projectName,
    layer: 'infrastructure',
    description: projectDesc || `Project: ${projectName}`,
    chineseName: '系统3D全景',
    chineseDesc: projectDesc || '3D全景可视化系统 — 架构节点、连接、数据流展示',
    color: '#4CAF50',
    geometryType: 'sphere',
    status: 'Active',
    position: [0, 0, -4],
  });

  return nodes;
}

// ===== 去重 =====

function deduplicateNodes(nodes) {
  const seen = new Set();
  return nodes.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

function deduplicateConnections(connections) {
  const seen = new Set();
  return connections.filter(c => {
    const key = `${c.from}->${c.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ===== 质量报告 =====

function buildQualityReport(projectPath, modules, nodes, connections, files) {
  return {
    totalDirectoriesScanned: modules.size,
    totalFilesFound: files.length,
    totalNodesGenerated: nodes.length,
    totalConnectionsGenerated: connections.length,
    moduleIds: [...modules.keys()],
    hasPackageJson: existsSync(join(projectPath, 'package.json')),
    hasReadme: existsSync(join(projectPath, 'README.md')),
    hasRequirementsTxt: existsSync(join(projectPath, 'requirements.txt')),
    buildTools: detectBuildTools(projectPath),
  };
}

// ===== 主入口 =====

/**
 * 扫描一个项目目录，返回标准 JSON 格式的架构数据。
 *
 * 传感器模式——自己去扫项目目录、发现模块和依赖、自动贴标签。
 *
 * @param {string} projectPath - 项目目录路径（相对或绝对）
 * @param {Object} [options] - 可选参数
 * @param {number} [options.maxDepth=6] - 最大扫描深度
 * @returns {Object} { nodes, connections, ports, tags, conflicts, source, projectPath, quality }
 */
export async function scanProject(projectPath, options = {}) {
  const maxDepth = options.maxDepth || 6;
  const resolvedPath = resolvePath(projectPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Project path does not exist: ${resolvedPath}`);
  }

  // Phase 1: Scan directory tree
  const { directories, files } = collectFiles(resolvedPath, maxDepth);

  // Phase 2: Read config files
  const pkg = readPackageJson(resolvedPath);
  const requirements = readRequirementsTxt(resolvedPath);
  const readme = readReadme(resolvedPath);
  const buildTools = detectBuildTools(resolvedPath);

  // Phase 3: Discover modules from source files
  const modules = discoverModules(resolvedPath, files);

  // Phase 4: Generate dependency nodes
  const depNodes = buildDependencyNodes(pkg);

  // Phase 5: Generate entry nodes
  const entryNodes = buildEntryNodes(resolvedPath, pkg);

  // Phase 6: Convert modules to nodes
  const moduleNodes = [];

  // --- Layer position presets ---
  const LAYER_Z = {
    infrastructure: 0,
    data: 2,
    business: 4,
    presentation: 6,
    external: 8,
  };
  const LAYER_X = {
    infrastructure: -8,
    data: -4,
    business: 0,
    presentation: 4,
    external: 8,
  };

  // Seeded random for small Z jitter
  const SEED = 42;
  let seedCounter = 0;
  function seededRandom() {
    seedCounter++;
    const x = Math.sin(SEED + seedCounter * 100) * 10000;
    return x - Math.floor(x);
  }

  // First pass: create all nodes
  for (const [, mod] of modules) {
    const layer = mod.layer || 'infrastructure';
    const node = {
      id: mod.id,
      label: mod.label,
      layer: layer,
      description: mod.description,
      chineseName: mod.chineseName,
      chineseDesc: mod.chineseDesc,
      color: LAYER_COLORS[layer] || LAYER_COLORS.default,
      geometryType: 'box',
      status: 'Active',
    };
    // Preserve parent link for child nodes
    if (mod.parent) {
      node._parentId = mod.parent;
    }
    moduleNodes.push(node);
  }

  // Second pass: assign positions
  // Group nodes by layer and collect child mappings
  const layerGroups = {};
  const childNodes = [];
  const parentNodes = [];
  for (const node of moduleNodes) {
    if (node._parentId) {
      childNodes.push(node);
    } else {
      parentNodes.push(node);
      const l = node.layer || 'infrastructure';
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(node);
    }
  }

  // Assign positions to parent (non-child) nodes per layer
  for (const [layer, nodes] of Object.entries(layerGroups)) {
    const count = nodes.length;
    const baseX = LAYER_X[layer] ?? 0;
    const baseZ = LAYER_Z[layer] ?? 0;
    nodes.forEach((node, i) => {
      let y;
      if (count === 1) {
        y = 0;
      } else {
        // Distribute evenly from -(count-1)*1.5 to (count-1)*1.5
        const halfRange = (count - 1) * 1.5;
        y = -halfRange + (i / (count - 1)) * (halfRange * 2);
      }
      const jitterZ = (seededRandom() - 0.5) * 0.6; // ±0.3
      node.position = [baseX, y, baseZ + jitterZ];
    });
  }

  // Assign positions to child nodes (inherit parent X/Z, stack below parent)
  const parentMap = {};
  for (const node of parentNodes) {
    parentMap[node.id] = node;
  }
  const childrenByParent = {};
  for (const node of childNodes) {
    const pid = node._parentId;
    if (!childrenByParent[pid]) childrenByParent[pid] = [];
    childrenByParent[pid].push(node);
  }
  for (const [pid, children] of Object.entries(childrenByParent)) {
    const parent = parentMap[pid];
    if (!parent) continue;
    const [px, py, pz] = parent.position;
    children.forEach((node, i) => {
      node.position = [px, py - (i + 1) * 1.0, pz + 0.3];
    });
  }
  // Combine all nodes
  let nodes = deduplicateNodes([...entryNodes, ...moduleNodes, ...depNodes]);

  // Phase 7: Discover connections
  let connections = discoverConnections(resolvedPath, modules, pkg);
  connections = deduplicateConnections(connections);

  // Phase 8: Run port scan and tagging
  const tagRegistry = createTagRegistry(TAG_DEFINITIONS);
  const portResult = scanPorts(connections, nodes);
  const summary = tagRegistry.summarize(connections);
  const conflicts = tagRegistry.detectConflicts(connections);

  // Phase 9: Build quality report
  const quality = buildQualityReport(resolvedPath, modules, nodes, connections, files);

  // Final output
  return {
    nodes,
    connections,
    ports: {
      stats: portResult.stats,
      nodePorts: portResult.nodePorts,
    },
    tags: {
      definitions: tagRegistry.getAllTags(),
      index: summary.tagIndex,
      portLabels: summary.portLabels,
    },
    flowTypes: summary.flowTypeSummary,
    conflicts,
    source: 'port-tag-tool v0.1.1',
    projectPath: resolvedPath,
    quality,
    buildTools,
  };
}

export default scanProject;
