/**
 * PortRegistry — 独立 MCP 端口注册表
 *
 * 纯数据逻辑，无 Three.js / React 依赖。
 * 所有函数输入 JSON 输出 JSON，无全局状态（初始化后返回实例）。
 */

/**
 * 端口类型样式表
 */
export const PORT_TYPE_STYLES = {
  default: { shape: 'circle', color: '#9E9E9E', icon: null, description: '通用端口' },
  'llm-request': { shape: 'circle', color: '#00BCD4', icon: null, description: 'LLM 推理请求' },
  'llm-response': { shape: 'circle', color: '#00BCD4', icon: null, description: 'LLM 推理响应' },
  'http-request': { shape: 'square', color: '#4CAF50', icon: null, description: 'HTTP 请求' },
  'http-response': { shape: 'square', color: '#4CAF50', icon: null, description: 'HTTP 响应' },
  'data-query': { shape: 'diamond', color: '#FF9800', icon: null, description: '数据查询' },
  'data-result': { shape: 'diamond', color: '#FF9800', icon: null, description: '数据结果' },
  'config': { shape: 'triangle', color: '#9C27B0', icon: null, description: '配置更新' },
  'control': { shape: 'circle', color: '#F44336', icon: null, description: '控制指令' },
  'event': { shape: 'circle', color: '#FFEB3B', icon: null, description: '事件通知' },
};

function inferPortType(color, direction) {
  const c = (color || '#9E9E9E').toLowerCase();
  if (c === '#00bcd4') return direction === 'out' ? 'llm-request' : 'llm-response';
  if (c === '#4caf50') return direction === 'out' ? 'data-query' : 'data-result';
  if (c === '#ff9800') return 'config';
  if (c === '#f44336') return 'control';
  if (c === '#9c27b0' || c === '#ab47bc') return 'config';
  if (c === '#ffeb3b') return 'event';
  if (c === '#e040fb') return direction === 'out' ? 'llm-request' : 'llm-response';
  if (c === '#ffd700') return 'config';
  return 'default';
}

export class PortRegistry {
  constructor() {
    this._ports = new Map();
    this._nodePorts = new Map();
    this._portConnections = new Map();
    this._childNodeIds = new Set();
    this._allNodes = null;
  }

  register(nodeId, ports) {
    if (!nodeId || !ports) return;
    const nodeEntry = this._nodePorts.get(nodeId) || { inputs: [], outputs: [] };
    ports.forEach((port) => {
      const portId = port.id;
      if (!portId) return;
      const direction = port.direction || 'in';
      const typeStyle = PORT_TYPE_STYLES[port.type] || PORT_TYPE_STYLES.default;
      const portDef = {
        id: portId,
        nodeId,
        direction,
        type: port.type || 'default',
        label: port.label || '',
        color: port.color || typeStyle.color,
        shape: typeStyle.shape,
        index: port.index !== undefined ? port.index : 0,
        position: port.position || (direction === 'out' ? 'right' : 'left'),
        globalIndex: port.globalIndex,
        position3d: port.position3d,
        portRadius: port.portRadius,
        connectionId: null,
      };
      this._ports.set(portId, portDef);
      if (direction === 'in') {
        if (!nodeEntry.inputs.includes(portId)) nodeEntry.inputs.push(portId);
      } else if (direction === 'out') {
        if (!nodeEntry.outputs.includes(portId)) nodeEntry.outputs.push(portId);
      }
    });
    this._nodePorts.set(nodeId, nodeEntry);
  }

  getPort(portId) { return this._ports.get(portId) || null; }

  getNodePorts(nodeId) {
    const entry = this._nodePorts.get(nodeId);
    if (!entry) return { inputs: [], outputs: [] };
    return {
      inputs: entry.inputs.map(id => this._ports.get(id)).filter(Boolean),
      outputs: entry.outputs.map(id => this._ports.get(id)).filter(Boolean),
    };
  }

  getPortConnection(portId) { return this._portConnections.get(portId) || null; }

  getRegisteredNodeIds() { return Array.from(this._nodePorts.keys()); }

  getStats() {
    return {
      nodes: this._nodePorts.size,
      ports: this._ports.size,
      connections: this._portConnections.size,
    };
  }

  clear() {
    this._ports.clear();
    this._nodePorts.clear();
    this._portConnections.clear();
    this._childNodeIds.clear();
  }

