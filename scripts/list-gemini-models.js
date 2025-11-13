// Simple helper to list models from Google Generative AI for debugging
// Usage: node scripts/list-gemini-models.js

import { GoogleGenerativeAI } from '@google/generative-ai';

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY not set in environment');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(key);
  try {
    const resp = await genAI.listModels();
    console.log('listModels response:');
    console.log(JSON.stringify(resp, null, 2));
  } catch (err) {
    console.error('listModels failed:', err && (err.message || err));
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
