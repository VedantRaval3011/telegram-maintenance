
const fs = require('fs');
const path = require('path');

function check() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log(".env.local NOT FOUND");
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const vars = ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_API_KEY', 'BUNNY_STORAGE_HOST', 'BUNNY_CDN_HOSTNAME'];
  vars.forEach(v => {
    const found = content.includes(v);
    console.log(`${v}: ${found ? "FOUND" : "MISSING"}`);
  });
}
check();
