# 架构认知管线 — 下一步方案 v1

## 当前完成

| 方向 | 状态 |
|------|------|
| P0 通用模块检测 | ✅ git提交 |
| Phase 2a 自动标注 | ✅ git提交 |
| 方向C 合并+文档 | ✅ git提交 |
| 方向A build step | ✅ `npm run diagnose` |
| 方向B fetch异步 | ✅ git提交 |

## 问题：使用流程碎片化

目前要完成一次完整的"扫描→诊断→查看"需要三步手动操作：

```
① node cli.js --action json --project 路径 > port_tag_result.json
② npm run diagnose < port_tag_result.json > port_tag_result_with_diagnosis.json  
③ 打开 load-data.html
```

对主公来说，每次要看一个新项目都要记住这三个步骤，体验不好。

## 方案：一键分析命令

在 package.json 新增一个 `analyze` 命令，把三步合为一步：

```
npm run analyze -- --project 项目路径
```

做的事情：
1. 调用 port-tag-tool 扫描项目 → 输出 port_tag_result.json
2. 调用 auto_diagnose.js 自动标注 → 输出 port_tag_result_with_diagnosis.json
3. 提示"分析完成！打开 packages/3d-monitor/load-data.html 查看"
4. （可选）自动打开浏览器

需要改动：
- package.json 新增 `analyze` script
- 或新增一个 analyze.js 脚本编排三步

## 验收条件
1. 一个命令完成扫描+诊断全流程
2. 自动打开 load-data.html（或提示路径）
3. 向下兼容（原有功能不受影响）

## 工作量估算
- 新增 analyze.js 脚本：~20分钟
- 不修改任何已有文件（除 package.json 加 script）
