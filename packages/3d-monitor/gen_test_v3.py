#!/usr/bin/env python3
"""Generate standalone test HTML for viewer v0.1.50"""
import json, os

base = '/Users/zhencheng/projects/arch-scanner/packages/3d-monitor'

with open(os.path.join(base, 'port_tag_result.json')) as f:
    d = json.load(f)

viewer_html = open(os.path.join(base, 'viewer.html'), 'r').read()

# Insert __EMBEDDED_DATA__ script right after <body> tag
data_script = '\n<script>window.__EMBEDDED_DATA__ = ' + json.dumps(d) + ';</script>\n'
viewer_html = viewer_html.replace('<body>\n', '<body>' + data_script, 1)
if '<body>' in viewer_html and data_script not in viewer_html:
    # fallback: insert right after <body>
    viewer_html = viewer_html.replace('<body>', '<body>' + data_script, 1)

outpath = os.path.join(base, 'test_v3_fix.html')
with open(outpath, 'w') as f:
    f.write(viewer_html)
print(f"Written: {outpath}")
