# Changelog

## v0.2.0 (2026-06-11)
### Added
- AST解析引擎：用 acorn + acorn-jsx 替代纯正则 import 提取
- 跨目录相对路径支持：`../data/systemData` 正确解析到 `data--systemData`
- npm依赖自动识别：从 package.json 提取 dependencies/devDependencies
- 配置文件解析：vite.config.js 等配置文件中的引用关系

### Fixed
- 子模块 connection 从 31 条提升到 100 条
- 零连接节点从 18 个降到 11 个（剩余均为合理零连接）
- 避免正则误匹配注释/字符串中的 import

### Changed
- 扫描流程：AST-first，正则 fallback
- 文件级模块的 per-file imports 从空数组改为真实解析结果

## v0.1.1 (之前版本)
- 初始端口扫描功能
- 标签管理系统
- MCP协议适配
