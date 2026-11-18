
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(currentDir, "../.env");

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error("Failed to load API .env:", envResult.error.message);
} else {
  console.log("API environment loaded from:", envPath);
  console.log(
    "DEMO_LOGIN_ENABLED:",
    process.env.DEMO_LOGIN_ENABLED,
  );
}

const { app } = await import("./app.js");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Prohori API running at http://localhost:${PORT}`);
});
