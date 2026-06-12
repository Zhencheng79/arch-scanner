# 修复：GENERIC_CHINESE_MAP 中仍包含 arch-scanner 专有条目

## 工作目录
~/projects/arch-scanner

## 问题
上一版修复把 CHINESE_MAP 改名为 GENERIC_CHINESE_MAP，但 `src → 3D全景前端`、`project-root → 系统3D全景` 等 arch-scanner 专有条目仍然留在通用映射表中。
扫其他项目时，`src` 目录仍被错误标记为「3D全景前端」。

## 修改要求

### 1. 拆分映射表
把 GENERIC_CHINESE_MAP 拆成两张表：

**表A：ARCH_SCANNER_MAP（仅扫 arch-scanner 自身时用）**
```
'packages/port-tag-tool': '端口标签工具'
'src': '3D全景前端'
'plugins': '构建插件'
'server': 'MCP服务端'
'src/data': '数据加载层'
'src/components': '3D渲染组件'
...等 arch-scanner 专用名
```

**表B：GENERIC_CHINESE_MAP（所有项目通用）**
```
'src': '源码目录'
'lib': '库'
'api': 'API接口'
'docs': '文档'
'tests': '测试'
'bin': '二进制'
'scripts': '脚本'
...等通用名，不含 arch-scanner 专用条目
```

### 2. 修改 generateChineseName 函数
```javascript
function generateChineseName(name, type = 'dir') {
  // 先判断是否 arch-scanner 项目
  if (isArchScannerProject) {
    if (ARCH_SCANNER_MAP[name]) return ARCH_SCANNER_MAP[name].chineseName;
  }
  // 通用映射
  if (GENERIC_CHINESE_MAP[name]) return GENERIC_CHINESE_MAP[name].chineseName;
  // fallback: 路径最后一段
  ...
}
```

### 3. isArchScannerProject 判断
在扫描开始时检测 projectPath 是否包含 `arch-scanner`，设置全局标记。

## 修改文件
packages/port-tag-tool/projectScanner.js

## 验证
1. 扫 arch-scanner 自身 → src 仍显示「3D全景前端」（不变）
2. 扫 codegraph 项目 → src 显示「源码目录」
