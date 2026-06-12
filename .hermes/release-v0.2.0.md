# 固化版本 v0.2.0 — 端口标签工具 AST 扫描强化

## 任务
固化 port-tag-tool v0.2.0（AST扫描强化版本），更新版本号、CHANGELOG、git提交、推送到GitHub。

## 当前已知状态（来自上次run）
- Git tag v0.2.0 已存在（commit 6abf9a3）
- port-tag-tool/package.json 版本已更新为 0.2.0
- port-tag-tool/CHANGELOG.md 已更新
- 根 package.json 版本仍为 0.1.17（未同步）

## 剩余步骤

### 1. 同步根 package.json 版本
```bash
cd /Users/zhencheng/projects/hermes-3d-panorama
```
修改根目录 package.json 的 version 字段为 "0.2.0"

### 2. 确保只提交了 port-tag-tool 相关文件
```bash
git add packages/port-tag-tool/package.json
git add packages/port-tag-tool/projectScanner.js
git add packages/port-tag-tool/CHANGELOG.md
git add packages/port-tag-tool/package-lock.json
git add port_tag_result.json
git add package.json
```

### 3. 提交并推送
```bash
git commit -m "feat: port-tag-tool v0.2.0 — AST解析引擎强化"
git push origin main --tags
```

### 4. 创建 GitHub Release
```bash
gh release create v0.2.0 \
  --title "port-tag-tool v0.2.0 — AST扫描强化" \
  --notes "核心升级：acorn+acorn-jsx AST解析引擎，扫描准确率100%通过三方交叉验证。"
```

## 注意事项
- 不要提交 3d-monitor 的改动（viewer.html等是力导向分支的，不在本次发布范围）
- 本次只发布 port-tag-tool v0.2.0
