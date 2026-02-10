const mongoose = require('mongoose');

const uri = "mongodb+srv://vedant:vedant@cluster0.o2z7v.mongodb.net/telegram-maintenance?retryWrites=true&w=majority";

async function forceReopenT7() {
  try {
    await mongoose.connect(uri);
    
    // Minimal schema
    const Ticket = mongoose.model('Ticket', new mongoose.Schema({}, { strict: false }));
    
    const ticket = await Ticket.findOne({ ticketId: "T7" });
    if (!ticket) {
      console.log("Ticket T7 not found");
      return;
    }
    
    console.log("Current T7 History:", ticket.reopenedHistory);
    
    ticket.reopenedHistory = [
      {
        reopenedAt: new Date(),
        reopenedBy: "Manual Fix",
        reopenedReason: "Forcing show in UI",
        previousStatus: "COMPLETED",
        phaseDuration: 0
      }
    ];
    ticket.status = "PENDING";
    
    await Ticket.updateOne({ _id: ticket._id }, { 
      $set: { 
        reopenedHistory: ticket.reopenedHistory,
        status: "PENDING"
      }
    });
    
    console.log("T7 updated successfully");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

forceReopenT7();
