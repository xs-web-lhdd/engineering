import createInitCommand from "@liu/init";
import createInstallCommand from "@liu/install";
import createLintCommand from "@liu/lint";
import createCommitCommand from "@liu/commit";
import createCLI from "./createCli.js";
import "./exception.js";

export default function (args) {
  const program = createCLI();
  createInitCommand(program);
  createInstallCommand(program);
  createLintCommand(program);
  createCommitCommand(program)
  program.parse(process.argv);
}
