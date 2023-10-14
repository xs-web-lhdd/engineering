import path from "node:path";
import { pathExistsSync } from "path-exists";
import fse from "fs-extra";
import ora from "ora";
import { execa } from "execa";
import { log, printErrorLog } from "@liu/utils";

function getCacheDir(targetPath) {
  const cacheDir = path.resolve(targetPath, "node_modules");
  return cacheDir;
}

// 创建缓存目录
function makeCacheDir(targetPath) {
  const cacheDir = getCacheDir(targetPath);
  if (!pathExistsSync(cacheDir)) {
    // 如果cache目录不存在就创建 cache 目录
    fse.mkdirSync(cacheDir, { recursive: true }); // 这里一定要写 { recursive: true } 选项进行递归创建，否则创建不会成功
  }
}

async function downloadAddTemplate(targetPath, selectedTemplate) {
  const { npmName, version } = selectedTemplate;
  const installCommand = "npm";
  const installArgs = ["install", `${npmName}@${version}`];
  const cwd = targetPath;
  log.verbose("installArgs", installArgs);
  log.verbose("cwd", cwd);
  const subprocess = execa(installCommand, installArgs, { cwd });
  await subprocess;
}

export default async function downloadTemplate(selectedTemplate) {
  const { targetPath, template } = selectedTemplate;
  makeCacheDir(targetPath);
  const spinner = ora("正在下载模板...").start();
  try {
    await downloadAddTemplate(targetPath, template);
    spinner.stop();
    log.success("下载模板成功!!!");
  } catch (err) {
    spinner.stop();
    printErrorLog(err);
  }
}
