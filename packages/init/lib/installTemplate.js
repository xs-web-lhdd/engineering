import path from "node:path";
import fse from "fs-extra";
import { pathExistsSync } from "path-exists";
import ora from "ora";
import ejs from "ejs";
import glob from "glob";
import { log, printErrorLog, makeInput, makeList } from "@liu/utils";

function getCacheFilePath(targetPath, template) {
  return path.resolve(targetPath, "node_modules", template.npmName, "template");
}

function getPluginFilePath(targetPath, template) {
  return path.resolve(
    targetPath,
    "node_modules",
    template.npmName,
    "plugins",
    "index.js"
  );
}

// 将模板文件拷贝到目标文件夹下面
function copyFile(targetPath, template, installDir) {
  const originFile = getCacheFilePath(targetPath, template);
  // console.log(pathExistsSync(originFile));
  const fileList = fse.readdirSync(originFile);
  // console.log(fileList);
  const spinner = ora("正在拷贝模板文件").start();
  fileList.map((file) => {
    fse.copySync(`${originFile}/${file}`, `${installDir}/${file}`);
  });
  spinner.stop();
  log.success("模板拷贝成功！");
}

async function ejsRender(targetPath, installDir, template, name) {
  log.verbose("ejsRender", installDir, template);
  const { ignore } = template;
  // 执行插件
  let data = {};
  const pluginPath = getPluginFilePath(targetPath, template);
  console.log(pluginPath);
  if (pathExistsSync(pluginPath)) {
    const pluginFn = (await import("file:///" + pluginPath)).default;
    const api = {
      makeList,
      makeInput,
    };
    data = await pluginFn(api);
    log.verbose("plugin data", data);
  } else {
    throw new Error("插件地址不存在或者不正确");
  }
  const ejsData = {
    data: {
      name,
      ...data,
    },
  };
  glob(
    "**",
    {
      cwd: installDir,
      nodir: true,
      ignore: [...ignore, "**/node_modules/**"],
    },
    (err, files) => {
      files.forEach((file) => {
        const filePath = path.join(installDir, file);
        // console.log(filePath);
        ejs.renderFile(filePath, ejsData, (err, result) => {
          // console.log("err result:", result);
          if (!err) {
            fse.writeFileSync(filePath, result);
          } else {
            printErrorLog(err);
          }
        });
      });
    }
  );
}

export default async function installTemplate(selectedTemplate, opts) {
  const { force = false } = opts;
  const { targetPath, name, template } = selectedTemplate;
  const rootDir = process.cwd();
  fse.ensureDirSync(targetPath);
  const installDir = path.resolve(`${rootDir}/${name}`);
  if (pathExistsSync(installDir)) {
    if (!force) {
      log.error(`当前目录下已经存在 ${installDir} 文件夹`);
      return;
    } else {
      fse.removeSync(installDir);
      fse.ensureDirSync(installDir);
    }
  } else {
    fse.ensureDirSync(installDir);
  }
  copyFile(targetPath, template, installDir);
  await ejsRender(targetPath, installDir, template, selectedTemplate.name);
}
