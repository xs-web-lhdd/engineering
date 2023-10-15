import path from "node:path";
import axios from "axios";
import { GitServer } from "./GitServer.js";
import { execa } from "execa";
import { pathExistsSync } from "path-exists";
import log from "../log.js";

const BASE_URL = "https://api.github.com";

class Github extends GitServer {
  constructor() {
    super();
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    });
    this.service.interceptors.request.use(
      (config) => {
        config.headers["Authorization"] = `Bearer ${this.token}`;
        config.headers["Accept"] = "application/vnd.github+json";

        return config;
      },
      (err) => {
        return Promise.reject(err);
      }
    );

    this.service.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (err) => {
        return Promise.reject(err);
      }
    );
  }

  get(url, params, headers) {
    return this.service({
      url,
      params,
      method: "get",
      headers,
    });
  }

  post() {}

  searchRepository(params) {
    return this.get("/search/repositories", params);
  }

  // https://api.github.com/repos/PanJiaChen/vue-element-admin/tags
  getTags(fullName) {
    return this.get(`/repos/${fullName}/tags`);
  }

  // https://github.com/PanJiaChen/vue-element-admin.git
  // git@github.com:PanJiaChen/vue-element-admin.git
  getRepoUrl(fullName) {
    // return `https://github.com/${fullName}.git`;
    return `git@github.com:${fullName}.git`;
  }

  cloneRepo(fullName, tag) {
    if (tag) {
      return execa("git", ["clone", this.getRepoUrl(fullName), "-b", tag]);
    } else {
      return execa("git", ["clone", this.getRepoUrl(fullName)]);
    }
  }

  async installDependencies(cwd, fullName) {
    const projectName = fullName.split("/")[1];
    const projectPath = path.resolve(cwd, projectName);
    const pkgPath = path.resolve(cwd, projectName, "package.json");
    console.log("install dependencies", projectPath);
    if (pathExistsSync(pkgPath)) {
      return execa("npm", ["install"], { cwd: projectPath, stdout: "inherit" });
    } else {
      log.warn(`安装依赖出错 ${projectPath} 不存在`);
      throw new Error(`安装依赖出错 ${projectPath} 不存在`);
    }
  }
}

export default Github;
