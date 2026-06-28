#!/usr/bin/env python3
"""Inspect data quality section and module info"""
import json
with open('/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/port_tag_result.json') as f:
    data = json.load(f)
print('quality:', json.dumps(data.get('quality', {}), indent=2))
print()
# check node position data
positions = {}
for n in data.get('nodes', []):
    pos = n.get('position', {})
    if pos:
        positions[n['id']] = pos
print(f'Nodes with position data: {len(positions)}/{len(data.get("nodes", []))}')
# print a few positions
for nid in list(positions.keys())[:5]:
    print(f'  {nid}: {positions[nid]}')

# check connections (edges)
print(f'\nConnections sample:')
conns = data.get('connections', [])
for c in conns[:5]:
    print(f'  {c["from"]} -> {c["to"]} ({c.get("flowType", "?")})')
