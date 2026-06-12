# 修复 CHINESE_MAP 硬编码导致扫描外项目中文名错误

## 工作目录
~/projects/arch-scanner

## 分支
feature/node-spread

## 问题
projectScanner.js 中的 CHINESE_MAP 和 FILE_CHINESE_MAP 里的中文名是专门为 arch-scanner 项目自身写的。扫描其他项目（如 CodeGraph）时，看到 src/ 目录就硬叫「3D全景前端」，完全不对。

## 修改要求

### 方案：检测项目身份 + 自动生成中文名

1. 在 CHINESE_MAP / FILE_CHINESE_MAP 使用前，先判断当前扫描的项目是不是 arch-scanner 自身
2. 判断方法：检测 projectPath 是否包含 `arch-scanner` 或检查 package.json 的 name 字段是否为 `arch-scanner`
3. 如果是 arch-scanner 自身 → 继续用精心编写的中文名（不变）
4. 如果是其他项目（如 CodeGraph）→ 
   - 不要用硬编码的 CHINESE_MAP
   - 改用自动生成的中文名：
     - `src` → `源码目录`
     - `bin` → `命令行`
     - `scripts` → `脚本`
     - `tests` / `__tests__` → `测试`
     - `docs` → `文档`
     - `examples` → `示例`
     - `lib` → `库`
     - `dist` → `构建输出`
     - `config` → `配置`
     - `node_modules` / `dep-*` → `依赖`
     - 其他路径 → 取路径最后一段作为中文名
5. 对于 FILE_CHINESE_MAP 也一样处理：非 arch-scanner 项目时，按文件后缀或用途自动生成

## 修改文件
packages/port-tag-tool/projectScanner.js

## 版本号
v0.2.1

## 验证
1. 用 port-tag-tool 扫 arch-scanner 自身 → 中文名应该不变
2. 用 port-tag-tool 扫 codegraph 项目 → src 目录显示「源码目录」而不是「3D全景前端」
3. 生成 3D 测试页确认中文名正确
