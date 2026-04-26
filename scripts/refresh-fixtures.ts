import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

interface Source {
  name: string;
  url: string;
  args: string[];
}

async function main() {
  const root = path.resolve("tests/fixtures/yt-dlp");
  const sourcesText = await fs.readFile(path.join(root, "sources.json"), "utf8");
  const { fixtures } = JSON.parse(sourcesText) as { fixtures: Source[] };
  for (const f of fixtures) {
    const args = [...f.args, f.url];
    process.stdout.write(`refreshing ${f.name}… `);
    const { stdout } = await execFileP("yt-dlp", args, { maxBuffer: 64 * 1024 * 1024 });
    const out = path.join(root, `${f.name}.json`);
    await fs.writeFile(out, stdout, "utf8");
    process.stdout.write("ok\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
