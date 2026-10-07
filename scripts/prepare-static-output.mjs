import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const exportDirectory = resolve("out");
const publishDirectory = resolve("dist");

await rm(publishDirectory, { recursive: true, force: true });
await cp(exportDirectory, publishDirectory, { recursive: true });
