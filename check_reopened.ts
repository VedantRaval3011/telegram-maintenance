import { connectToDB } from "./src/lib/mongodb";
import { Ticket } from "./src/models/Ticket";

async function checkReopened() {
  await connectToDB();
  const tickets = await Ticket.find({ "reopenedHistory.0": { $exists: true } });
  console.log(`Found ${tickets.length} reopened tickets`);
  tickets.forEach(t => {
    console.log(`Ticket ${t.ticketId}: History length = ${t.reopenedHistory.length}`);
    console.log(JSON.stringify(t.reopenedHistory, null, 2));
  });
  process.exit(0);
}

checkReopened();
