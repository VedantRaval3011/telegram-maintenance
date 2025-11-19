// scripts/setWebhook.ts
import fetch from "node-fetch";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL!;

if (!TOKEN || !WEBHOOK_URL) {
  console.error(
    "Please set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_URL env variables"
  );
  process.exit(1);
}

async function setWebhook() {
  const res = await fetch(
    `https://api.telegram.org/bot${TOKEN}/setWebhook?url=${encodeURIComponent(
      WEBHOOK_URL
    )}`
  );
  const data = await res.json();
  console.log(data);
}

setWebhook().catch((err) => console.error(err));
