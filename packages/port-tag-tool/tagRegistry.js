/**
 * tagRegistry.js — 独立 MCP 标签注册表
 *
 * 纯数据逻辑，无 React / Three.js 依赖。
 * 所有函数输入 JSON 输出 JSON。
 */

// =============================================================================
// TAG_EDGE_MAP — 节点间连接的默认标签映射
// =============================================================================
export const TAG_EDGE_MAP = {
  zhaogongming: {
    strategy: 'tag-zhao-strategy-command',
    research: 'tag-dispatcher-research-command',
    system: 'tag-zhao-system-command',
    operations: 'tag-zhao-operations-command',
  },
  strategy: {
    zhaogongming: 'tag-strategy-zhao-report',
  },
  research: {
    'analyst-a': 'tag-agent-analyst-findings',
    'analyst-b': 'tag-agent-analyst-findings',
    knowledge: 'tag-data-query',
  },
  'analyst-a': {
    'team-lead': 'tag-analyst-lead-report',
  },
  'analyst-b': {
    'team-lead': 'tag-analyst-lead-report',
  },
  'team-lead': {
    'risk-controller': 'tag-lead-risk-decision',
  },
  'risk-controller': {
    zhaogongming: 'tag-risk-zhao-result',
  },
  system: {
    zhaogongming: 'tag-system-zhao-report',
    duckdb: 'tag-data-query',
    obsidian: 'tag-knowledge-sync',
    'api-server': 'tag-config-update',
    cache: 'tag-config-update',
    'message-queue': 'tag-config-update',
    gateway: 'tag-config-update',
    'km-tracking': 'tag-data-query',
    plur: 'tag-knowledge-sync',
  },
  operations: {
    zhaogongming: 'tag-ops-zhao-report',
    gateway: 'tag-external-webhook',
    'message-queue': 'tag-system-broadcast',
    'api-server': 'tag-system-broadcast',
  },
  'message-queue': {
    'api-server': 'tag-event-message',
    gateway: 'tag-event-message',
  },
  gateway: {
    'api-server': 'tag-external-request',
    'message-queue': 'tag-external-request',
  },
  'api-server': {
    duckdb: 'tag-data-query',
    'km-tracking': 'tag-data-query',
    cache: 'tag-cache-request',
    'message-queue': 'tag-event-publish',
  },
  knowledge: {
    'analyst-a': 'tag-knowledge-result',
    'analyst-b': 'tag-knowledge-result',
  },
  duckdb: {
    'api-server': 'tag-data-result',
    knowledge: 'tag-data-result',
    system: 'tag-data-result',
  },
  obsidian: {
    knowledge: 'tag-knowledge-result',
    'km-tracking': 'tag-knowledge-result',
  },
  plur: {
    knowledge: 'tag-knowledge-result',
  },
};

// =============================================================================
// ROLE_TAG_MAP — 按角色模式匹配的标签规则
// =============================================================================
export const ROLE_TAG_MAP = [
  { pattern: /^(research|analyst|team-lead|risk-controller)/, direction: 'both', tagId: 'tag-agent-analyst-findings' },
  { pattern: /^(duckdb|km-tracking|obsidian|plur)/, direction: 'in', tagId: 'tag-data-query' },
  { pattern: /^(duckdb|km-tracking|obsidian|plur)/, direction: 'out', tagId: 'tag-data-result' },
  { pattern: /^(gateway|message-queue|api-server)/, direction: 'both', tagId: 'tag-external-request' },
  { pattern: /^(zhaogongming|strategy|system|operations)/, direction: 'out', tagId: 'tag-external-agent-command' },
  { pattern: /^(zhaogongming|strategy|system|operations)/, direction: 'in', tagId: 'tag-report-submit' },
];

