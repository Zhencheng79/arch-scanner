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
 * 通用中文名称映射表 — 适用于所有项目的常见目录和文件名称
 */
const GENERIC_CHINESE_MAP = {
  // --- 常见目录 ---
  'lib': { chineseName: '库', chineseDesc: '公共库模块', description: 'Library — Shared library code' },
  'api': { chineseName: 'API接口', chineseDesc: 'API接口层，处理外部请求和响应', description: 'API Layer — External request/response handling' },
  'src': { chineseName: '源码目录', chineseDesc: '项目源代码主目录', description: 'Source — Project source code root directory' },
  'components': { chineseName: '组件', chineseDesc: 'UI组件集合', description: 'Components — UI component collection' },
  'utils': { chineseName: '工具函数', chineseDesc: '通用工具函数集合', description: 'Utilities — Common utility functions' },
  'config': { chineseName: '配置', chineseDesc: '项目配置文件', description: 'Configuration — Project configuration files' },
  'hooks': { chineseName: '钩子', chineseDesc: '自定义钩子函数', description: 'Hooks — Custom hook functions' },
  'services': { chineseName: '服务', chineseDesc: '业务服务层', description: 'Services — Business service layer' },
  'types': { chineseName: '类型定义', chineseDesc: 'TypeScript类型定义', description: 'Types — TypeScript type definitions' },
  'styles': { chineseName: '样式', chineseDesc: '样式定义文件', description: 'Styles — Style definitions' },
  'assets': { chineseName: '静态资源', chineseDesc: '静态资源文件，如图片、字体等', description: 'Assets — Static resources such as images, fonts' },
  'public': { chineseName: '公共资源', chineseDesc: '公共静态资源目录', description: 'Public — Public static assets directory' },
  'pages': { chineseName: '页面', chineseDesc: '页面级组件', description: 'Pages — Page-level components' },
  'views': { chineseName: '视图', chineseDesc: '视图组件', description: 'Views — View components' },
  'store': { chineseName: '状态管理', chineseDesc: '全局状态管理模块', description: 'Store — Global state management' },
  'db': { chineseName: '数据库', chineseDesc: '数据库相关模块', description: 'Database — Database-related modules' },
  'data': { chineseName: '数据处理', chineseDesc: '数据处理层', description: 'Data — Data processing layer' },
  'middleware': { chineseName: '中间件', chineseDesc: '中间件处理层', description: 'Middleware — Middleware processing layer' },
  'routes': { chineseName: '路由', chineseDesc: '路由配置定义', description: 'Routes — Route definitions' },
  'controllers': { chineseName: '控制器', chineseDesc: '请求控制器', description: 'Controllers — Request controllers' },
  'models': { chineseName: '数据模型', chineseDesc: '数据模型定义', description: 'Models — Data model definitions' },
  'helpers': { chineseName: '辅助函数', chineseDesc: '辅助工具函数', description: 'Helpers — Helper utility functions' },
  'constants': { chineseName: '常量', chineseDesc: '常量定义文件', description: 'Constants — Constant definitions' },
  'env': { chineseName: '环境配置', chineseDesc: '环境配置文件', description: 'Environment — Environment configuration' },
  'build': { chineseName: '构建输出', chineseDesc: '构建产物目录', description: 'Build — Build output directory' },
  'dist': { chineseName: '分发目录', chineseDesc: '分发包目录', description: 'Dist — Distribution directory' },
  'test': { chineseName: '测试', chineseDesc: '测试文件集合', description: 'Test — Test files' },
  'docs': { chineseName: '文档', chineseDesc: '项目文档', description: 'Docs — Project documentation' },
  'scripts': { chineseName: '脚本', chineseDesc: '辅助脚本工具', description: 'Scripts — Helper scripts' },
  'bin': { chineseName: '二进制', chineseDesc: '可执行二进制文件', description: 'Bin — Executable binaries' },
  'client': { chineseName: '客户端', chineseDesc: '客户端代码', description: 'Client — Client-side code' },
  'deploy': { chineseName: '部署', chineseDesc: '部署配置和脚本', description: 'Deploy — Deployment configurations and scripts' },
  'docker': { chineseName: 'Docker', chineseDesc: 'Docker容器配置', description: 'Docker — Docker container configuration' },
  'migrations': { chineseName: '数据库迁移', chineseDesc: '数据库迁移脚本', description: 'Migrations — Database migration scripts' },
  'seeds': { chineseName: '数据填充', chineseDesc: '数据库数据填充脚本', description: 'Seeds — Database seed data scripts' },
  'generated': { chineseName: '生成代码', chineseDesc: '自动生成的代码', description: 'Generated — Auto-generated code' },
  'shared': { chineseName: '共享模块', chineseDesc: '跨项目共享代码', description: 'Shared — Cross-project shared code' },
  'common': { chineseName: '公共模块', chineseDesc: '公共基础代码', description: 'Common — Common base code' },
  'core': { chineseName: '核心模块', chineseDesc: '系统核心功能', description: 'Core — Core system functionality' },
  'features': { chineseName: '功能模块', chineseDesc: '业务功能模块', description: 'Features — Business feature modules' },
  'modules': { chineseName: '模块', chineseDesc: '功能模块集合', description: 'Modules — Feature module collection' },
  'widgets': { chineseName: '小部件', chineseDesc: '可复用小部件', description: 'Widgets — Reusable widgets' },
  'layout': { chineseName: '布局', chineseDesc: '页面布局组件', description: 'Layout — Page layout components' },
  'templates': { chineseName: '模板', chineseDesc: '代码模板文件', description: 'Templates — Code template files' },
  'mcp': { chineseName: 'MCP协议', chineseDesc: 'MCP协议适配层', description: 'MCP — MCP protocol adapter layer' },
  'bridge': { chineseName: '桥接层', chineseDesc: '系统间桥接层', description: 'Bridge — Cross-system bridge layer' },
  'proxy': { chineseName: '代理', chineseDesc: '代理层模块', description: 'Proxy — Proxy layer module' },
  'gateway': { chineseName: '网关', chineseDesc: 'API网关服务', description: 'Gateway — API gateway service' },
  'adapter': { chineseName: '适配器', chineseDesc: '外部系统适配器', description: 'Adapter — External system adapter' },
  'provider': { chineseName: '提供者', chineseDesc: '服务提供者', description: 'Provider — Service provider' },
  'context': { chineseName: '上下文', chineseDesc: 'React上下文模块', description: 'Context — React context module' },
  'selectors': { chineseName: '选择器', chineseDesc: '状态选择器', description: 'Selectors — State selectors' },
  'reducer': { chineseName: '状态归约', chineseDesc: '状态归约函数', description: 'Reducer — State reducer function' },
  'actions': { chineseName: '状态动作', chineseDesc: '状态动作定义', description: 'Actions — State action definitions' },
  'schema': { chineseName: '数据模式', chineseDesc: '数据结构模式定义', description: 'Schema — Data schema definitions' },
  'theme': { chineseName: '主题', chineseDesc: '主题样式定义', description: 'Theme — Theme style definitions' },
  'setup': { chineseName: '初始化', chineseDesc: '环境初始化配置', description: 'Setup — Environment initialization' },
  'spec': { chineseName: '规格测试', chineseDesc: '规格测试文件', description: 'Spec — Specification test files' },
  // --- 常见文件 (不含扩展名) ---
  'index': { chineseName: '入口文件', chineseDesc: '模块入口文件', description: 'Entry — Module entry file' },
  'main': { chineseName: '主入口', chineseDesc: '应用主入口文件', description: 'Main — Application main entry file' },
  'app': { chineseName: '应用入口', chineseDesc: '应用主入口', description: 'App — Application entry point' },
  'cli': { chineseName: '命令行入口', chineseDesc: 'CLI命令行工具入口', description: 'CLI — Command-line interface entry point' },
  'router': { chineseName: '路由配置', chineseDesc: '路由配置定义', description: 'Router — Route configuration definition' },
  'README': { chineseName: '项目说明', chineseDesc: '项目说明文档', description: 'README — Project documentation' },
  'package': { chineseName: '包配置', chineseDesc: '包管理配置文件', description: 'Package — Package configuration file' },
};

