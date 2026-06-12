#!/usr/bin/env python3
"""Apply v0.1.40-node-spread.10 patches to viewer.html"""
FP = '/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/viewer.html'

with open(FP, 'r') as f:
    src = f.read()

# Backup
import shutil
shutil.copy2(FP, FP + '.bak.v10-py')
print('Backup created')

# 1. Title
src = src.replace(
    '<title>3D Monitor v0.1.40-node-spread.09 — Y-axis Level Layout</title>',
    '<title>3D Monitor v0.1.40-node-spread.10 — Module Y-Layering</title>'
)

# 2. MODULE_Y_ORDER + MODULE_Y_SPACING
src = src.replace(
    '};\nfunction detectModule(nodeId) {',
    '};\nvar MODULE_Y_ORDER = [\'extraction\', \'db\', \'resolution\', \'graph\', \'context\', \'mcp\', \'installer\', \'cli\', \'other\'];\nvar MODULE_Y_SPACING = 1.5;\nfunction detectModule(nodeId) {'
)

# 3. Y-layering after module layout info build
old_layout_return = '''      window._moduleLayoutInfo[modId] = {
        minX: minX, maxX: maxX,
        minZ: minZ, maxZ: maxZ,
        avgY: ySum / count,
        nodeCount: count,
        color: MODULE_CONFIG[modId] ? MODULE_CONFIG[modId].color : 0x888888,
        label: MODULE_CONFIG[modId] ? MODULE_CONFIG[modId].label : modId,
      };
    });
  }

  return positions;'''

new_layout_return = '''      window._moduleLayoutInfo[modId] = {
        minX: minX, maxX: maxX,
        minZ: minZ, maxZ: maxZ,
        avgY: ySum / count,
        nodeCount: count,
        color: MODULE_CONFIG[modId] ? MODULE_CONFIG[modId].color : 0x888888,
        label: MODULE_CONFIG[modId] ? MODULE_CONFIG[modId].label : modId,
      };
    });
  }

  // ─── v0.1.40-node-spread.10: Module Y-layering ─────────────────────
  var moduleYLevels = {};
  presBucket.forEach(function(n) {
    var mod = detectModule(n.id);
    var idx = MODULE_Y_ORDER.indexOf(mod);
    if (idx === -1) idx = MODULE_Y_ORDER.indexOf('other');
    var p = positions[n.id];
    if (!p) return;
    if (!moduleYLevels[mod]) {
      moduleYLevels[mod] = idx;
      var info = window._moduleLayoutInfo[mod];
      if (info) {
        var baseY = info.avgY;
        info.avgY = baseY + idx * MODULE_Y_SPACING;
      }
    }
    var info = window._moduleLayoutInfo[mod];
    if (info) {
      p.y = info.avgY;
    }
  });

  return positions;'''

assert old_layout_return in src, "ERROR: old layout return block not found"
src = src.replace(old_layout_return, new_layout_return)
print('Y-layering applied')

# 4. _moduleFlowArrows
src = src.replace(
    'var _arrowFlowDots = [];',
    'var _arrowFlowDots = [];\nvar _moduleFlowArrows = [];'
)
print('_moduleFlowArrows added')

