#!/usr/bin/env python3
"""Apply v0.1.40-node-spread.20 patches to viewer.html"""
import os

BASE = '/Users/zhencheng/projects/arch-scanner/packages/3d-monitor'
PATH = os.path.join(BASE, 'viewer.html')

with open(PATH, 'r') as f:
    content = f.read()

# ─── Task 1A: Fix Clipping — Connection lines ───
# 1. getNodeBox margin: 0.5 → 0.8
content = content.replace(
    'var margin = 0.5; // v0.1.45-spread-fix: increased margin to prevent pipe penetration',
    'var margin = 0.8; // v0.1.40-node-spread.20: increased margin for better obstacle detection'
)
# 2. linePenetratesBox steps: 24 → 36
content = content.replace(
    'linePenetratesBox(fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z, box, 24)',
    'linePenetratesBox(fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z, box, 36)'
)
# 3. pushDist: 2.8 + centerFactor * 1.5 → 3.5 + centerFactor * 2.0
content = content.replace(
    'var pushDist = 2.8 + centerFactor * 1.5; // v0.1.45: moderate lateral push',
    'var pushDist = 3.5 + centerFactor * 2.0; // v0.1.40-node-spread.20: stronger lateral push to avoid boxes'
)
# 4. minDist: NODE_RADIUS * 2.2 → NODE_RADIUS * 2.8
content = content.replace(
    'var minDist = NODE_RADIUS * 2.2;',
    'var minDist = NODE_RADIUS * 2.8;'
)

# ─── Task 1B: Fix Platform Y Position — add minY tracking ───
content = content.replace(
    'var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;',
    'var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;'
)
content = content.replace(
    'if (p.z > maxZ) maxZ = p.z;\n        ySum += p.y; count++;',
    'if (p.z > maxZ) maxZ = p.z;\n        if (p.y < minY) minY = p.y;\n        ySum += p.y; count++;'
)
content = content.replace(
    '        avgY: ySum / count,',
    '        avgY: ySum / count,\n        minY: minY,'
)
content = content.replace(
    'var cY = info.avgY - 1.8;',
    'var cY = info.minY - 1.8; // v0.1.40-node-spread.20: use minY to prevent node overlap'
)

# ─── Task 1C: Fix Platform Z Overlap ───
z_overlap_fix_code = '''
  // ─── v0.1.40-node-spread.20: Fix Z-overlap between module platforms ──
  (function fixModulePlatformZOverlap() {
    var modIds = Object.keys(window._moduleLayoutInfo);
    for (var i = 0; i < modIds.length; i++) {
      for (var j = i + 1; j < modIds.length; j++) {
        var a = window._moduleLayoutInfo[modIds[i]];
        var b = window._moduleLayoutInfo[modIds[j]];
        if (!a || !b || a.nodeCount < 1 || b.nodeCount < 1) continue;
        var aZmin = a.minZ - 2.5;
        var aZmax = a.maxZ + 2.5;
        var bZmin = b.minZ - 2.5;
        var bZmax = b.maxZ + 2.5;
        // Check Z overlap
        if (aZmax > bZmin && aZmin < bZmax) {
          // Overlap detected — shift platform B in Z by 1.5 units
          b.minZ += 1.5;
          b.maxZ += 1.5;
        }
      }
    }
  })();
'''
content = content.replace(
    '    // ─── v0.1.40-node-spread.11: Module flow arrows (TubeGeometry curves) ─',
    z_overlap_fix_code + '    // ─── v0.1.40-node-spread.11: Module flow arrows (TubeGeometry curves) ─'
)

# ─── Task 1D: Fix Pipe Arrow Positions ───
content = content.replace(
    'var sX = srcInfo.maxX + 2.0, eX = dstInfo.minX - 2.0;',
    'var sX = srcInfo.maxX + 3.0, eX = dstInfo.minX - 3.0;'
)

# ─── Task 2: Add config flow type to FLOW_COLORS ───
content = content.replace(
    '  knowledge: 0xFBBF24,\n};',
    '  knowledge: 0xFBBF24,\n  config:    0xFBBF24,\n};'
)
# Also update flowColors in the info panel
content = content.replace(
    "var flowColors = { control: '#3B82F6', data: '#60A5FA', event: '#34D399', knowledge: '#FBBF24' };",
    "var flowColors = { control: '#3B82F6', data: '#60A5FA', event: '#34D399', knowledge: '#FBBF24', config: '#FBBF24' };"
)

