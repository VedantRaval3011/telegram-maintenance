const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function forceUpdateT7() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const uriMatch = envContent.match(/MONGODB_URI=(.+)/);
    const uri = uriMatch[1].trim();
    
    await mongoose.connect(uri);
    const Ticket = mongoose.model('Ticket', new mongoose.Schema({}, { strict: false }));

    const t7 = await Ticket.findOne({ ticketId: "T7" });
    if (!t7) {
      console.log("T7 not found");
      return;
    }

    console.log("Updating T7 with _id:", t7._id);
    
    const historyEntry = {
      reopenedAt: new Date(),
      reopenedBy: "FORCED_SCRIPT",
      reopenedReason: "Testing persistence from external script",
      previousStatus: t7.status,
      phaseDuration: 0
    };

    // Use Mongoose to update
    const result = await Ticket.updateOne(
      { _id: t7._id },
      { 
        $push: { reopenedHistory: historyEntry },
        $set: { status: "PENDING" }
      }
    );

    console.log("Mongoose Matched:", result.matchedCount, "Modified:", result.modifiedCount);

    const updated = await Ticket.findById(t7._id).lean();
    console.log("Updated T7 History:", JSON.stringify(updated.reopenedHistory, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

forceUpdateT7();
