# 工具只输出通用中文名，删除 arch-scanner 专有条目

## 工作目录
~/projects/arch-scanner

## 核心原则
端口标签工具是底层工具，责任是**准确**不是**美化**。工具只输出通用中文名。
arch-scanner 项目的专有昵称（如「3D全景前端」「MCP服务端」）不由工具负责，
由上层 Agent 的 skill/记忆 在展示时按需翻译。

## 修改要求

### 1. 彻底清理 GENERIC_CHINESE_MAP 和 FILE_CHINESE_MAP 中的专有条目
删除以下 arch-scanner 专用的中文名映射：

| 路径 | 旧名 | 改为 |
|------|------|------|
| src | 3D全景前端 | 源码目录 |
| plugins | 构建插件 | 插件 |
| server | MCP服务端 | 服务端 |
| tools | 工具入口 | 工具 |
| src/data | 数据加载层 | 源码/数据 |
| src/components | 3D渲染组件 | 源码/组件 |
| src/mcp | MCP前端适配 | 源码/MCP |
| src/utils | 前端工具函数 | 源码/工具 |
| src/examples | 示例数据 | 源码/示例 |
| packages/port-tag-tool | 端口标签工具 | 包/端口标签工具 |

### 2. 删除 FILE_CHINESE_MAP 中的专有条目
同理，删除所有 arch-scanner 专有的文件名映射。

### 3. 保留通用映射
以下通用映射保留不变：
```
'lib': '库'
'api': 'API接口'
'docs': '文档'
'tests': '测试' / '__tests__': '测试'
'bin': '二进制'
'scripts': '脚本'
'config': '配置'
... 等通用条目
```

### 4. 新增自动生成 fallback
如果路径在通用映射中也找不到，取路径最后一段作为中文名。

## 修改文件
packages/port-tag-tool/projectScanner.js

## 验证
1. 扫 arch-scanner 自身 → src 显示「源码目录」不再显示「3D全景前端」
2. 扫 codegraph 项目 → src 显示「源码目录」
3. 不报错，扫描结果完整
