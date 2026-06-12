#!/usr/bin/env python3
"""patch_v3.py — 修复连线端点脱离节点 v3 精确方案（由 Codex CLI 生成，X专员部署）"""

import sys

FILE = '/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/viewer.html'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# --- 改动 1：保存节点中心 ---
old1 = (
    '      var p1 = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);\n'
    '      var p2 = new THREE.Vector3(toPos.x, toPos.y, toPos.z);'
)
new1 = (
    '      var p1 = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);\n'
    '      var p2 = new THREE.Vector3(toPos.x, toPos.y, toPos.z);\n'
    '      var fromCenter = p1.clone();\n'
    '      var toCenter = p2.clone();'
)
count1 = content.count(old1)
if count1 == 0:
    print("ERROR: 改动 1 未匹配到 target", file=sys.stderr)
    sys.exit(1)
elif count1 > 1:
    print("ERROR: 改动 1 匹配到多次 ({})，请检查".format(count1), file=sys.stderr)
    sys.exit(1)
content = content.replace(old1, new1, 1)
print("改动 1 OK — 插入 fromCenter / toCenter")

# --- 改动 2：替换端点对齐逻辑 ---
old2 = (
    '      // v0.1.49: 端点对齐节点表面（fan spread 之后，确保端点紧贴表面）\n'
    '      p1 = offsetToBoxSurface(p1, p2, fromSize * 0.5, fromSize * 0.3, fromSize * 0.5);\n'
    '      p2 = offsetToBoxSurface(p2, p1, toSize * 0.5, toSize * 0.3, toSize * 0.5);'
)
new2 = (
    '      // v0.1.50: 精确端点 — 从节点中心沿 fanned 方向到表面\n'
    '      var fannedDir = new THREE.Vector3().subVectors(p2, p1).normalize();\n'
    '      p1 = offsetToBoxSurface(fromCenter, fromCenter.clone().add(fannedDir), fromSize * 0.5, fromSize * 0.3, fromSize * 0.5);\n'
    '      var revDir = fannedDir.clone().negate();\n'
    '      p2 = offsetToBoxSurface(toCenter, toCenter.clone().add(revDir), toSize * 0.5, toSize * 0.3, toSize * 0.5);'
)
count2 = content.count(old2)
if count2 == 0:
    print("ERROR: 改动 2 未匹配到 target", file=sys.stderr)
    sys.exit(1)
elif count2 > 1:
    print("ERROR: 改动 2 匹配到多次 ({})，请检查".format(count2), file=sys.stderr)
    sys.exit(1)
content = content.replace(old2, new2, 1)
print("改动 2 OK — 替换端点对齐逻辑")

# --- 改动 3：更新版本号 ---
old3 = '<title>3D Monitor v0.1.49 — Y-axis Level Layout</title>'
new3 = '<title>3D Monitor v0.1.50 — Y-axis Level Layout</title>'
count3 = content.count(old3)
if count3 == 0:
    print("ERROR: 改动 3 未匹配到 target", file=sys.stderr)
    sys.exit(1)
elif count3 > 1:
    print("ERROR: 改动 3 匹配到多次 ({})，请检查".format(count3), file=sys.stderr)
    sys.exit(1)
content = content.replace(old3, new3, 1)
print("改动 3 OK — 更新版本号")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("PATCH v3 APPLIED SUCCESSFULLY")
