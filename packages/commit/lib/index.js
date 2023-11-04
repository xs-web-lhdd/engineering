import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import simpleGit from "simple-git";
// npm 版本操作
import semver from "semver";
// homedir 拿到用户主目录
// import { homedir } from "node:os";
import Command from "@liu/command";
import {
  log,
  initGitServer,
  initGitType,
  clearCache,
  createRemoteRepo,
  makeInput,
  makeList,
} from "@liu/utils";

class CommitCommand extends Command {
  get command() {
    return "commit";
  }

  get description() {
    return "commit project";
  }

  get options() {
    return [
      ["-c, --clear", "清空缓存", false],
      ["-p, --publish", "发布", false],
    ];
  }

  async action([params]) {
    log.info("commit", params);
    if (params.clear) {
      // 指令包含 --clear 就 清空缓存信息
      clearCache();
    }
    await this.createRemoteRepo();
    await this.initLocal();
    await this.commit();
    if (params.publish) {
      await this.publish();
    }
  }

  // 阶段1：创建远程仓库 + 本地创建 .gitignore 文件
  async createRemoteRepo() {
    // 1、实例化Git对象
    this.gitAPI = await initGitServer();
    log.verbose("gitAPI", this.gitAPI);
    // 2、仓库类型选择
    await initGitType(this.gitAPI);
    // 3、创建仓库
    // 获取项目名称
    const dir = process.cwd();
    const pkg = fse.readJSONSync(path.resolve(dir, "package.json"));
    this.pkgName = pkg?.name;
    this.version = pkg?.version || "1.0.0";
    log.info(`正在创建名为 ${pkg.name} 的仓库...`);
    const ret = await createRemoteRepo(this.gitAPI, pkg.name);
    if (ret) {
      log.info(`创建名为 ${pkg.name} 的仓库成功~~~`);
    }
    // 4 生成 .gitignore
    const gitIgnorePath = path.resolve(dir, ".gitignore");
    if (!fs.existsSync(gitIgnorePath)) {
      log.info(".gitignore不存在,正在创建...");
      fs.writeFileSync(gitIgnorePath, "node_modules");
      log.success(".gitignore 创建成功~~~");
    }
  }

  // 阶段2: git本地初始化 + 实现代码同步
  async initLocal() {
    // 生成 git remote 地址
    const remoteUrl = this.gitAPI.getRepoUrl(
      `${this.gitAPI.login}/${this.pkgName}`
    );
    log.verbose("remoteUrl", remoteUrl);
    // 初始化 git 对象
    this.git = simpleGit(process.cwd());
    // 判断当前项目是否已经git初始化完毕 通过 .git 文件夹
    const gitDir = path.resolve(process.cwd(), ".git");
    if (!fs.existsSync(gitDir)) {
      // 实现git初始化
      await this.git.init();
      log.success("完成git初始化!");
    }
    // 获取所有的remotes
    const remotes = await this.git.getRemotes();
    if (!remotes.find((remote) => remote.name === "origin")) {
      await this.git.addRemote("origin", remoteUrl);
      log.success("添加 git remote: ", remoteUrl);
    }
    // 检查未提交代码
    await this.checkNotCommitted();
    // 检查是否存在远程master分支
    const tags = await this.git.listRemote(["--refs"]);
    log.verbose("远程分支: ", tags);
    if (tags.indexOf("refs/heads/master") >= 0) {
      // // 拉取远程master分支, 实现代码同步
      // await this.git.pull("origin", "master").catch((err) => {
      //   log.warn("git pull origin master", err.message);
      //   if (err.message.indexOf("couldn't find remote ref master") >= 0) {
      //     log.warn("获取远程[master]分支失败");
      //   }
      // });
      this.pullRemoteRepo("master", { "--allow-unrelated-histories": null });
    } else {
      // 推送代码到远程master分支
      await this.pushRemoteRepo("master");
    }
  }