  /**
   * autoGenerate — 从 connections 自动推导端口
   */
  autoGenerate(connections, allNodes) {
    this._allNodes = allNodes || [];
    this.clear();

    // 收集所有子节点 ID
    if (allNodes) {
      allNodes.forEach(n => {
        if (n._isLayerChild || n.parentId) this._childNodeIds.add(n.id);
      });
    }

    const fromMap = new Map(); // nodeId -> [{ connections: [connId], index }]
    const toMap = new Map();

    connections.forEach((conn, idx) => {
      const connId = conn.id || `conn-${idx}`;
      if (conn.from) {
        if (!fromMap.has(conn.from)) fromMap.set(conn.from, { connections: [], index: 0 });
        const entry = fromMap.get(conn.from);
        entry.connections.push(connId);
      }
      if (conn.to) {
        if (!toMap.has(conn.to)) toMap.set(conn.to, { connections: [], index: 0 });
        const entry = toMap.get(conn.to);
        entry.connections.push(connId);
      }
    });

    const allNodeIds = new Set([...fromMap.keys(), ...toMap.keys()]);
    let globalIdx = 0;

    allNodeIds.forEach((nodeId) => {
      const outs = fromMap.get(nodeId);
      const ins = toMap.get(nodeId);
      const ports = [];

      // 分配 globalIndex：从节点自身的 out 到 in 顺序分配
      const nodeGlobalStart = globalIdx;
      const outCount = outs ? outs.connections.length : 0;
      const inCount = ins ? ins.connections.length : 0;
      const totalPortsOnNode = outCount + inCount;
      globalIdx += totalPortsOnNode;

      // 输出端口
      if (outs) {
        outs.connections.forEach((connId, i) => {
          const conn = connections.find(c => (c.id || `conn-${connections.indexOf(c)}`) === connId);
          const color = conn?.color || '#00BCD4';
          const label = conn?.label || '';
          const radius = this._getNodeRadius(nodeId);
          const portOffset = radius * 1.4;
          const portRadius = Math.max(0.08, radius * 0.25);
          const angle = (i / Math.max(outCount, 1)) * Math.PI * 2;
          const px = Math.cos(angle) * portOffset;
          const py = Math.sin(angle) * portOffset * 0.7;
          const pz = 0.1;
          ports.push({
            id: `port-${nodeId}-out-${i}`,
            nodeId,
            direction: 'out',
            type: inferPortType(color, 'out'),
            label,
            color,
            index: i,
            globalIndex: nodeGlobalStart + i,
            position: 'right',
            position3d: [px, py, pz],
            portRadius,
          });
          this._portConnections.set(`port-${nodeId}-out-${i}`, connId);
        });
      }

      // 输入端口
      if (ins) {
        ins.connections.forEach((connId, i) => {
          const conn = connections.find(c => (c.id || `conn-${connections.indexOf(c)}`) === connId);
          const color = conn?.color || '#4CAF50';
          const label = conn?.label || '';
          const radius = this._getNodeRadius(nodeId);
          const portOffset = radius * 1.4;
          const portRadius = Math.max(0.08, radius * 0.25);
          const angle = ((outCount + i) / Math.max(totalPortsOnNode, 1)) * Math.PI * 2;
          const px = Math.cos(angle) * portOffset;
          const py = Math.sin(angle) * portOffset * 0.7;
          const pz = -0.1;
          ports.push({
            id: `port-${nodeId}-in-${i}`,
            nodeId,
            direction: 'in',
            type: inferPortType(color, 'in'),
            label,
            color,
            index: i,
            globalIndex: nodeGlobalStart + outCount + i,
            position: 'left',
            position3d: [px, py, pz],
            portRadius,
          });
          this._portConnections.set(`port-${nodeId}-in-${i}`, connId);
        });
      }

      this.register(nodeId, ports);
    });
  }

  _getNodeRadius(nodeId) {
    if (!this._allNodes) return 0.8;
    const node = this._allNodes.find(n => n.id === nodeId);
    if (!node) return 0.8;
    const r = node.radius || (node.geometryType === 'box' ? 0.6 : 0.8);
    return this._childNodeIds.has(nodeId) ? r * 0.6 : r;
  }

  /**
   * verify — 验证端口定义与 connections 是否一致
   */
  verify(connections) {
    const errors = [];
    this._ports.forEach((port) => {
      const expectedPosition = port.direction === 'out' ? 'right' : 'left';
      if (port.position !== expectedPosition) {
        errors.push(`[PORT-POSITION] 端口 ${port.id} (${port.nodeId}/${port.direction}) 位置为 ${port.position}，应为 ${expectedPosition}`);
      }
    });

    if (connections && connections.length > 0) {
      const connectionCounts = new Map();
      connections.forEach((conn) => {
        if (!conn.from || !conn.to) return;
        if (!connectionCounts.has(conn.from)) connectionCounts.set(conn.from, { outputs: 0, inputs: 0 });
        connectionCounts.get(conn.from).outputs++;
        if (!connectionCounts.has(conn.to)) connectionCounts.set(conn.to, { outputs: 0, inputs: 0 });
        connectionCounts.get(conn.to).inputs++;
      });

      this._nodePorts.forEach((nodePorts, nodeId) => {
        const expected = connectionCounts.get(nodeId);
        if (!expected) return;
        if (nodePorts.outputs.length !== expected.outputs) {
          errors.push(`[PORT-COUNT] 节点 ${nodeId}: 输出端口数 ${nodePorts.outputs.length}，期望 ${expected.outputs}`);
        }
        if (nodePorts.inputs.length !== expected.inputs) {
          errors.push(`[PORT-COUNT] 节点 ${nodeId}: 输入端口数 ${nodePorts.inputs.length}，期望 ${expected.inputs}`);
        }
      });
    }

    return { passed: errors.length === 0, errors };
  }
}

/**
 * 全局端口扫描（无状态工厂函数）
 */
export function scanPorts(connections, allNodes) {
  const registry = new PortRegistry();
  registry.autoGenerate(connections, allNodes);
  return {
    stats: registry.getStats(),
    ports: Array.from(registry._ports.values()),
    nodePorts: Object.fromEntries(
      Array.from(registry._nodePorts.entries()).map(([nodeId, entry]) => [
        nodeId,
        {
          inputs: entry.inputs.map(id => registry._ports.get(id)).filter(Boolean),
          outputs: entry.outputs.map(id => registry._ports.get(id)).filter(Boolean),
        },
      ])
    ),
  };
}

export default PortRegistry;
