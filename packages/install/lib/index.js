import ora from "ora";
import Command from "@liu/command";
import {
  log,
  Github,
  makeList,
  getGitPlatform,
  Gitee,
  makeInput,
} from "@liu/utils";

const PREV_PAGE = "${prev_page}";
const NEXT_PAGE = "${next_page}";
const PREV_TAG = "${prev_tag}";
const NEXT_TAG = "${next_tag}";

class InstallCommand extends Command {
  get command() {
    return "install";
  }

  get description() {
    return "install project";
  }

  get options() {
    return [];
  }

  async action([name, opts]) {
    await this.generateGitAPI();
    await this.searchGitAPI();
    await this.selectTags();
    log.verbose("full_name", this.keyword);
    log.verbose("tag", this.selectedTag);
    await this.downloadRepo();
    await this.installDependencies();
    await this.runRepo();
  }

  async runRepo() {
    this.keyword = "111/vue-cesium";
    await this.gitAPI.runRepo(process.cwd(), this.keyword);
  }

  async downloadRepo() {
    const spinner = ora(`正在下载${this.keyword}(${this.selectedTag})`).start();
    try {
      await this.gitAPI.cloneRepo(this.keyword, this.selectedTag);
      spinner.stop();
      log.success(`下载成功！${this.keyword}(${this.selectedTag})`);
    } catch (error) {
      spinner.stop();
      log.warn("clone 仓库出错误！", error.message);
    }
  }

  async installDependencies() {
    const spinner = ora(
      `正在安装依赖：${this.keyword}(${this.selectedTag})`
    ).start();
    try {
      await this.gitAPI.installDependencies(process.cwd(), this.keyword);
      spinner.stop();
      log.success(`安装依赖成功！${this.keyword}(${this.selectedTag}`);
    } catch (error) {
      spinner.stop();
      log.warn("安装依赖失败, 请尝试手动安装依赖！");
    }
  }

  async generateGitAPI() {
    let platform = getGitPlatform();
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
    this.gitAPI = gitAPI;
  }

  async searchGitAPI() {
    // 1、收集搜索关键词和开发语言
    const q = await makeInput({
      message: "请输入搜索关键词",
      validate(v) {
        if (v.length > 0) return true;
        else return "搜索关键词必须输入";
      },
    });
    const language = await makeInput({
      message: "请输入开发语言（Java、JavaScript、HTML）",
    });
    this.q = q;
    this.language = language;
    this.page = 1;
    this.perPage = 10;
    await this.doSearch();
  }

  async doSearch() {
    const platform = this.gitAPI.getPlatform();
    let params;
    let searchResult;
    let count;
    let list;
    let totalCount;
    // 2、根据不同平台生成不同搜索参数
    if (platform === "github") {
      params = {
        // 三元运算符的优先级小于二元
        q: q + (language ? `+language:${language}` : ""),
        order: "desc",
        sort: "stars",
        per_page: 10,
        page: this.page,
      };
    } else {
      // Gitee
      params = {
        q: this.q,
        // language,
        order: "desc",
        // sort: "stars_count",
        per_page: this.perPage,
        page: this.page,
      };
      log.verbose("search params", params);

      try {
        searchResult = await this.gitAPI.searchRepository(params);
      } catch (error) {
        log.warn("searchRepository error", error.message);
      }

      log.verbose(`searchResult from ${platform}`, searchResult);

      count = searchResult.length; // 当前页数据量
      totalCount = 999;
      list = searchResult.map((item) => ({
        name: `${item.description.slice(0, 20)}`,
        value: item.full_name,
      }));

      // 判断当前页数是否到达最大页
      if (this.page * this.perPage < totalCount) {
        list.push({
          name: "下一页",
          value: NEXT_PAGE,
        });
      }
      if (this.page > 1) {
        list.unshift({
          name: "上一页",
          value: PREV_PAGE,
        });
      }
    }

    if (count > 0) {
      const keyword = await makeList({
        message:
          platform === "github"
            ? `请选择要下载的项目(共${count}条数据)`
            : "请选择要下载的项目",
        choices: list,
      });

      log.verbose("您选择下载的项目为：", keyword);

      if (keyword === NEXT_PAGE) {
        await this.nextPage();
      } else if (keyword === PREV_PAGE) {
        await this.prevPage();
      } else {
        log.verbose("下载项目....");
        // 下载项目
        this.keyword = keyword;
      }
    }
  }

  async nextPage() {
    this.page++;
    await this.doSearch();
  }

  async prevPage() {
    this.page--;
    await this.doSearch();
  }

  async doSelectTags() {
    const platform = this.gitAPI.getPlatform();
    let tagsListChoices = [];
    if (platform === "github") {
    } else {
      const tagsList = await this.gitAPI.getTags(this.keyword);
      tagsListChoices = tagsList.map((item) => ({
        name: item.name,
        value: item.name,
      }));

      // TODO: tag 不做分页了
      // 判断当前页数是否到达最大页
      // if (this.tagPage * this.tagPerPage < tagsList.length) {
      //   tagsListChoices.push({
      //     name: "下一页",
      //     value: NEXT_TAG,
      //   });
      // }
      // if (this.tagPage > 1) {
      //   tagsListChoices.unshift({
      //     name: "上一页",
      //     value: PREV_TAG,
      //   });
      // }

      if (tagsList.length > 0) {
        const selectedTag = await makeList({
          message: "请选择 tag",
          choices: tagsListChoices,
        });

        log.verbose("您选择的 tag 是：", selectedTag);

        if (selectedTag === NEXT_TAG) {
          await this.nextTag();
        } else if (selectedTag === PREV_TAG) {
          await this.prevTag();
        } else {
          // 下载tag
          this.selectedTag = selectedTag;
        }
      }
    }
  }

  async selectTags() {
    let tagsList;
    this.tagPage = 1;
    this.tagPerPage = 10;
    if (this.gitAPI.getPlatform() === "github") {
    } else {
      // gitee 查询 tags
      tagsList = await this.doSelectTags();
    }
  }

  async nextTag() {
    this.tagPage++;
    this.doSelectTags();
  }

  async prevTag() {
    this.tagPage--;
    this.doSelectTags();
  }
}

function Install(instance) {
  return new InstallCommand(instance);
}

export default Install;
