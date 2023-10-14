import createInitCommand from "@liu/init";
import createInstallCommand from "@liu/install";
import createCLI from "./createCli.js";
import "./exception.js";

export default function (args) {
  const program = createCLI();
  createInitCommand(program);
  createInstallCommand(program);
  program.parse(process.argv);
}
