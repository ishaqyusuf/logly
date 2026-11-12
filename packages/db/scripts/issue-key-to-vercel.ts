#!/usr/bin/env bun
/**
 * Issue a new Logly project credential (or a random secret) and hand it
 * straight to a Vercel environment variable or the macOS clipboard. The value
 * is never printed, logged or written to disk; only its SHA-256 hash is stored
 * in Logly, matching packages/db credential storage (additive reissue, ADR 0010).
 *
 * Project key into Vercel (run from packages/db):
 *   bun --env-file=../../.env.production scripts/issue-key-to-vercel.ts \
 *     --project ewatrade-dashboard --scope read \
 *     --env EWATRADE_DASHBOARD_LOGLY_READ_KEY --vercel-dir ../../../oversight
 * Project key to the clipboard (e.g. for Trigger.dev): replace --vercel-dir with --clipboard.
 * Random secret, no database: --secret --env LOGLY_IDENTITY_SECRET --vercel-dir <dir>
 *
 * Interactive confirmation is required. If the Vercel write fails, the newly
 * issued key is revoked so no unused active credential is left behind.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import postgres from "postgres";

const scopes = {
  "client-ingest": "logly_ci",
  "server-write": "logly_sw",
  read: "logly_rd",
} as const;
type Scope = keyof typeof scopes;

function arg(name: string) {
  const index = Bun.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : Bun.argv[index + 1];
}
const flag = (name: string) => Bun.argv.includes(`--${name}`);

const secretMode = flag("secret");
const project = arg("project");
const scope = arg("scope") as Scope | undefined;
const envName = arg("env");
const vercelDir = arg("vercel-dir");
const target = arg("target") ?? "production";
const clipboard = flag("clipboard");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!envName || !/^[A-Z][A-Z0-9_]{2,80}$/.test(envName))
  fail("--env must be an UPPER_SNAKE_CASE variable name.");
if (Boolean(vercelDir) === clipboard)
  fail(
    "Choose exactly one destination: --vercel-dir <linked dir> or --clipboard.",
  );
if (!["production", "preview"].includes(target))
  fail("--target must be production or preview.");
if (vercelDir && !existsSync(resolve(vercelDir, ".vercel/project.json")))
  fail(
    `${vercelDir} is not linked to a Vercel project (.vercel/project.json missing).`,
  );
if (!secretMode) {
  if (!project || !/^[a-z0-9-]{2,80}$/.test(project))
    fail("--project must be a Logly project slug.");
  if (!scope || !(scope in scopes))
    fail(`--scope must be one of ${Object.keys(scopes).join(", ")}.`);
}

async function confirm(summary: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    fail("This command needs an interactive terminal to confirm.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${summary}\nType "issue" to continue: `);
    if (answer.trim() !== "issue") fail("Cancelled; nothing was changed.");
  } finally {
    rl.close();
  }
}

async function deliver(value: string) {
  if (clipboard) {
    const copy = Bun.spawn(["pbcopy"], { stdin: "pipe" });
    copy.stdin.write(value);
    copy.stdin.end();
    if ((await copy.exited) !== 0) throw new Error("pbcopy failed");
    return `copied to the clipboard; paste it as ${envName} and then clear the clipboard`;
  }
  const add = Bun.spawn(
    ["vercel", "env", "add", envName as string, target, "--sensitive"],
    {
      cwd: resolve(vercelDir as string),
      stdin: "pipe",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  add.stdin.write(value);
  add.stdin.end();
  if ((await add.exited) !== 0) throw new Error("vercel env add failed");
  const linked = await Bun.file(
    resolve(vercelDir as string, ".vercel/project.json"),
  ).json();
  return `stored as sensitive ${target} variable ${envName} on Vercel project ${linked.projectName ?? linked.projectId}`;
}

if (secretMode) {
  await confirm(
    `Generate a random 48-byte secret for ${envName} (${clipboard ? "clipboard" : `Vercel ${target}, ${vercelDir}`}).`,
  );
  console.log(`Done: ${await deliver(randomBytes(48).toString("base64url"))}.`);
  process.exit(0);
}

const databaseUrl = process.env.LOGLY_DATABASE_URL;
if (!databaseUrl) fail("LOGLY_DATABASE_URL is not set (use --env-file).");
const host = new URL(databaseUrl).hostname;
const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require" });

try {
  const [row] = await sql<{ id: string; name: string; organization: string }[]>`
    select p.id, p.name, o.slug as organization
    from analytics_projects p
    join analytics_organizations o on o.id = p.organization_id
    where p.slug = ${project as string} and p.enabled = true`;
  if (!row) fail(`No enabled Logly project "${project}" on ${host}.`);

  await confirm(
    `Issue a new ${scope} key for ${row.organization}/${project} on ${host}\n` +
      `and send it to ${clipboard ? "the clipboard" : `Vercel ${target} (${vercelDir})`} as ${envName}.`,
  );

  const value = `${scopes[scope as Scope]}_${randomBytes(24).toString("base64url")}`;
  const [key] = await sql<{ id: string }[]>`
    insert into analytics_project_keys (project_id, name, scope, key_hash)
    values (${row.id}, ${`${row.name} ${scope} (${envName})`}, ${scope as Scope},
            ${createHash("sha256").update(value).digest("hex")})
    returning id`;
  try {
    console.log(`Done: issued key ${key.id}; ${await deliver(value)}.`);
  } catch (error) {
    await sql`update analytics_project_keys set revoked_at = now() where id = ${key.id}`;
    fail(`${(error as Error).message}; the new key ${key.id} was revoked.`);
  }
} finally {
  await sql.end();
}
