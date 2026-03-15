import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { assertReadableFile } from "./config.mjs";

export async function buildCss(config) {
  await assertReadableFile(config.tailwindInputCss, "Tailwind input CSS");
  await mkdir(path.dirname(config.outputCssFile), { recursive: true });

  const result = spawnSync(
    "npx",
    [
      "@tailwindcss/cli",
      "-i",
      config.tailwindInputCss,
      "-o",
      config.outputCssFile,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(
      "Tailwind CSS build failed. Ensure @tailwindcss/cli is installed and TAILWIND_INPUT_CSS points to a valid file.",
    );
  }
}
