#!/usr/bin/env node
/**
 * Generate and set JWT keys for Convex Auth.
 * Run this once after setting up the Convex project:
 *   node scripts/setup-auth-keys.mjs
 */
import { generateKeyPairSync, createPublicKey } from "crypto";
import { execSync } from "child_process";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const keyObject = createPublicKey(publicKey);
const jwk = keyObject.export({ format: "jwk" });
jwk.alg = "RS256";
jwk.use = "sig";
jwk.kid = "convex-auth";
const jwks = JSON.stringify({ keys: [jwk] });

// Write to temp files, then set via CLI
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const keyFile = join(tmpdir(), "jwt-private-key.txt");
const jwksFile = join(tmpdir(), "jwks.txt");

writeFileSync(keyFile, privateKey);
writeFileSync(jwksFile, jwks);

try {
  // Use --value-file if supported, otherwise try direct
  execSync(`npx convex env set JWT_PRIVATE_KEY -- "$(cat ${keyFile})"`, {
    stdio: "inherit",
    shell: "/bin/bash",
  });
  execSync(`npx convex env set JWKS -- "$(cat ${jwksFile})"`, {
    stdio: "inherit",
    shell: "/bin/bash",
  });
  console.log("\n✅ JWT keys set successfully!");
} catch (e) {
  console.log("\nManual setup required. Set these environment variables:");
  console.log(`\nnpx convex env set JWT_PRIVATE_KEY '${privateKey.replace(/\n/g, "\\n")}'`);
  console.log(`\nnpx convex env set JWKS '${jwks}'`);
}

try {
  unlinkSync(keyFile);
  unlinkSync(jwksFile);
} catch {}
