import { connectToDB } from "./src/lib/mongodb";
import { Ticket } from "./src/models/Ticket";

async function debugT7() {
  await connectToDB();
  const ticket = await Ticket.findOne({ ticketId: "T7" }).lean();
  console.log("T7 Data:", JSON.stringify(ticket, null, 2));
  process.exit(0);
}

debugT7();
