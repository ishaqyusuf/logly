import { getRequiredDatabase } from "@logly/db/client";
import { account, user } from "@logly/db/schema";
import { auth } from "../src/index";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const email = requiredEnv("LOGLY_OWNER_EMAIL").toLowerCase();
const password = requiredEnv("LOGLY_OWNER_PASSWORD");
const name = process.env.LOGLY_OWNER_NAME?.trim() || "Logly Owner";
const database = getRequiredDatabase();
const existingUsers = await database
  .select({ email: user.email, id: user.id, role: user.role })
  .from(user)
  .limit(2);

if (existingUsers.length > 0) {
  const existingOwner = existingUsers.find(
    (candidate) =>
      candidate.email.toLowerCase() === email &&
      candidate.role.split(",").includes("admin"),
  );
  if (existingOwner && existingUsers.length === 1) {
    const existingAccounts = await database
      .select({ providerId: account.providerId, userId: account.userId })
      .from(account);
    const hasCredential = existingAccounts.some(
      (candidate) =>
        candidate.userId === existingOwner.id &&
        candidate.providerId === "credential",
    );
    if (hasCredential) {
      console.log("Owner operator already exists; no changes made.");
      process.exit(0);
    }
    throw new Error(
      "Owner bootstrap refused because the existing owner has no credential account.",
    );
  }
  throw new Error(
    "Owner bootstrap refused because the database already contains a different user.",
  );
}

await auth.api.createUser({
  body: {
    email,
    name,
    password,
    role: "admin",
  },
});

console.log("Created the initial owner operator.");
