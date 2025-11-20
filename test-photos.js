// Quick test script to check if photos are being saved
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-maintenance';

async function checkPhotos() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Ticket = mongoose.model('Ticket', new mongoose.Schema({
      ticketId: String,
      description: String,
      photos: [String],
      createdAt: Date,
    }));
    
    const tickets = await Ticket.find().sort({ createdAt: -1 }).limit(5);
    
    console.log('\n=== Recent Tickets ===');
    tickets.forEach(ticket => {
      console.log(`\nTicket: ${ticket.ticketId}`);
      console.log(`Description: ${ticket.description}`);
      console.log(`Photos: ${JSON.stringify(ticket.photos)}`);
      console.log(`Photos count: ${ticket.photos?.length || 0}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPhotos();
