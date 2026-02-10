const mongoose = require('mongoose');

// Correct URI from .env.local (double checked: cluster0.dhfzszh.mongodb.net)
const uri = "mongodb+srv://vedant:vedant@cluster0.dhfzszh.mongodb.net/v1";

async function deepDebug() {
  try {
    console.log("Connecting to:", uri);
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    const collection = db.collection('tickets');
    
    const t7 = await collection.findOne({ ticketId: "T7" });
    if (!t7) {
      console.log("T7 not found");
      return;
    }
    
    console.log("T7 Found. Current History Count:", t7.reopenedHistory ? t7.reopenedHistory.length : 0);

    const historyEntry = {
      reopenedAt: new Date(),
      reopenedBy: "DB_SCRIPT",
      reopenedReason: "Testing persistence",
      previousStatus: t7.status,
      phaseDuration: 0
    };

    const result = await collection.updateOne(
      { _id: t7._id },
      { 
        $push: { reopenedHistory: historyEntry },
        $set: { status: "PENDING" }
      }
    );

    console.log("Update result:", result.matchedCount, result.modifiedCount);

    const updated = await collection.findOne({ _id: t7._id });
    console.log("New history count:", updated.reopenedHistory ? updated.reopenedHistory.length : 0);

  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deepDebug();
