#!/usr/bin/env python3
"""Generate standalone test HTML for viewer v0.1.40-node-spread.19"""
import json, os

BASE = '/Users/zhencheng/projects/arch-scanner/packages/3d-monitor'

# 1. Read viewer.html
with open(os.path.join(BASE, 'viewer.html'), 'r') as f:
    viewer_html = f.read()

# 2. Read test data
data_path = os.path.join(BASE, 'port_tag_result.json')
if not os.path.exists(data_path):
    print(f'ERROR: Test data not found at {data_path}')
    exit(1)
with open(data_path, 'r') as f:
    data = json.load(f)

# 3. Build the embedded data script
data_json = json.dumps(data, ensure_ascii=False)
data_script = '<script>window.__EMBEDDED_DATA__ = ' + data_json + ';</script>\n'

# 4. Insert after <body> tag
if '<body>' in viewer_html:
    idx = viewer_html.find('<body>') + len('<body>')
    if idx < len(viewer_html) and viewer_html[idx] == '\n':
        idx += 1
    viewer_html = viewer_html[:idx] + '\n' + data_script + viewer_html[idx:]

# 5. Write output
outpath = os.path.join(BASE, 'test-v019.html')
with open(outpath, 'w') as f:
    f.write(viewer_html)
print(f'Written: {outpath} ({len(viewer_html)} bytes)')