// =============================================================================
// TAG_DEFINITIONS — 核心标签定义
// =============================================================================
export const TAG_DEFINITIONS = {
  'tag-external-agent-command': {
    id: 'tag-external-agent-command', label: '战略指令下发', shortLabel: '指令',
    description: '赵公明通过外部API向各模块下发高层战略指令',
    flowType: 'control', format: 'JSON/REST',
    context: '泡茶：水管→水桶（水源到暂存）',
    transform: '自然语言(主公)→结构化JSON指令(API)→调度任务(Dispatcher)',
    example: { from: 'zhaogongming', to: 'strategy', command: 'deep_analysis', target: '002415', priority: 'high', params: { industry: 'consumer-electronics' } },
    color: '#FFEB3B',
    transportContent: '高层战略指令 JSON: { command, target, priority, params }',
    sourceLabel: '发送: 战略指令(JSON/REST)', targetLabel: '接收: 战略指令(JSON/REST)',
  },
  'tag-dispatcher-research-command': {
    id: 'tag-dispatcher-research-command', label: '调研指令', shortLabel: '调研',
    description: '调度器向调研员发起调研任务',
    flowType: 'control', format: 'JSON/REST',
    context: '泡茶：水桶→烧水壶',
    transform: '任务调度(Dispatcher)→具体调研指令(JSON/REST)→调研员',
    example: { from: 'zhaogongming', to: 'research', task: 'industry_analysis', team: 'consumer-electronics', depth: 'deep', deadline: '2024-06-15' },
    color: '#FFEB3B',
    transportContent: '调研任务 JSON: { task, team, depth, deadline }',
    sourceLabel: '发送: 调研指令(JSON/REST)', targetLabel: '接收: 调研指令(JSON/REST)',
  },
  'tag-agent-analyst-findings': {
    id: 'tag-agent-analyst-findings', label: '调研发现', shortLabel: '发现',
    description: '调研员向分析师传递初步调研结果',
    flowType: 'data', format: 'Markdown/Report',
    context: '泡茶：烧水壶→茶海',
    transform: '原始调研数据→结构化Markdown发现→分析师',
    example: { from: 'research', to: 'analyst-a', source: 'annual_report', findings: ['market_share_35%', 'revenue_growth_12%'], confidence: 0.85, evidence: ['report_pg42', 'filing_8k'] },
    color: '#00BCD4',
    transportContent: 'Markdown 结构报告: { source, findings[], confidence, evidence[] }',
    sourceLabel: '发送: 调研发现(Markdown)', targetLabel: '接收: 调研发现(Markdown)',
  },
  'tag-analyst-lead-report': {
    id: 'tag-analyst-lead-report', label: '分析报告', shortLabel: '报告',
    description: '分析师向队长提交完整分析报告',
    flowType: 'data', format: 'Markdown/Report',
    context: '泡茶：茶海→茶杯',
    transform: '结构化发现(分析师)→深度分析报告→队长',
    example: { from: 'analyst-a', to: 'team-lead', ticker: '002415', fair_value: 32.5, rating: 'BUY', risk_level: 'medium', reasoning: 'Strong_moat_and_growth' },
    color: '#00BCD4',
    transportContent: '完整分析报告 Markdown: { ticker, fair_value, rating, risk_level, reasoning }',
    sourceLabel: '发送: 分析报告(Markdown)', targetLabel: '接收: 分析报告(Markdown)',
  },
  'tag-lead-risk-decision': {
    id: 'tag-lead-risk-decision', label: '决策指令', shortLabel: '决策',
    description: '队长向风控员发送最终决策需要风控审核',
    flowType: 'control', format: 'JSON/REST',
    context: '泡茶：茶杯→人',
    transform: '分析报告(队长)→可执行决策→风控员',
    example: { from: 'team-lead', to: 'risk-controller', action: 'BUY', ticker: '002415', quantity: 1000, price_limit: 33.0, strategy: 'limit_order' },
    color: '#FFEB3B',
    transportContent: '决策指令 JSON: { action, ticker, quantity, price_limit, strategy }',
    sourceLabel: '发送: 决策指令(JSON/REST)', targetLabel: '接收: 决策指令(JSON/REST)',
  },
  'tag-risk-zhao-result': {
    id: 'tag-risk-zhao-result', label: '风控结果', shortLabel: '结果',
    description: '风控员向赵公明返回审核结果',
    flowType: 'control', format: 'JSON/REST',
    transform: '风控审核(风控员)→审核结果(JSON)→赵公明',
    example: { from: 'risk-controller', to: 'zhaogongming', task_id: 't_xxxxx', status: 'approved', risk_score: 2.5, notes: 'Within_risk_tolerance' },
    color: '#FFEB3B',
    transportContent: '审核结果 JSON: { task_id, status, risk_score, notes }',
    sourceLabel: '发送: 审核结果(JSON/REST)', targetLabel: '接收: 审核结果(JSON/REST)',
  },
  'tag-system-broadcast': {
    id: 'tag-system-broadcast', label: '系统广播', shortLabel: '广播',
    description: '系统级事件广播，通知各模块状态变更',
    flowType: 'event', format: 'JSON/PubSub',
    context: '泡茶：水沸信号',
    transform: '系统状态事件→JSON广播(PubSub)→所有订阅模块',
    example: { event: 'system_ready', timestamp: '2024-01-01T00:00:00Z', modules: ['duckdb', 'ccswitch', 'api-server'] },
    color: '#E040FB',
    transportContent: '系统事件广播 JSON/PubSub: { event, timestamp, modules[] }',
    sourceLabel: '发送: 系统事件(PubSub)', targetLabel: '接收: 系统事件(PubSub)',
  },
  'tag-data-query': {
    id: 'tag-data-query', label: '数据查询', shortLabel: '查询',
    description: '向数据仓库发起结构化查询',
    flowType: 'data', format: 'SQL/JSON',
    context: '泡茶：取茶叶',
    transform: '查询需求(模块)→SQL语句(DuckDB)→数据仓库',
    example: { from: 'research', query: 'SELECT * FROM signals WHERE date > now() - 7d', limit: 100 },
    color: '#00BCD4',
    transportContent: 'SQL 查询: { query, limit }',
    sourceLabel: '发送: 数据查询(SQL/JSON)', targetLabel: '接收: 数据查询(SQL/JSON)',
  },
  'tag-data-result': {
    id: 'tag-data-result', label: '数据查询结果', shortLabel: '结果',
    description: 'DuckDB 数据仓库返回查询结果集',
    flowType: 'data', format: 'JSON/CSV',
    context: '泡茶：茶叶入壶',
    transform: 'SQL 查询→JSON 结果行→请求模块',
    example: { rows: 42, columns: ['ticker', 'value', 'date'], data: [{ ticker: '002415', value: 32.5, date: '2024-06-01' }] },
    color: '#00BCD4',
    transportContent: '查询结果 JSON/CSV: { rows, columns[], data[] }',
    sourceLabel: '发送: 查询结果(JSON/CSV)', targetLabel: '接收: 查询结果(JSON/CSV)',
  },
  'tag-external-webhook': {
    id: 'tag-external-webhook', label: '外部 Webhook 事件', shortLabel: '事件',
    description: '外部系统通过 Webhook 触发平台内部事件',
    flowType: 'event', format: 'JSON/Webhook',
    transform: 'HTTP POST 请求→JSON 内部事件→路由分发',
    example: { source: 'github', action: 'push', repo: 'hermes', ref: 'refs/heads/main', commits: [{ id: 'abc123', message: 'fix: bug' }] },
    color: '#E040FB',
    transportContent: 'Webhook 事件 JSON: { source, action, repo, ref, commits[] }',
    sourceLabel: '发送: Webhook 事件(JSON/HTTP)', targetLabel: '接收: Webhook 事件(JSON/HTTP)',
  },
  'tag-zhao-strategy-command': {
    id: 'tag-zhao-strategy-command', label: '战略指令下发', shortLabel: '战略',
    description: '赵公明向战略部下发高层战略分析指令',
    flowType: 'control', format: 'JSON/REST',
    transform: '自然语言(主公)→结构化JSON指令(API)→战略任务(Strategy)',
    example: { from: 'zhaogongming', to: 'strategy', command: 'industry_scan', target_industry: 'consumer-electronics', priority: 'high', deadline: '7d' },
    color: '#FFEB3B',
    transportContent: '战略指令 JSON: { command, target_industry, priority, deadline }',
    sourceLabel: '发送: 战略指令(JSON/REST)', targetLabel: '接收: 战略指令(JSON/REST)',
  },
  'tag-zhao-system-command': {
    id: 'tag-zhao-system-command', label: '系统开发指令', shortLabel: '开发',
    description: '赵公明向系统部下发系统开发/维护指令',
    flowType: 'control', format: 'JSON/REST',
    transform: '自然语言(主公)→结构化JSON指令(API)→开发任务(System)',
    example: { from: 'zhaogongming', to: 'system', command: 'deploy_service', service: 'api-server', version: 'v2.1.0', env: 'production' },
    color: '#FFEB3B',
    transportContent: '开发指令 JSON: { command, service, version, env }',
    sourceLabel: '发送: 开发指令(JSON/REST)', targetLabel: '接收: 开发指令(JSON/REST)',
  },
  'tag-zhao-operations-command': {
    id: 'tag-zhao-operations-command', label: '运营指令', shortLabel: '运营',
    description: '赵公明向运营部下发育维/监控指令',
    flowType: 'control', format: 'JSON/REST',
    transform: '自然语言(主公)→结构化JSON指令(API)→运营任务(Operations)',
    example: { from: 'zhaogongming', to: 'operations', command: 'health_check', target: 'gateway', interval: '5m' },
    color: '#FFEB3B',
    transportContent: '运营指令 JSON: { command, target, interval }',
    sourceLabel: '发送: 运营指令(JSON/REST)', targetLabel: '接收: 运营指令(JSON/REST)',
  },
  'tag-strategy-zhao-report': {
    id: 'tag-strategy-zhao-report', label: '战略分析报告', shortLabel: '战略报告',
    description: '战略部向赵公明提交战略分析结果',
    flowType: 'data', format: 'Markdown/Report',
    transform: '原始市场数据→战略分析(Markdown)→赵公明',
    example: { from: 'strategy', to: 'zhaogongming', report_type: 'industry_landscape', summary: 'AI_healthcare_growing_30%_YoY', confidence: 0.9 },
    color: '#00BCD4',
    transportContent: '战略分析报告 Markdown: { report_type, summary, confidence }',
    sourceLabel: '发送: 战略分析(Markdown)', targetLabel: '接收: 战略分析(Markdown)',
  },
  'tag-system-zhao-report': {
    id: 'tag-system-zhao-report', label: '系统状态报告', shortLabel: '状态',
    description: '系统部向赵公明报告系统运行状态',
    flowType: 'data', format: 'Markdown/Report',
    transform: '系统监控数据→状态报告(Markdown)→赵公明',
    example: { from: 'system', to: 'zhaogongming', services: ['api-server', 'gateway', 'duckdb'], all_green: true, incidents: [] },
    color: '#00BCD4',
    transportContent: '系统状态报告 Markdown: { services[], all_green, incidents[] }',
    sourceLabel: '发送: 系统状态(Markdown)', targetLabel: '接收: 系统状态(Markdown)',
  },
  'tag-ops-zhao-report': {
    id: 'tag-ops-zhao-report', label: '运营报告', shortLabel: '运营报告',
    description: '运营部向赵公明汇报运营数据',
    flowType: 'data', format: 'Markdown/Report',
    transform: '运营监控数据→运营报告(Markdown)→赵公明',
    example: { from: 'operations', to: 'zhaogongming', api_requests: 15234, avg_latency: 342, error_rate: 0.02 },
    color: '#00BCD4',
    transportContent: '运营报告 Markdown: { api_requests, avg_latency, error_rate }',
    sourceLabel: '发送: 运营报告(Markdown)', targetLabel: '接收: 运营报告(Markdown)',
  },
  'tag-knowledge-sync': {
    id: 'tag-knowledge-sync', label: '知识同步', shortLabel: '同步',
    description: '系统部向知识库同步配置/文档更新',
    flowType: 'data', format: 'Markdown/JSON',
    transform: '配置变化→同步文档(Markdown/JSON)→知识库',
    example: { from: 'system', to: 'obsidian', action: 'sync', path: 'docs/infrastructure/', files: ['api-server.md', 'gateway.md'] },
    color: '#7B1FA2',
    transportContent: '知识同步文档 Markdown/JSON: { action, path, files[] }',
    sourceLabel: '发送: 知识同步(Markdown/JSON)', targetLabel: '接收: 知识同步(Markdown/JSON)',
  },
  'tag-knowledge-result': {
    id: 'tag-knowledge-result', label: '知识查询结果', shortLabel: '知识',
    description: '知识库返回查询结果',
    flowType: 'data', format: 'Markdown/JSON',
    transform: '查询→知识库检索→结果文档',
    color: '#7B1FA2',
    transportContent: '知识检索结果 Markdown/JSON',
    sourceLabel: '发送: 知识结果(Markdown/JSON)', targetLabel: '接收: 知识结果(Markdown/JSON)',
  },
  'tag-external-request': {
    id: 'tag-external-request', label: '外部请求路由', shortLabel: '路由',
    description: '网关/消息队列向API服务转发外部请求',
    flowType: 'control', format: 'JSON/HTTP',
    transform: '外部请求→网关路由→内部API服务',
    color: '#4CAF50',
    transportContent: '外部请求 JSON/HTTP: { method, path, headers, body }',
    sourceLabel: '发送: 外部请求(JSON/HTTP)', targetLabel: '接收: 外部请求(JSON/HTTP)',
  },
  'tag-config-update': {
    id: 'tag-config-update', label: '配置更新', shortLabel: '配置',
    description: '系统部向各服务下发配置更新',
    flowType: 'config', format: 'JSON',
    transform: '配置变更→下发JSON配置→服务实例',
    color: '#9C27B0',
    transportContent: '配置更新 JSON: { service, key, value }',
    sourceLabel: '发送: 配置更新(JSON)', targetLabel: '接收: 配置更新(JSON)',
  },
  'tag-cache-request': {
    id: 'tag-cache-request', label: '缓存请求', shortLabel: '缓存',
    description: 'API服务向Redis发起缓存读写',
    flowType: 'data', format: 'Redis Protocol',
    transform: '业务请求→Redis命令→缓存数据',
    color: '#26C6DA',
    transportContent: 'Redis 命令: { command, key, value?, ttl? }',
    sourceLabel: '发送: 缓存请求(Redis)', targetLabel: '接收: 缓存请求(Redis)',
  },
  'tag-event-message': {
    id: 'tag-event-message', label: '事件消息', shortLabel: '消息',
    description: '服务间通过消息队列传递异步事件',
    flowType: 'event', format: 'JSON/AMQP',
    transform: '服务事件→AMQP消息→订阅服务',
    color: '#E040FB',
    transportContent: '事件消息 JSON/AMQP: { event, payload, timestamp }',
    sourceLabel: '发送: 事件消息(AMQP)', targetLabel: '接收: 事件消息(AMQP)',
  },
  'tag-event-publish': {
    id: 'tag-event-publish', label: '事件发布', shortLabel: '发布',
    description: 'API服务向消息队列发布业务事件',
    flowType: 'event', format: 'JSON/AMQP',
    transform: '业务事件→AMQP发布→消息队列路由',
    color: '#E040FB',
    transportContent: '业务事件 JSON/AMQP: { event_type, payload, timestamp }',
    sourceLabel: '发送: 事件发布(AMQP)', targetLabel: '接收: 事件发布(AMQP)',
  },
  'tag-report-submit': {
    id: 'tag-report-submit', label: '报告提交', shortLabel: '报告',
    description: '各部门向赵公明提交工作报告',
    flowType: 'data', format: 'Markdown/Report',
    transform: '部门工作成果→Markdown报告→赵公明',
    color: '#00BCD4',
    transportContent: '工作报告 Markdown',
    sourceLabel: '发送: 工作报告(Markdown)', targetLabel: '接收: 工作报告(Markdown)',
  },
};

