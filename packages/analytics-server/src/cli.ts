#!/usr/bin/env node
/**
 * `logly-release`: record a deploy marker from CI or a `postbuild` script.
 *
 * Reads LOGLY_COLLECTOR_URL, LOGLY_PROJECT and LOGLY_SERVER_KEY, and the
 * release from Vercel / GitHub Actions variables or LOGLY_RELEASE_*.
 * Never fails the build unless `--strict` is passed.
 */
import { releaseFromEnvironment, sendRelease } from "./release.js";

const strict = process.argv.includes("--strict");

function finish(message: string, failed: boolean) {
  if (failed) console.warn(`logly-release: ${message}`);
  else console.log(`logly-release: ${message}`);
  if (failed && strict) process.exit(1);
}

async function main() {
  const env = process.env;
  const collectorUrl = env.LOGLY_COLLECTOR_URL;
  const project = env.LOGLY_PROJECT;
  const serverKey = env.LOGLY_SERVER_KEY;
  if (!collectorUrl || !project || !serverKey) {
    return finish(
      "skipped: set LOGLY_COLLECTOR_URL, LOGLY_PROJECT and LOGLY_SERVER_KEY",
      true,
    );
  }
  const release = releaseFromEnvironment(env);
  if (!release) {
    return finish(
      "skipped: no version (set LOGLY_RELEASE_VERSION) or a development build",
      false,
    );
  }
  try {
    const result = await sendRelease(
      { collectorUrl, project, serverKey },
      release,
    );
    finish(
      `${result.created ? "recorded" : "already recorded"} ${release.environment} ${release.version}`,
      false,
    );
  } catch (error) {
    finish(error instanceof Error ? error.message : "request failed", true);
  }
}

void main();