# ─── Task 2: Replace Legend with Comprehensive Multi-Type Legend ───
new_legend = '''<div id="legend" style="right:20px;bottom:20px;left:auto;background:rgba(8,8,16,0.88);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 16px;font-size:11px;color:#999;line-height:1.8;pointer-events:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);max-width:220px">
<div style="font-size:10px;color:#666;margin-bottom:4px;letter-spacing:0.5px;font-weight:600">节点分层</div>
<div class="row"><span class="dot" style="background:#F87171"></span>external<span style="color:#666;margin-left:4px;font-size:10px">（外部依赖）</span></div>
<div class="row"><span class="dot" style="background:#FBBF24"></span>presentation<span style="color:#666;margin-left:4px;font-size:10px">（展示层）</span></div>
<div class="row"><span class="dot" style="background:#34D399"></span>business<span style="color:#666;margin-left:4px;font-size:10px">（业务逻辑层）</span></div>
<div class="row"><span class="dot" style="background:#60A5FA"></span>data<span style="color:#666;margin-left:4px;font-size:10px">（数据层）</span></div>
<div class="row"><span class="dot" style="background:#3B82F6"></span>infrastructure<span style="color:#666;margin-left:4px;font-size:10px">（基础设施层）</span></div>
<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px">
<div style="font-size:10px;color:#666;margin-bottom:2px;letter-spacing:0.5px;font-weight:600">连接类型</div>
<div class="row"><span class="line-sample" style="background:#3B82F6"></span>control<span style="color:#666;margin-left:4px;font-size:10px">（控制流）</span></div>
<div class="row"><span class="line-sample" style="background:#60A5FA"></span>data<span style="color:#666;margin-left:4px;font-size:10px">（数据流）</span></div>
<div class="row"><span class="line-sample" style="background:#34D399"></span>event<span style="color:#666;margin-left:4px;font-size:10px">（事件流）</span></div>
<div class="row"><span class="line-sample" style="background:#FBBF24"></span>config<span style="color:#666;margin-left:4px;font-size:10px">（配置流）</span></div>
</div>
<div id="legendModules" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px">
<div style="font-size:10px;color:#666;margin-bottom:2px;letter-spacing:0.5px;font-weight:600">模块分组</div>
</div>
<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px">
<div style="font-size:10px;color:#666;margin-bottom:2px;letter-spacing:0.5px;font-weight:600">图例</div>
<div class="row"><span style="color:#FFD700;font-size:13px">★</span> 枢纽节点<span style="color:#666;margin-left:4px;font-size:10px">（高连接度）</span></div>
</div>
<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px;font-size:10px;color:#666">排布: Y轴分层排列 | X轴业务领域参考 | Z轴内外边界参考</div>
</div>

<!-- Three.js from CDN -->'''

old_full_legend = '<div id="legend">\n' + \
    '<div style="font-size:10px;color:#666;margin-bottom:4px;letter-spacing:0.5px">模块配色</div>\n' + \
    '<div class="row"><span class="dot" style="background:#4CAF50"></span>提取模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#2196F3"></span>存储模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#FF9800"></span>解析模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#9C27B0"></span>图查询模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#E91E63"></span>上下文模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#00BCD4"></span>MCP服务模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#795548"></span>安装模块</div>\n' + \
    '<div class="row"><span class="dot" style="background:#607D8B"></span>CLI模块</div>\n' + \
    '<div class="row" style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">\n' + \
    '<span class="line-sample" style="background:#3B82F6"></span>control\n' + \
    '<span class="line-sample" style="background:#60A5FA;margin-left:6px"></span>data\n' + \
    '<span class="line-sample" style="background:#34D399;margin-left:6px"></span>event\n' + \
    '<span class="line-sample" style="background:#FBBF24;margin-left:6px"></span>knowledge\n' + \
    '</div>\n' + \
    '<div class="row" style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#888">排布: Y轴分层排列 | X轴业务领域参考 | Z轴内外边界参考</div>\n' + \
    '</div>\n\n<!-- Three.js from CDN -->'

content = content.replace(old_full_legend, new_legend)

# ─── Update HTML Title ───
content = content.replace(
    '<title>3D Monitor v0.1.40-node-spread.19 — 修复模块台面/箭头/详情面板渲染</title>',
    '<title>3D Monitor v0.1.40-node-spread.20 — 修复穿模 + 图例多类型展示</title>'
)

# ─── Update version comment ───
content = content.replace(
    '<!-- 3d-monitor v0.1.40-node-spread.19 -->',
    '<!-- 3d-monitor v0.1.40-node-spread.20 -->'
)

# ─── Add dynamic module legend population JS ───
js_snippet = '''
  // ─── v0.1.40-node-spread.20: Populate dynamic module legend ──
  (function populateModuleLegend() {
    var legendModules = document.getElementById('legendModules');
    if (!legendModules || !window.MODULE_CONFIG) return;
    Object.keys(window.MODULE_CONFIG).forEach(function(modId) {
      if (modId === 'other') return;
      var cfg = window.MODULE_CONFIG[modId];
      var c = '#' + new THREE.Color(cfg.color).getHexString();
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span class="dot" style="background:' + c + '"></span>' + cfg.label;
      legendModules.appendChild(row);
    });
  })();
'''
content = content.replace(
    '    // ─── v0.1.40-node-spread.11: Module background boxes (rounded rect) ──',
    js_snippet + '    // ─── v0.1.40-node-spread.11: Module background boxes (rounded rect) ──'
)

# ─── Write result ───
with open(PATH, 'w') as f:
    f.write(content)
print(f'✅ Patched {PATH} successfully')
print(f'   New file size: {len(content)} bytes')
