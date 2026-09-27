import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

export function connect() {
  // Neon/Vercel provide a direct connection for long-running jobs; fall back to DATABASE_URL.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return postgres(url, { max: 4, onnotice: () => {} });
}
