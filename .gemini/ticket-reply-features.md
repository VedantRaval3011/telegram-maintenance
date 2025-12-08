# Ticket Reply Features Implementation

## Overview
This document describes the implementation of reply-based ticket management features in the Telegram webhook.

## Features Implemented

### 1. ✅ Reopen Completed Tickets by Reply
**User Action:** Tag/reply to a completed ticket message and say `/open`

**How it works:**
- User replies to any ticket message (either the original ticket creation message or the completed ticket confirmation)
- System detects keywords: `/open`, `open`, `/reopen`, or `reopen`
- Finds the ticket by message ID
- Validates the ticket exists and is currently completed
- If already pending/open, sends a warning message
- If completed, reopens the ticket by:
  - Setting `status` to `"PENDING"`
  - Clearing `completedBy` and `completedAt` fields
  - Saving the changes
- Sends a detailed confirmation message showing:
  - Ticket ID
  - Description
  - Category
  - Location (or source/target for transfers)
  - Who reopened it

**Example:**
```
User: [replies to completed ticket] /open
Bot: 🔄 Ticket #TCK-123 Reopened

📝 Fix broken light
📂 Maintenance
📍 Building A → Floor 2 → Room 201

👤 Reopened by: john_doe
```

### 2. ✅ Mark Tickets as Completed by Reply (Text)
**User Action:** Tag/reply to a pending ticket and say "done", "fixed", "okay", "ok", "completed", or "resolved"

**How it works:**
- User replies to any ticket message with completion keywords
- System checks if message contains: "done", "ok", "okay", "completed", "fixed", or "resolved"
- Finds the ticket by message ID
- If ticket is not already completed:
  - Sets `status` to `"COMPLETED"`
  - Records `completedBy` (username or full name)
  - Records `completedAt` timestamp
  - Saves the changes
- Sends a confirmation message

**Example:**
```
User: [replies to ticket] done
Bot: ✅ Ticket #TCK-123 Completed

👤 Completed by: john_doe
```

### 3. ✅ Mark Tickets as Completed with Photo
**User Action:** Tag/reply to a pending ticket, upload a photo, and say "done" (or other completion keywords)

**How it works:**
- Same as #2, but also processes the attached photo
- Downloads the photo from Telegram
- Uploads it to Cloudinary/BunnyCDN
- Adds the photo URL to `ticket.completionPhotos` array
- Sends confirmation message mentioning the photo

**Example:**
```
User: [replies to ticket with photo] done
Bot: ✅ Ticket #TCK-123 Completed

👤 Completed by: john_doe
📸 After-fix photo attached
```

## Technical Details

### Code Location
File: `src/app/api/webhook/route.ts`

### Reply Handling Flow
1. **Line 1558-1563**: Check if message is a reply (`msg.reply_to_message`)
2. **Line 1562-1618**: Reopen ticket handler (NEW)
3. **Line 1620-1678**: Completion keyword handler (ENHANCED)
4. **Line 1564-1620**: Agency assignment handler (EXISTING)

### Database Updates

#### Reopening a Ticket
```typescript
ticket.status = "PENDING";
ticket.completedBy = null;
ticket.completedAt = null;
await ticket.save();
```

#### Completing a Ticket
```typescript
ticket.status = "COMPLETED";
ticket.completedBy = completedBy;
ticket.completedAt = new Date();
if (completionPhotoUrl) {
  ticket.completionPhotos.push(completionPhotoUrl);
}
await ticket.save();
```

### Message ID Lookup
The system finds tickets by checking both:
- `telegramMessageId`: The bot's confirmation message ID
- `originalMessageId`: The user's original ticket creation message ID

This allows users to reply to either message.

## Testing Scenarios

### Scenario 1: Reopen via Reply
1. Create a ticket
2. Complete it by replying "done"
3. Reply to the completed ticket with "/open"
4. ✅ Should see reopen confirmation
5. Check dashboard - ticket should be in PENDING status

### Scenario 2: Complete with Text
1. Create a ticket (should be PENDING)
2. Reply to the ticket with "done"
3. ✅ Should see completion confirmation
4. Check dashboard - ticket should be COMPLETED

### Scenario 3: Complete with Photo
1. Create a ticket (should be PENDING)
2. Reply to the ticket with a photo and caption "fixed"
3. ✅ Should see completion confirmation with photo mention
4. Check dashboard - ticket should have completion photo

### Scenario 4: Edge Cases
- Replying "/open" to already pending ticket → Warning message
- Replying "done" to already completed ticket → No action (check at line 1635)
- Replying to non-existent message → No action
- Photo upload fails → Still completes ticket, just no photo

## Keywords Reference

### Reopen Keywords
- `/open`
- `open`
- `/reopen`
- `reopen`

### Completion Keywords
- `done`
- `ok`
- `okay`
- `completed`
- `fixed`
- `resolved`

Note: The system uses `.includes()` for matching, so "It's done!" will also trigger completion.

## User Experience

### For Technicians/Staff
- Quick completion: Just reply "done" to mark work complete
- Photo proof: Upload before/after photos when completing
- Natural language: Use everyday words like "fixed", "okay", "done"

### For Supervisors
- Easy reopening: Tag completed tickets and say "/open" to reopen
- Clear confirmations: Every action gets a detailed confirmation message
- Full context: Reopen message shows all ticket details

## Security Considerations
- Username/name is captured for audit trail
- Completion timestamp is recorded
- All actions are logged in the database
- Only works in group/supergroup chats (not private chats)
