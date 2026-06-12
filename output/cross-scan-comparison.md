# 交叉扫描对比

## 工具A：CodeGraph → 扫 arch-scanner

> CodeGraph 只扫 .js 文件，看代码级

扫描结果：**9 个 JS 文件，178 个符号，348 条边**

文件结构：
```
packages/3d-monitor/mcp-server.js          (47 symbols)
packages/port-tag-tool/cli.js              (29 symbols)
packages/port-tag-tool/index.js            (3 symbols)
packages/port-tag-tool/mcp-server.js       (27 symbols)
packages/port-tag-tool/portRegistry.js     (16 symbols)
packages/port-tag-tool/projectScanner.js   (34 symbols)
packages/port-tag-tool/tagRegistry.js      (17 symbols)
public/three.min.js                        (1 symbol)
```

能查到：
- scanProject → 被 cli.js 和 mcp-server.js 调用 ✅
- projectScanner 的改动会影响 3 个文件
- 但看不到 viewer.html（不是 .js 文件）

## 工具B：arch-scanner → 扫 codegraph 项目

> port-tag-tool 扫文件/目录级，看项目结构

扫描结果：**254 个节点，760 条连接**

按层分布：
- infrastructure: 85 个
- presentation: 141 个
- external: 17 个
- business: 11 个

能看到整个项目的目录结构和文件依赖关系。

## 差异总结

| 维度 | CodeGraph | arch-scanner |
|------|-----------|-------------|
| 看什么 | 代码级（函数/类/导入） | 项目级（文件/目录/模块） |
| 能看 HTML | ❌ 只扫 .js | ✅ 全扫 |
| 可视化 | ❌ 纯文本 | ✅ 3D 拓扑图 |
| 调用链 | ✅ 查找调用者/被调用者 | ❌ 暂无 |
| 影响分析 | ✅ 改一个符号影响哪些文件 | ❌ 暂无 |