// =============================================================================
// TagRegistry 类
// =============================================================================
export class TagRegistry {
  constructor(definitions) {
    this._defs = new Map();
    if (definitions) this.init(definitions);
  }

  init(definitions) {
    this._defs.clear();
    Object.values(definitions).forEach(def => this._defs.set(def.id, { ...def }));
  }

  getTag(tagId) { return this._defs.get(tagId) || null; }

  getAllTags() { return Array.from(this._defs.values()); }

  getTagsByFlowType(flowType) {
    return this.getAllTags().filter(t => t.flowType === flowType);
  }

  getTagsByNodePair(fromId, toId) {
    // 精确匹配
    if (TAG_EDGE_MAP[fromId] && TAG_EDGE_MAP[fromId][toId]) {
      const t = this.getTag(TAG_EDGE_MAP[fromId][toId]);
      if (t) return [t];
    }
    // 反向匹配
    if (TAG_EDGE_MAP[toId] && TAG_EDGE_MAP[toId][fromId]) {
      const t = this.getTag(TAG_EDGE_MAP[toId][fromId]);
      if (t) return [t];
    }
    // 前缀匹配
    const fromBase = (fromId || '').split('-')[0];
    const toBase = (toId || '').split('-')[0];
    if (fromBase !== fromId || toBase !== toId) {
      if (TAG_EDGE_MAP[fromBase] && TAG_EDGE_MAP[fromBase][toBase]) {
        const t = this.getTag(TAG_EDGE_MAP[fromBase][toBase]);
        if (t) return [t];
      }
    }
    // 角色匹配
    for (const rule of ROLE_TAG_MAP) {
      if ((rule.direction === 'both' || rule.direction === 'out') && rule.pattern.test(fromBase)) {
        const t = this.getTag(rule.tagId);
        if (t) return [t];
      }
    }
    return [];
  }

