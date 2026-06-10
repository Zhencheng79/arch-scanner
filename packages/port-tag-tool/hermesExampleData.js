/**
 * hermesExampleData.js — 极简 Demo 数据
 *
 * 仅包含 3 个示例节点，供 port-tag-tool 自检/展示用。
 * 完整数据由传感器模式扫描真实项目生成。
 */

export const exampleNodes = [
  { id: 'demo-alpha', layer: 'demo', position: [-3.0, 1.0, 0.0], color: '#4A90D9', geometryType: 'box', label: 'Demo Alpha', description: '示例节点 Alpha', status: 'Active' },
  { id: 'demo-beta', layer: 'demo', position: [3.0, 1.0, 0.0], color: '#FF7043', geometryType: 'box', label: 'Demo Beta', description: '示例节点 Beta', status: 'Active' },
  { id: 'demo-gamma', layer: 'demo', position: [0.0, -1.5, 0.0], color: '#4CAF50', geometryType: 'sphere', label: 'Demo Gamma', description: '示例节点 Gamma', status: 'Active' },
];

export const exampleConnections = [];

export const exampleLayers = [
  { id: 'demo', name: 'Demo Layer', description: '示例层，仅用于自检' },
];
