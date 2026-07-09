import pc from "picocolors";

export function logInfo(msg: string): void {
  console.log(pc.blue("ℹ"), msg);
}

export function logSuccess(msg: string): void {
  console.log(pc.green("✔"), msg);
}

export function logWarn(msg: string): void {
  console.log(pc.yellow("⚠"), msg);
}

export function logError(msg: string): void {
  console.log(pc.red("✖"), msg);
}
