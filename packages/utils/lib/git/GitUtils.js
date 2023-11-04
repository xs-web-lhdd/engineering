import { getGitOwn, getGitLogin } from "./GitServer.js";
import { makeList } from "../inquirer.js";
import log from "../log.js";

/**
 * 仓库类型选择，是 Github 的私人仓库还是组织仓库，是Gite的私人仓库还是组织仓库
 * @param {*} gitAPI 选择的代码托管平台（Github | Gitee）
 * @returns
 */
export async function initGitType(gitAPI) {
  // 去缓存中找
  let gitOwn = getGitOwn(); // 仓库类型 用户仓库/组织仓库
  let gitLogin = getGitLogin(); // 仓库登陆信息

  if (!gitLogin && !gitOwn) {
    // 获取用户信息 和 组织信息
    const user = await gitAPI.getUser();
    const org = await gitAPI.getOrg();
    if (!gitOwn) {
      gitOwn = await makeList({
        message: "请选择仓库类型：",
        choices: [
          { name: "User", value: "user" },
          { name: "Organization", value: "org" },
        ],
      });
      // 做缓存
      gitAPI.saveOwn(gitOwn);
    }
    log.verbose("gitOwn: ", gitOwn);

    if (gitOwn === "user") {
      gitLogin = user.login;
    } else {
      if (org.length > 0) {
        const orgList = org.map((item) => ({
          name: item.name || item.login,
          value: item.login,
        }));
        gitLogin = await makeList({
          message: "请选择组织",
          choices: orgList,
        });
      } else {
        log.warn("您的账户没有组织信息供您选择！请去添加组织后再来尝试！");
        throw new Error(
          "您的账户没有组织信息供您选择！请去添加组织后再来尝试！"
        );
      }
    }

    gitAPI.saveLogin(gitLogin);
  } else {
    // TODO: 在实例上保存信息
    gitAPI.saveOwn(gitOwn);
    gitAPI.saveLogin(gitLogin);
  }

  log.verbose("gitLogin: ", gitLogin);

  if (!gitLogin || !gitOwn) {
    throw new Error(
      "未获取到用户的 Git 登录信息，请使用 liu-cli commit --clear 清除缓存后重试！"
    );
  }

  return gitLogin;
}

export async function createRemoteRepo(gitAPI, name) {
  // log.info("开始创建仓库！");
  const repoList = await gitAPI.getRepoList();
  const repoNameList = repoList.map((item) => item.full_name.split("/")[1]);
  console.log(repoNameList, repoNameList.length, name);
  if (repoNameList.includes(name)) {
    log.warn(`${name} 已经存在！`);
    return null;
  }
  // const ret = await gitAPI.createRepo(name);
}
