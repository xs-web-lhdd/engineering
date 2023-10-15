import createInitCommand from "@liu/init";
import createInstallCommand from "@liu/install";
import createLintCommand from "@liu/lint";
import createCLI from "./createCli.js";
import "./exception.js";

export default function(args) {
  const program = createCLI();
  createInitCommand(program);
  createInstallCommand(program);
  createLintCommand(program);
  program.parse(process.argv);
}
