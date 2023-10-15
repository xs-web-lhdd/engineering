import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";
import { pathExistsSync } from "path-exists";
import fse from "fs-extra";
import { execa } from "execa";
import { log, makePassword } from "../index.js";

const TEMP_HOME = ".cli-liu";
const TEMP_TOKEN = ".token";
const TEMP_PLATFORM = ".git_platform";

function createTokenPath() {
  return path.resolve(homedir(), TEMP_HOME, TEMP_TOKEN);
}

function createPlatformPath() {
  return path.resolve(homedir(), TEMP_HOME, TEMP_PLATFORM);
}

function getGitPlatform() {
  if (pathExistsSync(createPlatformPath())) {
    return fs.readFileSync(createPlatformPath()).toString();
  }
  return null;
}

function getProjectPath(cwd, fullName) {
  const projectName = fullName.split("/")[1];
  return path.resolve(cwd, projectName);
}

function getPackageJson(projectPath) {
  const pkgPath = path.resolve(projectPath, "package.json");
  console.log("pkgPath", pkgPath, pathExistsSync(pkgPath));
  if (pathExistsSync(pkgPath)) {
    return JSON.parse(fse.readFileSync(pkgPath).toString());
  } else return null;
}

class GitServer {
  constructor() {}

  async init() {
    // 判断 token 是否录入
    const tokenPath = createTokenPath();
    if (pathExistsSync(tokenPath)) {
      this.token = fse.readFileSync(tokenPath).toString();
    } else {
      // 进入 token 录入流程
      this.token = await this.getToken();
      fs.writeFileSync(tokenPath, this.token);
    }
    log.verbose("token", this.token);
    log.verbose("token path", tokenPath, pathExistsSync(tokenPath));
  }

  getToken() {
    return makePassword({
      message: "请输入 token 信息：",
    });
  }

  getPlatform() {
    return this.platform;
  }

  savePlatform(platform) {
    this.platform = platform;
    fs.writeFileSync(createPlatformPath(), platform);
  }

  async runRepo(cwd, fullName) {
    const projectPath = getProjectPath(cwd, fullName);
    const pkg = getPackageJson(projectPath);
    console.log("pkg", pkg);
    if (pkg) {
      const { scripts, bin, name } = pkg;
      console.log("scripts, bin, name ---->>>>", scripts, bin, name);
      if (bin) {
        await execa("npm", ["install", "-g", name], {
          cwd: projectPath,
          stdout: "inherit",
        });
      }
      if (scripts && scripts.dev) {
        return execa("npm", ["run", "dev"], {
          cwd: projectPath,
          stdout: "inherit",
        });
      } else if (scripts && scripts.start) {
        return execa("npm", ["run", "start"], {
          cwd: projectPath,
          stdout: "inherit",
        });
      } else {
        log.warn("未找到启动信息！");
      }
    } else {
      // 无 pkg
      log.warn("此项目根目录下无 package.json 请手动查看此项目");
    }
  }
}

export { GitServer, getGitPlatform };
