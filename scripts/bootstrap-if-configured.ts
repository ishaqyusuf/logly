const email = process.env.LOGLY_OWNER_EMAIL?.trim();
const password = process.env.LOGLY_OWNER_PASSWORD?.trim();

if (Boolean(email) !== Boolean(password)) {
  throw new Error(
    "LOGLY_OWNER_EMAIL and LOGLY_OWNER_PASSWORD must be supplied together",
  );
}

if (!email || !password) {
  console.log("Owner bootstrap not configured; skipping.");
  process.exit(0);
}

const processHandle = Bun.spawn(
  ["bun", "--filter", "@logly/auth", "bootstrap:owner"],
  {
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);
const exitCode = await processHandle.exited;
if (exitCode !== 0) process.exit(exitCode);
