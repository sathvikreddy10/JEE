import { execSync } from "child_process";
execSync("npx prisma db push --accept-data-loss", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});
