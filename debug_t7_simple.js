const mongoose = require('mongoose');

// Define a minimal schema since we just want to read
const TicketSchema = new mongoose.Schema({
  ticketId: String,
  status: String,
  reopenedHistory: Array
}, { strict: false });

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

async function debugT7() {
  try {
    // Manually extract MONGO_URI if possible, or assume it's in process.env
    const uri = "mongodb+srv://vedant:vedant@cluster0.o2z7v.mongodb.net/telegram-maintenance?retryWrites=true&w=majority";
    await mongoose.connect(uri);
    const ticket = await Ticket.findOne({ ticketId: "T7" }).lean();
    console.log("DEBUG_START");
    console.log(JSON.stringify(ticket, null, 2));
    console.log("DEBUG_END");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

debugT7();
