const mongoose = require('mongoose');
const uri = "mongodb+srv://vedant:vedant@cluster0.o2z7v.mongodb.net/telegram-maintenance?retryWrites=true&w=majority";

async function testCreateReopened() {
  try {
    await mongoose.connect(uri);
    const TicketSchema = new mongoose.Schema({
        ticketId: String,
        reopenedHistory: Array
    }, { strict: false });
    const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

    const ticketId = "T_DEBUG_" + Date.now();
    const ticket = new Ticket({
      ticketId,
      description: "Testing history persistence",
      status: "PENDING",
      reopenedHistory: [
        {
          reopenedAt: new Date(),
          reopenedBy: "SYSTEM_DEBUG",
          reopenedReason: "Testing if this field even saves",
          previousStatus: "COMPLETED",
          phaseDuration: 0
        }
      ]
    });

    const saved = await ticket.save();
    console.log("Saved Ticket IDs:", saved._id);
    console.log("Saved History:", JSON.stringify(saved.reopenedHistory, null, 2));
    
    const fetched = await Ticket.findById(saved._id).lean();
    console.log("Fetched History:", JSON.stringify(fetched.reopenedHistory, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testCreateReopened();