  /**
   * autoSuggestTag — 自动推导 connection 的标签
   */
  autoSuggestTag(fromNodeId, toNodeId, connLabel = '', flowType = '') {
    if (TAG_EDGE_MAP[fromNodeId] && TAG_EDGE_MAP[fromNodeId][toNodeId]) {
      return TAG_EDGE_MAP[fromNodeId][toNodeId];
    }
    if (TAG_EDGE_MAP[toNodeId] && TAG_EDGE_MAP[toNodeId][fromNodeId]) {
      return TAG_EDGE_MAP[toNodeId][fromNodeId];
    }
    for (const [src, targets] of Object.entries(TAG_EDGE_MAP)) {
      if (src === toNodeId && targets[fromNodeId]) return targets[fromNodeId];
    }
    const fromBase = (fromNodeId || '').split('-')[0];
    const toBase = (toNodeId || '').split('-')[0];
    if (fromBase !== fromNodeId || toBase !== toNodeId) {
      if (TAG_EDGE_MAP[fromBase] && TAG_EDGE_MAP[fromBase][toBase]) {
        return TAG_EDGE_MAP[fromBase][toBase];
      }
    }
    for (const rule of ROLE_TAG_MAP) {
      if ((rule.direction === 'both' || rule.direction === 'out') && rule.pattern.test(fromBase)) {
        return rule.tagId;
      }
      if ((rule.direction === 'both' || rule.direction === 'in') && rule.pattern.test(toBase)) {
        return rule.tagId;
      }
    }
    if (flowType) {
      const flowTags = this.getTagsByFlowType(flowType);
      if (flowTags.length > 0) return flowTags[0].id;
    }
    return null;
  }