# 5. Rounded rect boxes (replaces old box code)
old_boxes_marker = '// ─── v0.1.40-node-spread.09: Module background boxes ──────────────'
box_start = src.find(old_boxes_marker)
box_end_search = src.find('\n  // ─── v0.1.40-node-spread.09: Pipeline flow arrows', box_start)
assert box_start >= 0 and box_end_search >= 0, "ERROR: box markers not found"
new_boxes_block = '''  // ─── v0.1.40-node-spread.10: Module background boxes (rounded rect) ──
  if (window._moduleLayoutInfo) {
    Object.keys(window._moduleLayoutInfo).forEach(function(modId) {
      var info = window._moduleLayoutInfo[modId];
      if (info.nodeCount < 2) return;
      var cX = (info.minX + info.maxX) / 2;
      var cZ = (info.minZ + info.maxZ) / 2;
      var sX = info.maxX - info.minX + 4.0;
      var sZ = info.maxZ - info.minZ + 4.0;
      var cY = info.avgY;
      var mc = info.color;
      var mc3 = new THREE.Color(mc);
      // Rounded rectangle shape
      var shape = new THREE.Shape();
      var r = Math.min(1.0, Math.min(sX, sZ) * 0.15);
      var hw = sX / 2, hd = sZ / 2;
      shape.moveTo(-hw + r, -hd);
      shape.lineTo(hw - r, -hd);
      shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
      shape.lineTo(hw, hd - r);
      shape.quadraticCurveTo(hw, hd, hw - r, hd);
      shape.lineTo(-hw + r, hd);
      shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
      shape.lineTo(-hw, -hd + r);
      shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
      // Fill
      var bgGeo = new THREE.ShapeGeometry(shape);
      var bgMat = new THREE.MeshBasicMaterial({
        color: mc, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
      });
      var bgMesh = new THREE.Mesh(bgGeo, bgMat);
      bgMesh.position.set(cX, cY, cZ);
      bgMesh.rotation.x = -Math.PI / 2;
      moduleGroup.add(bgMesh);
      // Dashed border
      var edgesPts = shape.getPoints(32);
      edgesPts.push(edgesPts[0]);
      var edgeGeo = new THREE.BufferGeometry().setFromPoints(
        edgesPts.map(function(pt) { return new THREE.Vector3(pt.x, 0, pt.y); })
      );
      var egMat = new THREE.LineDashedMaterial({
        color: mc, transparent: true, opacity: 0.15, dashSize: 0.3, gapSize: 0.2,
      });
      var egLine = new THREE.Line(edgeGeo, egMat);
      egLine.position.set(cX, cY, cZ);
      egLine.computeLineDistances();
      moduleGroup.add(egLine);
      // Label
      var mlDiv = document.createElement('div');
      mlDiv.className = 'label-2d';
      mlDiv.style.fontSize = '16px';
      mlDiv.style.fontWeight = 'bold';
      mlDiv.style.color = '#' + mc3.getHexString();
      mlDiv.textContent = info.label;
      var mlObj = new THREE.CSS2DObject(mlDiv);
      mlObj.position.set(cX, cY + 1.0, cZ);
      moduleGroup.add(mlObj);
    });
  }'''
src = src[:box_start] + new_boxes_block + src[box_end_search:]
print('Boxes replaced with rounded rects')

