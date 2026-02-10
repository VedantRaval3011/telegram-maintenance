const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function checkT7() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const uriMatch = envContent.match(/MONGODB_URI=(.+)/);
    const uri = uriMatch[1].trim();
    
    await mongoose.connect(uri);
    const Ticket = mongoose.model('Ticket', new mongoose.Schema({}, { strict: false }));

    const t7 = await Ticket.findOne({ ticketId: "T7" }).lean();
    console.log("T7 Current Status:", t7.status);
    console.log("T7 History Count:", t7.reopenedHistory ? t7.reopenedHistory.length : 0);
    if (t7.reopenedHistory && t7.reopenedHistory.length > 0) {
        console.log("Recent history entry:", t7.reopenedHistory[t7.reopenedHistory.length - 1]);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkT7();
