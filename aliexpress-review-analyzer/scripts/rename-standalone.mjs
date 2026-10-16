// Gives the single-file build a friendly name for end users.
import { renameSync, existsSync, rmSync } from 'node:fs';
const from = 'release/index.html';
const to = 'release/AliExpress-Review-Analyzer.html';
if (!existsSync(from)) throw new Error(`${from} not found — did the standalone build run?`);
if (existsSync(to)) rmSync(to);
renameSync(from, to);
console.log(`Standalone app: ${to}`);
