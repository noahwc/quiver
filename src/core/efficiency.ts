import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generateEfficiencyMd(projectDir: string): Promise<void> {
  const templatePath = path.resolve(__dirname, "../../templates/efficiency.md");
  const template = await fs.readFile(templatePath, "utf-8");
  const outputPath = path.resolve(projectDir, "EFFICIENCY.md");
  await fs.writeFile(outputPath, template, "utf-8");
}