  /**
   * buildPortLabels — 为 3D 全景生成端口标签
   */
  buildPortLabels(connections) {
    const portLabels = [];
    if (!connections) return portLabels;

    connections.forEach((conn, idx) => {
      const tagId = conn.tagId || this.autoSuggestTag(conn.from, conn.to, conn.label, conn.flowType) || 'unknown';
      const tagDef = this.getTag(tagId) || {};
      portLabels.push({
        connectionId: conn.id || `conn-${idx}`,
        from: conn.from,
        to: conn.to,
        tagId,
        label: tagDef.label || conn.label || '',
        shortLabel: tagDef.shortLabel || '',
        flowType: tagDef.flowType || conn.flowType || 'data',
        color: tagDef.color || '#9E9E9E',
        transportContent: tagDef.transportContent || '',
        sourceLabel: tagDef.sourceLabel || '',
        targetLabel: tagDef.targetLabel || '',
        transform: tagDef.transform || '',
        description: tagDef.description || '',
      });
    });

    return portLabels;
  }

  /**
   * buildTagIndex — 构建标签索引表
   */
  buildTagIndex(connections) {
    const tagGroups = new Map();

    (connections || []).forEach((conn, idx) => {
      if (!conn) return;
      const tagId = conn.tagId || this.autoSuggestTag(conn.from, conn.to, conn.label, conn.flowType) || 'unknown';
      if (!tagGroups.has(tagId)) {
        const tagDef = this.getTag(tagId) || {};
        tagGroups.set(tagId, {
          tagId,
          label: tagDef.label || conn.label || '',
          flowType: tagDef.flowType || conn.flowType || 'data',
          color: tagDef.color || '#9E9E9E',
          fromNodes: [],
          toNodes: [],
          transportContent: tagDef.transportContent || '',
          format: tagDef.transform || '',
        });
      }
      const entry = tagGroups.get(tagId);
      if (!entry.fromNodes.includes(conn.from)) entry.fromNodes.push(conn.from);
      if (!entry.toNodes.includes(conn.to)) entry.toNodes.push(conn.to);
    });

    return Object.fromEntries(tagGroups);
  }

