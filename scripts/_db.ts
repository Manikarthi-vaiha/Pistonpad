import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return postgres(url, { max: 4, onnotice: () => {} });
}
