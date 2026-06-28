#!/usr/bin/env node

/**
 * analyze.js — 一键分析命令
 *
 * 流程：
 *   1. 调用 port-tag-tool CLI 扫描项目，输出 port_tag_result.json
 *   2. 调用 auto_diagnose.js 自动标注，输出 port_tag_result_with_diagnosis.json
 *   3. 提示用户打开 load-data.html 查看
 */

import { execFileSync } from "child_process";
import { exit } from "process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { writeFileSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..", "..", "..");

// 解析 --project <path>
const projectIndex = process.argv.indexOf("--project");
let projectPath;
if (projectIndex !== -1 && projectIndex + 1 < process.argv.length) {
  projectPath = process.argv[projectIndex + 1];
} else {
  console.error("错误：缺少 --project 参数。用法：npm run analyze -- --project <路径>");
  exit(1);
}

// 步骤1：调用 port-tag-tool CLI 扫描，捕获 stdout 写入文件
console.log("\n[步骤 1/2] 正在扫描项目结构...");
try {
  const stdout = execFileSync(
    "node",
    [
      "packages/port-tag-tool/cli.js",
      "--action",
      "json",
      "--project",
      projectPath,
    ],
    {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "inherit"],
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    }
  );
  // 验证输出是有效 JSON
  JSON.parse(stdout);
  writeFileSync(resolve(ROOT, "port_tag_result.json"), stdout, "utf-8");
} catch (err) {
  if (err.stdout) {
    try {
      const tmp = JSON.parse(err.stdout);
      if (tmp && typeof tmp === "object") {
        writeFileSync(resolve(ROOT, "port_tag_result.json"), err.stdout, "utf-8");
        console.log("port-tag-tool 返回部分结果，尝试继续...");
      }
    } catch {
      console.error("port-tag-tool 输出不是有效 JSON：");
      console.error(err.stdout);
      console.error("\n错误详情：", err.stderr || err.message);
      exit(1);
    }
  } else {
    console.error("port-tag-tool 执行失败：", err.stderr || err.message);
    exit(1);
  }
}
console.log("port_tag_result.json 已生成");

// 步骤2：调用 auto_diagnose.js，读取 port_tag_result.json 作为 stdin
console.log("\n[步骤 2/2] 正在执行自动诊断标注...");
try {
  const input = readFileSync(resolve(ROOT, "port_tag_result.json"), "utf-8");
  const result = execFileSync(
    "node",
    ["packages/3d-monitor/scripts/auto_diagnose.js"],
    {
      cwd: ROOT,
      input,
      stdio: ["pipe", "pipe", "inherit"],
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    }
  );
  writeFileSync(resolve(ROOT, "port_tag_result_with_diagnosis.json"), result, "utf-8");
} catch (err) {
  if (err.stdout) {
    // 将部分输出写入文件
    writeFileSync(resolve(ROOT, "port_tag_result_with_diagnosis.json"), err.stdout, "utf-8");
  }
  console.error("auto_diagnose.js 执行失败：", err.stderr || err.message);
  exit(1);
}
console.log("port_tag_result_with_diagnosis.json 已生成");

console.log("\n✅ 完成！请打开 packages/3d-monitor/load-data.html 查看 3D 可视化结果。\n");