  // 阶段3: 代码自动化提交 !很关键
  async commit() {
    // 1 自动生成版本号
    await this.getCorrectVersion();
    // 2 检查 stash 记录
    await this.checkStash();
    // 3 代码冲突检查
    await this.checkConflicted();
    // 4 自动提交未提交代码
    await this.checkNotCommitted();
    // 5 自动切换分支
    await this.checkoutBranch(this.branch);
    // 6 自动合并远程master和开发分支
    await this.pullRemoteMasterAndBranch();
    // 7 推送分支至远程开发分支
    await this.pushRemoteRepo(this.branch);
  }

  // 阶段4: 代码的发布
  async publish() {
    // 1 创建 Tag 推送到远程分支
    await this.checkTag();
    // 2 切换到 master 分支
    await this.checkoutBranch("master");
    // 3 代码合并
    await this.mergeBranchToMaster();
    // 4 推送到 master
    await this.pushRemoteRepo("master");
    // 5 删除本地分支
    await this.deleteLocalBranch();
    // 6 删除远程
    await this.deleteRemoteBranch();
  }

  async deleteRemoteBranch() {
    log.info("开始删除远程分支", this.branch);
    await this.git.push(["origin", "--delete", this.branch]);
    log.success("删除远程分支成功", this.branch);
  }

  async deleteLocalBranch() {
    log.info("开始删除本地分支", this.branch);
    await this.git.deleteLocalBranch(this.branch);
    log.success("删除本地分支成功", this.branch);
  }

  async mergeBranchToMaster() {
    log.info("开始合并代码", `[${this.branch}] -> [master]`);
    await this.git.mergeFromTo(this.branch, master);
    log.success("代码合并成功!", `[${this.branch}] -> [master]`);
  }

  async checkTag() {
    log.info("获取远程的 Tag 列表");
    const tag = `release/${this.version}`;
    const tagList = await this.getRemoteBranchList("release");
    if (tagList.includes(this.version)) {
      log.info("远程 tag 已存在", tag);
      await this.git.push(["origin", `:refs/tags/${tag}`]);
      log.success("远程 tag 已删除", tag);
    }
    const localTagList = await this.git.tags();
    if (localTagList.all.includes(tag)) {
      log.info("本地 tag 已存在", tag);
      await this.git.tag(["-d", tag]);
      log.success("本地 tag 已删除", tag);
    }
    log.info("本地添加 tag", tag);
    await this.git.addTag(tag);
    log.success("本地 tag 创建成功", tag);
    log.info("推送远程 tag", tag);
    await this.git.pushTags("origin");
    log.success("推送远程 tag 成功", tag);
  }

  async pushRemoteRepo(branchName) {
    log.info(`推送代码至远程 ${branchName} 分支...`);
    await this.git.push("origin", branchName);
    log.success("推送代码成功~~~");
  }

  async pullRemoteMasterAndBranch() {
    log.info(`合并 [master] -> [${this.branch}]`);
    await this.pullRemoteRepo("master");
    log.success("合并远程 [master] 分支成功");
    log.info("检查远程分支");
    const remoteBranchList = await this.getRemoteBranchList();
    if (remoteBranchList.indexOf(this.version) >= 0) {
      log.info(`合并 [${this.branch} -> ${this.branch}]`);
      await this.pullRemoteRepo(this.branch);
      log.success(`合并远程 [${this.branch}] 分支成功`);
      await this.checkConflicted();
    } else {
      log.success(`不存在远程分支 [${this.branch}]`);
    }
  }

  async pullRemoteRepo(branch = "master", option) {
    // 拉取远程master分支,实现代码同步
    log.info(`同步远程 [${branch}] 分支代码`);
    await this.git.pull("origin", branch, option).catch((err) => {
      log.error(`git pull origin ${branch}`, err.message);
      if (err.message.indexOf("couldn't find remote ref master") >= 0) {
        log.warn("获取远程[master]分支失败");
      }
      process.exit(0);
    });
  }

  async checkoutBranch(branchName) {
    // 拿到本地 branch
    const localBranchList = await this.git.branchLocal();
    if (localBranchList.all.indexOf(branchName) >= 0) {
      await this.git.checkout(branchName);
    } else {
      // 生成新分支并切换过去
      await this.git.checkoutLocalBranch(branchName);
    }
    log.success(`本地分支切换到 ${branchName}`);
  }