  /**
   * detectConflicts — 检测标签冲突
   */
  detectConflicts(connections) {
    const conflicts = [];
    if (!connections || !connections.length) return conflicts;

    connections.forEach((conn) => {
      if (!conn) return;
      const tagId = conn.tagId;
      const suggestedTagId = this.autoSuggestTag(conn.from, conn.to, conn.label, conn.flowType);
      if (tagId && suggestedTagId && tagId !== suggestedTagId) {
        conflicts.push({
          type: 'tag_override',
          message: `Connection ${conn.id || conn.from + '→' + conn.to}: explicit tag "${tagId}" overrides auto-suggest "${suggestedTagId}"`,
          severity: 'info',
        });
      }
      if (tagId && !this.getTag(tagId)) {
        conflicts.push({
          type: 'undefined_tag',
          message: `Connection ${conn.id || conn.from + '→' + conn.to}: tag "${tagId}" is not defined in TAG_DEFINITIONS`,
          severity: 'warning',
        });
      }
    });

    return conflicts;
  }

  /**
   * summarize — 生成可读摘要（给用户看的）
   */
  summarize(connections) {
    const portLabels = this.buildPortLabels(connections);
    const tagIndex = this.buildTagIndex(connections);
    const conflicts = this.detectConflicts(connections);

    const flowTypeSummary = {};
    portLabels.forEach(pl => {
      const ft = pl.flowType || 'unknown';
      if (!flowTypeSummary[ft]) flowTypeSummary[ft] = [];
      flowTypeSummary[ft].push(pl.label || pl.tagId);
    });

    return {
      totalConnections: portLabels.length,
      totalTagTypes: Object.keys(tagIndex).length,
      flowTypeSummary: Object.fromEntries(
        Object.entries(flowTypeSummary).map(([k, v]) => [k, [...new Set(v)]])
      ),
      tagIndex,
      conflicts,
      portLabels,
    };
  }
}

// 工厂函数
export function createTagRegistry(definitions) {
  return new TagRegistry(definitions || TAG_DEFINITIONS);
}

export default TagRegistry;