/**


/**
 * 通用文件名中文映射（按文件名不含扩展名匹配）
 */
const FILE_GENERIC_MAP = {
  'index': { chineseName: '模块入口', chineseDesc: '模块导出入口文件', description: 'Entry — Module export entry file' },
  'cli': { chineseName: '命令行入口', chineseDesc: 'CLI命令行入口', description: 'CLI — Command-line interface entry' },
  'server': { chineseName: '服务端入口', chineseDesc: '服务端启动入口', description: 'Server — Server entry point' },
  'utils': { chineseName: '工具函数', chineseDesc: '工具函数集合', description: 'Utils — Utility functions' },
  'helpers': { chineseName: '辅助函数', chineseDesc: '辅助函数集合', description: 'Helpers — Helper functions' },
  'constants': { chineseName: '常量定义', chineseDesc: '常量定义文件', description: 'Constants — Constant definitions' },
  'types': { chineseName: '类型定义', chineseDesc: 'TypeScript类型定义文件', description: 'Types — TypeScript type definitions' },
  'api': { chineseName: 'API接口', chineseDesc: '外部API接口定义', description: 'API — External API interface definitions' },
  'routes': { chineseName: '路由定义', chineseDesc: '路由配置定义', description: 'Routes — Route configuration definitions' },
  'models': { chineseName: '数据模型', chineseDesc: '数据模型定义', description: 'Models — Data model definitions' },
  'schema': { chineseName: '数据模式', chineseDesc: '数据结构模式定义', description: 'Schema — Data schema definitions' },
  'hooks': { chineseName: '自定义钩子', chineseDesc: '自定义React钩子', description: 'Hooks — Custom React hooks' },
  'store': { chineseName: '状态管理', chineseDesc: '状态管理模块', description: 'Store — State management module' },
  'reducer': { chineseName: '状态归约', chineseDesc: '状态归约函数', description: 'Reducer — State reducer function' },
  'actions': { chineseName: '状态动作', chineseDesc: '状态动作定义', description: 'Actions — State action definitions' },
  'selectors': { chineseName: '状态选择器', chineseDesc: '状态选择器函数', description: 'Selectors — State selector functions' },
  'styles': { chineseName: '样式定义', chineseDesc: '样式表文件', description: 'Styles — Style definitions' },
  'theme': { chineseName: '主题定义', chineseDesc: '主题配置定义', description: 'Theme — Theme configuration definitions' },
  'test': { chineseName: '测试文件', chineseDesc: '单元测试文件', description: 'Test — Unit test file' },
  'spec': { chineseName: '规格测试', chineseDesc: '规格测试文件', description: 'Spec — Specification test file' },
  'setup': { chineseName: '初始化', chineseDesc: '测试环境初始化', description: 'Setup — Test environment setup' },
  'config': { chineseName: '配置', chineseDesc: '应用配置文件', description: 'Config — Application configuration file' },
  'middleware': { chineseName: '中间件', chineseDesc: '中间件定义', description: 'Middleware — Middleware definitions' },
  'README': { chineseName: '项目说明', chineseDesc: '项目说明文档', description: 'README — Project documentation' },
  'package': { chineseName: '包配置', chineseDesc: '包管理配置文件', description: 'Package — Package configuration file' },
};