  async checkNotCommitted() {
    // 检查所有未提交的代码
    const status = await this.git.status();
    const { not_added, created, deleted, modified, renamed } = status;
    if (
      not_added.length > 0 ||
      created.length > 0 ||
      deleted.length > 0 ||
      modified.length > 0 ||
      renamed.length > 0
    ) {
      log.verbose("status: ", status);
      await this.git.add([
        ...not_added,
        ...created,
        ...deleted,
        ...modified,
        // TODO:
        ...renamed.map((item) => item.to),
      ]);
      let message;
      while (!message) {
        message = await makeInput({
          message: "请输入commit 信息:",
        });
      }
      await this.git.commit(message);
      log.success("本地 commit 提交成功~~~");
    }
  }

  async checkStash() {
    log.info("检查 stash 记录");
    const stashList = await this.git.stashList();
    // console.log(stashList);
    if (stashList.all.length > 0) {
      await this.git.stash(["pop"]);
      log.success("stash pop 成功!");
    }
  }

  async checkConflicted() {
    log.info("代码冲突检查");
    const status = await this.git.status();
    if (status.conflicted.length > 0) {
      throw new Error("当前代码存在冲突,请手动处理合并后再试!");
    }
    log.info("代码冲突检查通过");
  }

  async getCorrectVersion() {
    log.info("获取代码分支");
    const remoteBranchList = await this.getRemoteBranchList("release");
    let releaseVersion = null;
    if (remoteBranchList?.length > 0) {
      releaseVersion = remoteBranchList[0];
    }
    const devVersion = this.version;
    // console.log(remoteBranchList, releaseVersion, devVersion);
    if (!releaseVersion) {
      this.branch = `dev/${devVersion}`;
    } else if (semver.gte(devVersion, releaseVersion)) {
      log.info(
        `当前版本大于等于线上最新版本号: ${devVersion} >= ${releaseVersion}`
      );
      this.branch = `dev/${devVersion}`;
    } else {
      // 最关键的节点,升级版本号
      log.info(
        `当前线上版本号大于本地版本号: ${releaseVersion} > ${devVersion}`
      );
      const incType = await makeList({
        message: "自动升级版本号,请选择升级版本类型",
        defaultValue: "patch",
        choices: [
          {
            name: `小版本(${releaseVersion} -> ${semver.inc(
              releaseVersion,
              "patch"
            )})`,
            value: "patch",
          },
          {
            name: `中版本(${releaseVersion} -> ${semver.inc(
              releaseVersion,
              "minor"
            )})`,
            value: "minor",
          },
          {
            name: `大版本(${releaseVersion} -> ${semver.inc(
              releaseVersion,
              "major"
            )})`,
            value: "major",
          },
        ],
      });
      const incVersion = semver.inc(releaseVersion, incType);
      this.branch = `dev/${incVersion}`;
      this.version = incVersion;
      this.syncVersionToPackageJson();
    }
    log.success(`代码分支获取成功 ${this.branch}`);
  }

  syncVersionToPackageJson() {
    const dir = process.cwd();
    const pkgPath = path.resolve(dir, "package.json");
    const pkg = fse.readJSONSync(pkgPath);
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version;
      fse.writeJSONSync(pkgPath, pkg, { spaces: 2 });
    }
  }

  async getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(["--refs"]);
    let reg;
    if (type === "release") {
      // release/0.0.1
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g;
    } else {
      // dev/0.0.1
      reg = /.+?refs\/tags\/dev\/(\d+\.\d+\.\d+)/g;
    }
    return remoteList
      .split("\n")
      .map((item) => {
        const match = reg.exec(item);
        reg.lastIndex = 0;
        // 判断是否是一个有效的版本号
        if (match && semver.valid(match[1])) {
          return match[1];
        }
      })
      .filter((_) => _) // 将undefined的过滤掉
      .sort((a, b) => {
        // 从大到小的顺序
        console.log(a, b);
        if (semver.gte(a, b)) {
          if (a === b) return 0;
          return -1;
        }
      });
  }
}

// 工厂方法：
function Commit(instance) {
  return new CommitCommand(instance);
}

export default Commit;
