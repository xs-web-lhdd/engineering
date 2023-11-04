import path from "node:path";
import axios from "axios";
import { GitServer } from "./GitServer.js";
import { execa } from "execa";
import { pathExistsSync } from "path-exists";
import log from "../log.js";

const BASE_URL = "https://gitee.com/api/v5";

class Gitee extends GitServer {
  constructor() {
    super();
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    });

    this.service.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  get(url, params, headers = {}) {
    return this.service({
      url,
      params: {
        ...params,
        access_token: this.token,
      },
      method: "get",
      headers,
    });
  }

  post(url, data, headers) {
    return this.service({
      url,
      data: {
        ...data,
        access_token: this.token,
      },
      method: "post",
      headers,
    });
  }

  searchRepository(params) {
    return this.get("/search/repositories", params);
  }

  // example: https://gitee.com/api/v5/repos/liuzy1988/F_F/tags
  getTags(fullName) {
    return this.get(`/repos/${fullName}/tags`);
  }

  getRepoUrl(fullName) {
    return `https://gitee.com/${fullName}.git`;
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
    const projectPath = path.relative(cwd, projectName);
    if (pathExistsSync(projectPath)) {
      return execa("npm", ["install"], { cwd: projectPath });
    } else {
      log.warn(`安装依赖出错 ${projectPath} 不存在`);
    }
  }

  getUser() {
    return this.get("/user");
  }

  getOrg() {
    return this.get("/user/orgs");
  }

  createRepo(name) {
    if (this.own === "user")
      return this.post("/user/repos", { name }); // 创建用户仓库
    else return this.post(`/orgs/${this.login}/repos`, { name }); // 创建组织仓库
  }

  getRepoList() {
    // https://gitee.com/api/v5/user/repos
    return this.get("/user/repos");
  }
}

export default Gitee;
