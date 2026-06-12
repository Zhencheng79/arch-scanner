#!/usr/bin/env python3
"""
patch_v11.py — v0.1.40-node-spread.11: 模块流向箭头改善 + 背景框改善 + 连线端点脱节修复

Apply: python3 patch_v11.py
Undo:  git checkout -- packages/3d-monitor/viewer.html
"""

VIEWER = "packages/3d-monitor/viewer.html"

def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changes = []

    # ──────────────────────────────────────────────
    # 1. 模块流向箭头改善 (buildModuleFlowArrow)
    # ──────────────────────────────────────────────
    # 1a. tubeRadius: 0.08 → 0.14
    old = 'var tubeSegments = 20, radialSegments = 6, tubeRadius = 0.08;'
    new = 'var tubeSegments = 24, radialSegments = 8, tubeRadius = 0.14;'
    if old in content:
        content = content.replace(old, new)
        changes.append("tubeRadius 0.08→0.14, segments 20→24, radial 6→8")
    else:
        print(f"  [FAIL] anchor not found: {old[:50]}")

    # 1b. opacity: 0.6 → 0.75
    old = 'var tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });'
    new = 'var tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 });'
    if old in content:
        content = content.replace(old, new)
        changes.append("tube opacity 0.6→0.75")
    else:
        print(f"  [FAIL] anchor not found: tube opacity")

    # 1c. ConeGeometry: 0.25/0.6 → 0.18/0.4
    old = 'var coneGeo = new THREE.ConeGeometry(0.25, 0.6, 8);'
    new = 'var coneGeo = new THREE.ConeGeometry(0.18, 0.4, 8);'
    if old in content:
        content = content.replace(old, new)
        changes.append("coneGeometry 0.25/0.6→0.18/0.4")
    else:
        print(f"  [FAIL] anchor not found: ConeGeometry")

    # 1d. dotCount: 4 → 6
    old = 'var dotCount = 4;'
    new = 'var dotCount = 6;'
    if old in content:
        content = content.replace(old, new)
        changes.append("dotCount 4→6")
    else:
        print(f"  [FAIL] anchor not found: dotCount")

    # 1e. SphereGeometry: 0.1 → 0.08
    old = '      var dg = new THREE.SphereGeometry(0.1, 6, 6);'
    new = '      var dg = new THREE.SphereGeometry(0.08, 6, 6);'
    if old in content:
        content = content.replace(old, new)
        changes.append("dot sphere 0.1→0.08")
    else:
        print(f"  [FAIL] anchor not found: SphereGeometry 0.1")

    # 1f. label Y offset: 0.8 → 1.2
    old = '    plObj.position.set(labPos.x, labPos.y + 0.8, labPos.z);'
    new = '    plObj.position.set(labPos.x, labPos.y + 1.2, labPos.z);'
    if old in content:
        content = content.replace(old, new)
        changes.append("arrow label Y +0.8→+1.2")
    else:
        print(f"  [FAIL] anchor not found: label Y +0.8")

    # ──────────────────────────────────────────────
    # 2. 模块背景框改善 (module background boxes)
    # ──────────────────────────────────────────────
    # 2a. padding: 4.0 → 5.0
    for dim in ['sX', 'sZ']:
        old = f'var {dim} = info.max{"X" if dim == "sX" else "Z"} - info.min{"X" if dim == "sX" else "Z"} + 4.0;'
        new = f'var {dim} = info.max{"X" if dim == "sX" else "Z"} - info.min{"X" if dim == "sX" else "Z"} + 5.0;'
        if old in content:
            content = content.replace(old, new)
            changes.append(f"padding {dim} 4.0→5.0")
        else:
            print(f"  [FAIL] anchor not found: padding {dim}")

    # 2b. fill opacity: 0.08 → 0.12
    old = '        color: mc, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,'
    new = '        color: mc, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide,'
    if old in content:
        content = content.replace(old, new)
        changes.append("fill opacity 0.08→0.12")
    else:
        print(f"  [FAIL] anchor not found: fill opacity 0.08")

    # 2c. dashed border → solid thin border
    old = (
        '      var egMat = new THREE.LineDashedMaterial({\n'
        '        color: mc, transparent: true, opacity: 0.15, dashSize: 0.3, gapSize: 0.2,\n'
        '      });\n'
        '      var egLine = new THREE.Line(edgeGeo, egMat);\n'
        '      egLine.position.set(cX, cY, cZ);\n'
        '      egLine.computeLineDistances();'
    )
    new = (
        '      var egMat = new THREE.LineBasicMaterial({\n'
        '        color: mc, transparent: true, opacity: 0.35,\n'
        '      });\n'
        '      var egLine = new THREE.Line(edgeGeo, egMat);\n'
        '      egLine.position.set(cX, cY, cZ);'
    )
    if old in content:
        content = content.replace(old, new)
        changes.append("border dashed→solid (opacity 0.15→0.35)")
    else:
        print(f"  [FAIL] anchor not found: LineDashedMaterial border")

    # 2d. font size: 16px → 18px
    old = "      mlDiv.style.fontSize = '16px';"
    new = "      mlDiv.style.fontSize = '18px';"
    if old in content:
        content = content.replace(old, new)
        changes.append("label fontSize 16→18px")
    else:
        print(f"  [FAIL] anchor not found: fontSize 16px")

    # 2e. label Y offset: 1.0 → 1.2
    old = '      mlObj.position.set(cX, cY + 1.0, cZ);'
    new = '      mlObj.position.set(cX, cY + 1.2, cZ);'
    if old in content:
        content = content.replace(old, new)
        changes.append("bg label Y +1.0→+1.2")
    else:
        print(f"  [FAIL] anchor not found: bg label Y +1.0")

    # ──────────────────────────────────────────────
    # 3. 连线端点脱节修复
    # ──────────────────────────────────────────────
    old_surface = (
        '      // v0.1.50: 精确端点 — 从节点中心沿 fanned 方向到表面\n'
        '      var fannedDir = new THREE.Vector3().subVectors(p2, p1).normalize();\n'
        '      p1 = offsetToBoxSurface(fromCenter, fromCenter.clone().add(fannedDir), fromSize * 0.5, fromSize * 0.3, fromSize * 0.5);\n'
        '      var revDir = fannedDir.clone().negate();\n'
        '      p2 = offsetToBoxSurface(toCenter, toCenter.clone().add(revDir), toSize * 0.5, toSize * 0.3, toSize * 0.5);'
    )
    new_surface = (
        '      // v0.1.50: 精确端点 — 从节点中心沿 fanned 方向到表面\n'
        '      // v0.1.40-node-spread.11: 使用节点实际 box 半尺寸，更贴合真实节点大小\n'
        '      var fannedDir = new THREE.Vector3().subVectors(p2, p1).normalize();\n'
        '      var srcNode = nodeMap[conn.from] || null;\n'
        '      var dstNode = nodeMap[conn.to] || null;\n'
        '      var srcHalf = (srcNode && srcNode._isGroupNode) ? 1.0 : 0.6;\n'
        '      var srcHalfY = (srcNode && srcNode._isGroupNode) ? 0.6 : 0.36;\n'
        '      var dstHalf = (dstNode && dstNode._isGroupNode) ? 1.0 : 0.6;\n'
        '      var dstHalfY = (dstNode && dstNode._isGroupNode) ? 0.6 : 0.36;\n'
        '      p1 = offsetToBoxSurface(fromCenter, fromCenter.clone().add(fannedDir), srcHalf, srcHalfY, srcHalf);\n'
        '      var revDir = fannedDir.clone().negate();\n'
        '      p2 = offsetToBoxSurface(toCenter, toCenter.clone().add(revDir), dstHalf, dstHalfY, dstHalf);'
    )
    if old_surface in content:
        content = content.replace(old_surface, new_surface)
        changes.append("surface offset: use node actual half-sizes (group 1.0/0.6, normal 0.6/0.36)")
    else:
        print(f"  [FAIL] anchor not found: surface offset block")

    # ──────────────────────────────────────────────
    # 4. Update version string in title
    # ──────────────────────────────────────────────
    old_ver = '<title>3D Monitor v0.1.40-node-spread.10 — Module Y-Layering</title>'
    new_ver = '<title>3D Monitor v0.1.40-node-spread.11 — 流向箭头+背景框+连线修复</title>'
    if old_ver in content:
        content = content.replace(old_ver, new_ver)
        changes.append("version v10→v11")
    else:
        print(f"  [FAIL] version title not found")

    # ──────────────────────────────────────────────
    # Update version comments
    # ──────────────────────────────────────────────
    # Line 2924: Module Y-layering
    old = '    // ─── v0.1.40-node-spread.10: Module Y-layering'
    new = '    // ─── v0.1.40-node-spread.11: Module Y-layering'
    content = content.replace(old, new)
    changes.append("version comment Y-layering")

    # Line 3678: background boxes
    old = '    // ─── v0.1.40-node-spread.10: Module background boxes (rounded rect)'
    new = '    // ─── v0.1.40-node-spread.11: Module background boxes (rounded rect)'
    content = content.replace(old, new)
    changes.append("version comment background boxes")

    # Line 3737: flow arrows
    old = '    // ─── v0.1.40-node-spread.10: Module flow arrows (TubeGeometry curves)'
    new = '    // ─── v0.1.40-node-spread.11: Module flow arrows (TubeGeometry curves)'
    if old in content:
        content = content.replace(old, new)
        changes.append("version comment flow arrows")
    else:
        print(f"  [FAIL] version comment flow arrows not found")

    # Line 4377: animation
    old = '  // v0.1.40-node-spread.10: Module flow arrows animation'
    new = '  // v0.1.40-node-spread.11: Module flow arrows animation'
    content = content.replace(old, new)
    changes.append("version comment animation")

    # ──────────────────────────────────────────────
    # 写入
    # ──────────────────────────────────────────────
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ patch_v11.py applied to viewer.html")
    print(f"   Total changes: {len(changes)}")
    for c in changes:
        print(f"   • {c}")


if __name__ == "__main__":
    import os
    cwd = os.getcwd()
    patch_file(os.path.join(cwd, VIEWER))
    print(f"\nDone. Version now: v0.1.40-node-spread.11")
