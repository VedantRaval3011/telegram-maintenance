const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function debugWithEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const uriMatch = envContent.match(/MONGODB_URI=(.+)/);
    if (!uriMatch) {
      console.log("MONGODB_URI not found in .env.local");
      return;
    }
    const uri = uriMatch[1].trim();
    console.log("Connecting to DB from .env.local...");
    
    await mongoose.connect(uri);
    console.log("Connected to:", mongoose.connection.db.databaseName);

    const TicketSchema = new mongoose.Schema({}, { strict: false });
    const Ticket = mongoose.model('Ticket', TicketSchema);

    const t7 = await Ticket.findOne({ ticketId: "T7" }).lean();
    if (!t7) {
      console.log("T7 not found");
      return;
    }

    console.log("T7 Found. ReopenedHistory:", JSON.stringify(t7.reopenedHistory));
    
    // Check if there are ANY tickets with history
    const allWithHistory = await Ticket.find({ "reopenedHistory.0": { $exists: true } }).lean();
    console.log("Total tickets with history in DB:", allWithHistory.length);
    if (allWithHistory.length > 0) {
      console.log("Sample ID:", allWithHistory[0].ticketId);
    }

  } catch (err) {
    console.error("DEBUG ERROR:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

debugWithEnv();