# 6. TubeGeometry arrows (replaces old arrow code)
old_arrows_marker = '// ─── v0.1.40-node-spread.09: Pipeline flow arrows ──────────────────'
arrow_start = src.find(old_arrows_marker)
arrow_end_search = src.find('\n  // ─── v0.1.40-node-spread.09: Integration glow bands', arrow_start)
assert arrow_start >= 0 and arrow_end_search >= 0, "ERROR: arrow markers not found"
new_arrows_block = '''  // ─── v0.1.40-node-spread.10: Module flow arrows (TubeGeometry curves) ─
  function buildModuleFlowArrow(srcMod, dstMod, colorA, colorB, srcInfo, dstInfo) {
    var sX = srcInfo.maxX + 2.0, eX = dstInfo.minX - 2.0;
    var sY = srcInfo.avgY, eY = dstInfo.avgY;
    var sZ = (srcInfo.minZ + srcInfo.maxZ) / 2;
    var eZ = (dstInfo.minZ + dstInfo.maxZ) / 2;
    var midX = (sX + eX) / 2, midY = (sY + eY) / 2, midZ = (sZ + eZ) / 2;
    var arcZ = midZ + 1.0;
    var pathPts = [
      new THREE.Vector3(sX, sY, sZ),
      new THREE.Vector3(midX, midY, arcZ),
      new THREE.Vector3(eX, eY, eZ)
    ];
    var curve = new THREE.CatmullRomCurve3(pathPts);
    var tubeSegments = 20, radialSegments = 6, tubeRadius = 0.08;
    var tubeGeo = new THREE.TubeGeometry(curve, tubeSegments, tubeRadius, radialSegments, false);
    var posAttr = tubeGeo.getAttribute('position');
    var colors = new Float32Array(posAttr.count * 3);
    var cA = new THREE.Color(colorA), cB = new THREE.Color(colorB);
    for (var vi = 0; vi < posAttr.count; vi++) {
      var t = vi / posAttr.count;
      var c = cA.clone().lerp(cB, t);
      colors[vi*3] = c.r; colors[vi*3+1] = c.g; colors[vi*3+2] = c.b;
    }
    tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });
    var tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    moduleGroup.add(tubeMesh);
    var coneGeo = new THREE.ConeGeometry(0.25, 0.6, 8);
    var coneMat = new THREE.MeshBasicMaterial({ color: colorB, transparent: true, opacity: 0.7 });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    var endDir = curve.getTangent(1.0);
    cone.position.copy(curve.getPoint(1.0));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endDir);
    moduleGroup.add(cone);
    var dotCount = 4;
    for (var di = 0; di < dotCount; di++) {
      var dg = new THREE.SphereGeometry(0.1, 6, 6);
      var dm = new THREE.MeshBasicMaterial({ color: cB, transparent: true, opacity: 0.8 });
      var dot = new THREE.Mesh(dg, dm);
      var initP = di / dotCount;
      moduleGroup.add(dot);
      _moduleFlowArrows.push({ mesh: dot, curve: curve, progress: initP, speed: 0.12 + Math.random() * 0.06 });
    }
    var plDiv = document.createElement('div');
    plDiv.className = 'pipe-label-3d';
    var lcStr = '#' + cB.getHexString();
    plDiv.style.borderColor = lcStr;
    plDiv.style.color = lcStr;
    plDiv.style.fontSize = '11px';
    plDiv.textContent = (window.MODULE_CONFIG[srcMod] ? window.MODULE_CONFIG[srcMod].label : srcMod) + ' \u2192 ' + (window.MODULE_CONFIG[dstMod] ? window.MODULE_CONFIG[dstMod].label : dstMod);
    var plObj = new THREE.CSS2DObject(plDiv);
    var labPos = curve.getPoint(0.5);
    plObj.position.set(labPos.x, labPos.y + 0.8, labPos.z);
    moduleGroup.add(plObj);
  }

  var PIPELINE = ['extraction', 'db', 'resolution', 'graph', 'context', 'mcp'];
  if (window._moduleLayoutInfo) {
    for (var pi = 0; pi < PIPELINE.length - 1; pi++) {
      var srcMod = PIPELINE[pi], dstMod = PIPELINE[pi + 1];
      var srcInfo = window._moduleLayoutInfo[srcMod];
      var dstInfo = window._moduleLayoutInfo[dstMod];
      if (!srcInfo || !dstInfo) continue;
      if (srcInfo.nodeCount < 1 || dstInfo.nodeCount < 1) continue;
      buildModuleFlowArrow(srcMod, dstMod, srcInfo.color, dstInfo.color, srcInfo, dstInfo);
    }
    // Branch arrows: resolution\u2192installer, context\u2192cli
    var branchArrows = [
      ['resolution', 'installer'],
      ['context', 'cli']
    ];
    branchArrows.forEach(function(br) {
      var srcMod = br[0], dstMod = br[1];
      var srcInfo = window._moduleLayoutInfo[srcMod];
      var dstInfo = window._moduleLayoutInfo[dstMod];
      if (!srcInfo || !dstInfo) return;
      if (srcInfo.nodeCount < 1 || dstInfo.nodeCount < 1) return;
      buildModuleFlowArrow(srcMod, dstMod, srcInfo.color, dstInfo.color, srcInfo, dstInfo);
    });
  }'''
src = src[:arrow_start] + new_arrows_block + src[arrow_end_search:]
print('Arrows replaced with TubeGeometry curves')

# 7. Animation loop update
old_anim = '''  // v0.1.40-node-spread.09: Arrow flow dots animation
  _arrowFlowDots.forEach(function(afd) {
    afd.progress += afd.speed * delta;
    if (afd.progress > 1.0) afd.progress -= 1.0;
    afd.mesh.position.set(afd.startX + afd.progress * (afd.endX - afd.startX), afd.y, afd.z);
  });'''

new_anim = '''  // v0.1.40-node-spread.09/10: Arrow flow dots animation
  _arrowFlowDots.forEach(function(afd) {
    afd.progress += afd.speed * delta;
    if (afd.progress > 1.0) afd.progress -= 1.0;
    afd.mesh.position.set(afd.startX + afd.progress * (afd.endX - afd.startX), afd.y, afd.z);
  });
  // v0.1.40-node-spread.10: Module flow arrows animation
  _moduleFlowArrows.forEach(function(mfa) {
    mfa.progress += mfa.speed * delta;
    if (mfa.progress > 1.0) mfa.progress -= 1.0;
    var pt = mfa.curve.getPoint(mfa.progress);
    mfa.mesh.position.copy(pt);
  });'''

assert old_anim in src, "ERROR: old anim block not found"
src = src.replace(old_anim, new_anim)
print('Animation updated')

# 8. Clear in buildScene
src = src.replace(
    '_arrowFlowDots = [];',
    '_arrowFlowDots = [];\n  _moduleFlowArrows = [];'
)
print('buildScene clear updated')

with open(FP, 'w') as f:
    f.write(src)

print('\n✅ All v0.1.40-node-spread.10 patches applied.')
print(f'Final file size: {len(src)} bytes')
