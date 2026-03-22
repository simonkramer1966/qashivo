// Add step7_status and step8_status columns to onboarding_progress table
const { Client } = require("pg");
require("dotenv").config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const statements = [
    `ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS step7_status varchar(20) NOT NULL DEFAULT 'NOT_STARTED'`,
    `ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS step8_status varchar(20) NOT NULL DEFAULT 'NOT_STARTED'`,
  ];

  for (const sql of statements) {
    try {
      await client.query(sql);
      console.log("OK:", sql.slice(0, 80));
    } catch (err) {
      console.error("ERR:", err.message);
    }
  }

  // Verify
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'onboarding_progress' AND column_name IN ('step7_status', 'step8_status') ORDER BY column_name`
  );
  console.log("\nVerified columns:", res.rows.map(r => r.column_name).join(", "));

  await client.end();
}

main().catch(console.error);
