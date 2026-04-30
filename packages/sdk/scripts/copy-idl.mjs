// Copies the freshly-built IDL and TS types from anchor/target/* into
// packages/sdk/src/{idl,types}/. Run on every build so the SDK can never
// drift from the on-chain program.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..", "..");
const targetIdl = join(repoRoot, "anchor", "target", "idl", "verdict.json");
const targetTypes = join(repoRoot, "anchor", "target", "types", "verdict.ts");

const sdkIdlDir = join(__dirname, "..", "src", "idl");
const sdkTypesDir = join(__dirname, "..", "src", "types");

if (!existsSync(targetIdl)) {
  console.error(
    `[copy-idl] ${targetIdl} not found. Run \`anchor build\` from the anchor/ directory first.`,
  );
  process.exit(1);
}
if (!existsSync(targetTypes)) {
  console.error(
    `[copy-idl] ${targetTypes} not found. Run \`anchor build\` first.`,
  );
  process.exit(1);
}

mkdirSync(sdkIdlDir, { recursive: true });
mkdirSync(sdkTypesDir, { recursive: true });
copyFileSync(targetIdl, join(sdkIdlDir, "verdict.json"));
copyFileSync(targetTypes, join(sdkTypesDir, "verdict.ts"));

console.log(`[copy-idl] copied verdict.json + verdict.ts from anchor/target/`);
