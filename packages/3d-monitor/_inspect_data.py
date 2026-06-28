#!/usr/bin/env python3
"""Quick inspection of test data"""
import json
with open('/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/port_tag_result.json') as f:
    data = json.load(f)
nodes = data.get('nodes', [])
edges = data.get('edges', [])
print(f'Total nodes: {len(nodes)}')
print(f'Total edges: {len(edges)}')
modules = {}
for n in nodes:
    parts = n['id'].split('--')
    mod = parts[0] if len(parts) > 1 else 'other'
    if mod not in modules:
        modules[mod] = []
    modules[mod].append(n['id'])
for m in sorted(modules.keys()):
    print(f'  Module "{m}": {len(modules[m])} nodes')
    for nid in modules[m][:5]:
        print(f'    - {nid}')
    if len(modules[m]) > 5:
        print(f'    ... and {len(modules[m])-5} more')