/**
 * 根据目录名或文件名智能生成中文名称
 * @param {string} name - 目录名或文件名（不含扩展名）
 * @param {string} type - 'dir' 或 'file'
 * @returns {string} 中文名称
 */
function generateChineseName(name, type = 'dir') {
  // 先查 GENERIC_CHINESE_MAP（包含常见的目录和文件映射）
  if (GENERIC_CHINESE_MAP[name] && GENERIC_CHINESE_MAP[name].chineseName) {
    return GENERIC_CHINESE_MAP[name].chineseName;
  }
  // 查 FILE_GENERIC_MAP
  if (FILE_GENERIC_MAP[name] && FILE_GENERIC_MAP[name].chineseName) {
    return FILE_GENERIC_MAP[name].chineseName;
  }
  // 未匹配：将英文名按语义拆分，各单词首字母大写
  const label = name
    // camelCase → 空格分隔
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // kebab-case → 空格分隔
    .replace(/[-_]/g, ' ')
    // 多个空格合并
    .replace(/\s+/g, ' ')
    .trim()
    // 各单词首字母大写
    .replace(/\w/g, c => c.toUpperCase());
  return label || name;
}

/**
 * 根据目录名或文件名智能生成中文描述
 * @param {string} name - 目录名或文件名（不含扩展名）
 * @param {string} label - 英文 label（已格式化）
 * @param {string} type - 'dir' 或 'file'
 * @returns {string} 中文描述
 */
