import path from "node:path";
import { ESLint } from "eslint";
import { execa } from "execa";
import { pathExistsSync } from "path-exists";
import fse from "fs-extra";
import Command from "@liu/command";
import { log } from "@liu/utils";
// 通过 package.json 中是否安装 vue 或者 react 来区分这个项目是一个 vue项目还是react项目,分别对应加载vueConfig和reactConfig
import vueConfig from "./eslint/vueConfig.js";
import reactConfig from "./eslint/reactConfig.js";

class LintCommand extends Command {
  get command() {
    return "lint";
  }

  get description() {
    return "lint project";
  }

  get options() {
    return [];
  }

  async action() {
    log.verbose("lint");
    const frame = this.getFrameName();
    if (frame === null) return;
    // 1、eslint react/vue项目
    // 准备工作,安装依赖
    await execa(
      "npm",
      [
        "install",
        "-D",
        `${frame === "vue" ? "eslint-plugin-vue" : "eslint-plugin-react"}`,
      ],
      {
        stdout: "inherit",
      }
    );
    await execa("npm", ["install", "-D", "eslint-config-airbnb-base"], {
      stdout: "inherit",
    });
    log.info("正在执行 eslint 检查");
    // 执行工作,执行eslint
    const cwd = process.cwd();
    const eslint = new ESLint({
      cwd,
      // reactConfig 覆盖项目中的 eslint.js
      overrideConfig: frame === "vue" ? vueConfig : reactConfig,
    });

    const vueLintFiles = ["src/**/*.vue"];
    const reactLintFiles = ["src/**/*.jsx"];
    const lintFiles = frame === "vue" ? vueLintFiles : reactLintFiles;

    const results = await eslint.lintFiles(["src/**/*.js", ...lintFiles]);
    const formatter = await eslint.loadFormatter("stylish");
    const resultText = formatter.format(results);

    const eslintResult = this.parseESLint(resultText);
    log.verbose("eslintResult", eslintResult);
    log.success(
      "eslint 检查完毕!",
      `错误: ${eslintResult.errors}, 警告: ${eslintResult.warnings}`
    );
    // 2、jest/mocha
    log.verbose("jest/mocha 这块先不写哈!");
  }

  extractESLint(resultText, type) {
    const problems = /[0-9]+ problems/;
    const warnings = /([0-9]+) warnings/;
    const errors = /([0-9]+) errors/;
    switch (type) {
      case "problems":
        return resultText.match(problems)[0].match(/[0-9]+/)[0];
      case "warnings":
        return resultText.match(warnings)[0].match(/[0-9]+/)[0];
      case "errors":
        return resultText.match(errors)[0].match(/[0-9]+/)[0];
    }
  }

  parseESLint(resultText) {
    const problems = this.extractESLint(resultText, "problems");
    const errors = this.extractESLint(resultText, "errors");
    const warnings = this.extractESLint(resultText, "warnings");
    return {
      problems: +problems || 0,
      errors: +errors || 0,
      warnings: +warnings || 0,
    };
  }

  getFrameName() {
    const cwd = process.cwd();
    const pkgPath = path.resolve(cwd, "package.json");
    if (!pathExistsSync(pkgPath)) {
      log.warn(`${cwd} 下 package.json 不存在`);
      return null;
    }
    const pkg = JSON.parse(fse.readFileSync(pkgPath).toString());
    const { dependencies } = pkg;
    console.log(pkg);
    if (dependencies && dependencies.vue) {
      log.info("此项目使用的是 react 框架");
      return "vue";
    } else if (dependencies && dependencies.react) {
      log.info("此项目使用的是 vue 框架");
      return "react";
    } else {
      log.warn("该项目既不是 vue 项目也不是 react 项目");
      return null;
    }
  }
}

// 工厂方法：
function Lint(instance) {
  return new LintCommand(instance);
}

export default Lint;
