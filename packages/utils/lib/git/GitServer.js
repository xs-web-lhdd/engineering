import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";
import { pathExistsSync } from "path-exists";
import fse from "fs-extra";
import { execa } from "execa";
import { log, makePassword, Gitee, Github, makeList } from "../index.js";

const TEMP_HOME = ".cli-liu";
const TEMP_TOKEN = ".git_token";
const TEMP_PLATFORM = ".git_platform";
const TEMP_OWN = ".git_own";
const TEMP_LOGIN = ".git_login";

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

function clearCache() {
  const platform = path.resolve(homedir(), TEMP_HOME, TEMP_PLATFORM);
  const token = path.resolve(homedir(), TEMP_HOME, TEMP_TOKEN);
  const own = createOwnPath();
  const login = createLoginPath();
  if (pathExistsSync(platform)) fse.removeSync(platform);
  if (pathExistsSync(token)) fse.removeSync(token);
  if (pathExistsSync(own)) fse.removeSync(own);
  if (pathExistsSync(login)) fse.removeSync(login);
}

function createOwnPath() {
  return path.resolve(homedir(), TEMP_HOME, TEMP_OWN);
}

function createLoginPath() {
  return path.resolve(homedir(), TEMP_HOME, TEMP_LOGIN);
}

function getGitOwn() {
  if (pathExistsSync(createOwnPath())) {
    return fs.readFileSync(createOwnPath()).toString();
  }
  return null;
}

function getGitLogin() {
  if (pathExistsSync(createLoginPath())) {
    return fs.readFileSync(createLoginPath()).toString();
  }
  return null;
}

async function initGitServer() {
  let platform = getGitPlatform();
  log.verbose("platform", platform);
  if (!platform) {
    platform = await makeList({
      message: "请选择Git平台",
      choices: [
        {
          name: "Github",
          value: "github",
        },
        {
          name: "Gitee",
          value: "gitee",
        },
      ],
    });
  }
  log.verbose("platform", platform);
  let gitAPI;
  if (platform === "github") {
    gitAPI = new Github();
  } else {
    gitAPI = new Gitee();
  }
  gitAPI.savePlatform(platform);
  await gitAPI.init(platform);
  return gitAPI;
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

  saveOwn(own) {
    this.own = own;
    fs.writeFileSync(createOwnPath(), own);
  }

  saveLogin(login) {
    this.login = login;
    fs.writeFileSync(createLoginPath(), login);
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

  getUser() {
    throw new Error("getUser 此方法必须被子类实现！");
  }
}

export {
  GitServer,
  getGitPlatform,
  initGitServer,
  clearCache,
  getGitOwn,
  getGitLogin,
};