function generateChineseDesc(name, label, type = 'dir') {
  // 先查已知映射
  if (GENERIC_CHINESE_MAP[name] && GENERIC_CHINESE_MAP[name].chineseDesc) {
    return GENERIC_CHINESE_MAP[name].chineseDesc;
  }
  if (FILE_GENERIC_MAP[name] && FILE_GENERIC_MAP[name].chineseDesc) {
    return FILE_GENERIC_MAP[name].chineseDesc;
  }
  // 未匹配：使用 label 纯中文或纯英文展示，不混杂
  if (type === 'file') {
    return `${label} — ${label}文件`;
  }
  return `${label} — ${label}`;
}

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
    const chineseInfo = GENERIC_CHINESE_MAP[relPath] || {};
    const description = chineseInfo.description || `Module: ${relPath} (${filesInDir.length} source files)`;
    const chineseName = chineseInfo.chineseName || generateChineseName(dirName, 'dir');
    const chineseDesc = chineseInfo.chineseDesc || generateChineseDesc(dirName, label, 'dir');

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
      const fileNameOnly = basename(fileName);
      const fileChinese = FILE_GENERIC_MAP[fileBaseName] ? {
          chineseName: FILE_GENERIC_MAP[fileBaseName].chineseName,
          chineseDesc: FILE_GENERIC_MAP[fileBaseName].chineseDesc,
          description: FILE_GENERIC_MAP[fileBaseName].description,
        } : {};
      const childChineseName = fileChinese.chineseName || generateChineseName(fileBaseName, 'file');
      const childChineseDesc = fileChinese.chineseDesc ||
        generateChineseDesc(fileBaseName, childLabel, 'file');
      const childDescription = fileChinese.description || `File: ${basename(fileName)} in ${parentMod.relPath}`;

      // Per-file imports/exports using extractImports (which uses AST with JSX support)
      const { imports: fileImports_1, exports: fileExports_1 } = extractImports(fileName);

      childNodes.set(childId, {
        id: childId,
        module: inferModule(childId),
        label: childLabel,
        layer: parentMod.layer,
        description: childDescription,
        chineseName: childChineseName,
        chineseDesc: childChineseDesc,
        relPath: parentMod.relPath + '/' + basename(fileName),
        dirName: parentMod.dirName,
        fileCount: 1,
        files: [fileName],
        parent: parentModId,
        imports: fileImports_1,
        exports: fileExports_1,
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

function resolveModuleFromImport(importStr, modules, sourceModId, projectPath) {

  // === Cross-directory relative import resolution (../) ===
  // Must come BEFORE the clean direct-match because importStr like "../data/systemData"
  // would be cleaned to "data" (a parent module), masking the intended child module "data--systemData".
  if (importStr.startsWith("../") && sourceModId) {
    const result = resolveCrossDirectoryImport(importStr, modules, sourceModId, projectPath);
    if (result) return result;
  }

  // Try direct match after cleaning: ./foo -> foo, ../bar/baz -> bar-baz
  const clean = importStr.replace(/^\.\.?\//, "").replace(/\/[^/]*$/, "").replace(/\//g, "-").toLowerCase();

  // === V2 新增：子模块匹配 ===
  // 如果 importStr 包含路径分隔符（/），最后一段可能是文件名
  // 例如：../data/systemData → 最后一段是 systemData
  const parts = importStr.replace(/^\.\.?\//, "").split("/");
  if (parts.length >= 2) {
    const parentName = parts[0].toLowerCase();
    const childName = parts[parts.length - 1].replace(/\.\w+$/, "").toLowerCase();

    // 先找父模块
    let parentId = null;
    for (const [id] of modules) {
      if (id.toLowerCase() === parentName) { parentId = id; break; }
    }

    if (parentId) {
      // 在父模块下找子模块：ID 格式为 "data--xxx"，文件路径包含 childName
      for (const [id, mod] of modules) {
        if (id.startsWith(parentId + "--")) {
          // 检查模块的文件名是否匹配
          if (mod.files && mod.files.length > 0) {
            for (const f of mod.files) {
              const baseName = f.split("/").pop().replace(/\.\w+$/, "").toLowerCase();
              if (baseName === childName) return id;
            }
          }
        }
      }
    }
  }

  if (modules.has(clean)) return clean;
  // === Child module matching for same-directory relative imports (./) ===
  // If sourceModId is e.g. "components--AccordionExpand" and import is "./Node3D",
  // resolve against the parent directory's child nodes
  if (sourceModId && importStr.startsWith('./')) {
    const targetBase = importStr.replace(/^\.\//, '').replace(/\.[^.]+$/, '');
    const targetId = targetBase.replace(/\//g, '-');

    // Direct child match: check if any module ends with -- + targetId (case-insensitive)
    for (const [id] of modules) {
      if (id.toLowerCase().endsWith('--' + targetId.toLowerCase()) || id.toLowerCase() === targetId.toLowerCase()) return id;
    }

    // Try parent prefix + target (case-insensitive)
    const parentPrefix = sourceModId.includes('--') ? sourceModId.split('--')[0] : sourceModId;
    const lowerPrefix = parentPrefix.toLowerCase();
    const lowerTargetId = targetId.toLowerCase();
    for (const [id] of modules) {
      const lowerId = id.toLowerCase();
      if (lowerId === lowerPrefix + '--' + lowerTargetId) return id;
    }
  }

  // Try prefix/suffix match
  for (const [id, mod] of modules) {
    if (importStr.includes(mod.dirName)) return id;
    const importPath = importStr.replace(/^\.\.?\//, '');
    if (mod.relPath === importPath || mod.relPath.endsWith('/' + importPath) || importPath.endsWith(mod.relPath)) return id;
  }

  return null;
}


/**
 * Resolve cross-directory relative imports (starting with ../).
 *
 * Key improvements over original code:
 * 1. Uses sourceMod.relPath instead of dirname(sourceMod.files[0]) to compute the source directory,
 *    because parent modules store only basenames in their files array.
 * 2. When matching the resolved path, checks both child module files (which store absolute paths)
 *    and child module relPath values.
 */
function resolveCrossDirectoryImport(importStr, modules, sourceModId, projectPath) {
  
  const sourceMod = modules.get(sourceModId);
  if (!sourceMod) return null;

  // Compute source directory using sourceMod.relPath (more reliable than files[0])
  const sourceRelPath = sourceMod.relPath;
  if (!sourceRelPath && (!sourceMod.files || sourceMod.files.length === 0)) return null;

  let sourceDir;
  if (sourceRelPath) {
    // relPath is like "src/components" (parent) or "src/components/AccordionExpand.jsx" (child)
    const sourceDirRel = sourceRelPath.includes("/") ? sourceRelPath.substring(0, sourceRelPath.lastIndexOf("/")) : ".";
    sourceDir = projectPath ? projectPath + "/" + sourceDirRel : sourceDirRel;
  } else {
    // Fallback for older module entries that may not have relPath
    const firstFile = sourceMod.files[0];
    if (firstFile.startsWith("/")) {
      sourceDir = firstFile.substring(0, firstFile.lastIndexOf("/"));
    } else if (projectPath) {
      const d = dirname(firstFile);
      sourceDir = projectPath + "/" + (d === "." ? "" : d);
    } else {
      return null;
    }
  }

  // Resolve ../ segments manually for robustness
  const parts = importStr.split("/");
  const dirParts = sourceDir.split("/");
  for (const part of parts) {
    if (part === "..") {
      if (dirParts.length > 0) dirParts.pop();
    } else if (part !== "." && part !== "") {
      dirParts.push(part);
    }
  }
    const resolvedPath = dirParts.join("/");

  // Find matching module by comparing resolvedPath against module files (absolute paths) and relPath
  for (const [id, mod] of modules) {
    // Child modules store absolute paths in files
    if (mod.files) {
      for (const f of mod.files) {
        const dotIdx = f.lastIndexOf(".");
        const slashIdx = f.lastIndexOf("/");
        const fNoExt = dotIdx > slashIdx ? f.substring(0, dotIdx) : f;
        const rDotIdx = resolvedPath.lastIndexOf(".");
        const rSlashIdx = resolvedPath.lastIndexOf("/");
        const rNoExt = rDotIdx > rSlashIdx ? resolvedPath.substring(0, rDotIdx) : resolvedPath;
                        if (fNoExt === rNoExt) return id;
      }
    }
    // Match against mod.relPath (e.g. "src/data/tagRegistry.js")
    if (mod.relPath) {
      const rDotIdx = resolvedPath.lastIndexOf(".");
      const rSlashIdx = resolvedPath.lastIndexOf("/");
      const rNoExt = rDotIdx > rSlashIdx ? resolvedPath.substring(0, rDotIdx) : resolvedPath;
      const mDotIdx = mod.relPath.lastIndexOf(".");
      const mSlashIdx = mod.relPath.lastIndexOf("/");
      const mNoExt = mDotIdx > mSlashIdx ? mod.relPath.substring(0, mDotIdx) : mod.relPath;
      if (rNoExt.endsWith("/" + mNoExt) || rNoExt === mNoExt) return id;
    }
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
      const targetModId = resolveModuleFromImport(imp, modules, modId, projectPath);
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
      module: inferModule(`dep-${depName}`),
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
    module: inferModule('project-root'),
    label: projectName,
    layer: 'infrastructure',
    description: projectDesc || `Project: ${projectName}`,
    chineseName: pkg?.name || basename(projectPath),
    chineseDesc: projectDesc || '',
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

/**
 * Infer module name from node id.
 * Rules:
 *   - If id contains '--': use the part before the first '--'
 *   - If id contains '-' (but no '--'): use the part before the first '-'
 *   - Otherwise: use the entire id
 *   - Underscores are NOT separators
 */
function inferModule(id) {
  if (!id) return 'other';
  var idx = id.indexOf('--');
  if (idx !== -1 && idx > 0) return id.substring(0, idx);
  idx = id.indexOf('-');
  if (idx !== -1 && idx > 0) return id.substring(0, idx);
  return id;
}

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
      module: inferModule(mod.id),
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
