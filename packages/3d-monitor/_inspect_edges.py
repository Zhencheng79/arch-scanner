#!/usr/bin/env python3
"""Inspect edges in test data"""
import json
with open('/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/port_tag_result.json') as f:
    data = json.load(f)
print('Top-level keys:', list(data.keys()))
for k, v in data.items():
    print(f'  {k}: type={type(v).__name__}', end='')
    if isinstance(v, list):
        print(f' len={len(v)}')
        if k == 'edges' and len(v) > 0:
            print(f'  First edge: {v[0]}')
        elif k == 'edges' and len(v) == 0:
            print(f'  (empty list)')
        elif len(v) > 0:
            print(f'  First item keys: {list(v[0].keys()) if isinstance(v[0], dict) else type(v[0]).__name__}')
    elif isinstance(v, dict):
        print(f' keys={list(v.keys())[:5]}')
    else:
        print()
