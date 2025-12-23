# Debugging Guide: Photo & Description Tracking

## Overview
Added comprehensive logging to track photos and descriptions throughout the ticket lifecycle.

## Log Points Added

### 1. **New Ticket Creation**
**Location**: When a new wizard session is created from a photo/message

**Log Format**:
```
[NEW TICKET] Creating wizard session: {
  description: "Photo attachment" | "Video attachment" | "New Ticket" | <user text>,
  photoUrl: <cloudinary URL or null>,
  videoUrl: <cloudinary URL or null>,
  photosCount: 0 | 1,
  videosCount: 0 | 1
}
```

**What to check**:
- Is `photoUrl` populated when a photo is sent?
- Is `photosCount` = 1 when a photo is attached?

---

### 2. **Ticket Submission**
**Location**: When the wizard is submitted and ticket is created in database

**Log Format**:
```
[CREATE TICKET] Creating T123: {
  description: <session description>,
  photosCount: <number of photos>,
  videosCount: <number of videos>,
  photos: [<array of photo URLs>]
}

[CREATE TICKET] Created T123 in DB: {
  description: <final description>,
  photosCount: <number of photos>,
  videosCount: <number of videos>
}
```

**What to check**:
- Does the session have photos before creating the ticket?
- Are photos successfully saved to the database?
- Is there a mismatch between session photos and DB photos?

---

### 3. **Edit Start**
**Location**: When `/edit T123` command is issued

**Log Format**:
```
[EDIT START] Ticket T123 original data: {
  description: <current description>,
  photosCount: <number of photos>,
  videosCount: <number of videos>,
  photos: [<array of photo URLs>]
}
```

**What to check**:
- Does the ticket in the database have photos?
- Is the description correct?

---

### 4. **Edit Session Creation**
**Location**: When the edit wizard session is created

**Log Format**:
```
[EDIT SESSION] Created edit session for T123: {
  isPartialEdit: true | false,
  targetField: "priority" | "category" | null,
  originalText: <ticket description>,
  photosCount: <number of photos>,
  videosCount: <number of videos>,
  locationPreserved: true | false,
  agencyPreserved: true | false
}
```

**What to check**:
- Are photos being loaded from the ticket into the session?
- Is `isPartialEdit` true when editing a specific field?
- Is `originalText` matching the ticket description?

---

### 5. **Edit Update**
**Location**: When the ticket is updated after editing

**Log Format**:
```
[EDIT UPDATE] Updating ticket T123: {
  isPartialEdit: true | false,
  targetField: "priority" | null,
  updateFields: ["priority"] | ["description", "photos", "category", ...],
  descriptionUpdate: <new description or undefined>,
  photosUpdate: <number of photos being set or 0>
}

[EDIT COMPLETE] Ticket T123 after update: {
  description: <final description>,
  photosCount: <number of photos>,
  videosCount: <number of videos>
}
```

**What to check**:
- In partial edit, are ONLY the target fields being updated?
- Are photos/description being accidentally cleared?
- Does the final ticket match expectations?

---

## How to Use These Logs

### Testing Scenario 1: Create New Ticket with Photo
1. Send a photo to Telegram
2. Check logs for `[NEW TICKET]` - verify photoUrl is present
3. Complete the wizard
4. Check logs for `[CREATE TICKET]` - verify photos array has the URL
5. Verify in database that ticket has the photo

### Testing Scenario 2: Edit Ticket Priority
1. Run `/edit T123 priority`
2. Check `[EDIT START]` - note original photos count
3. Check `[EDIT SESSION]` - verify photos are loaded, isPartialEdit=true
4. Submit the edit
5. Check `[EDIT UPDATE]` - verify updateFields does NOT include "photos"
6. Check `[EDIT COMPLETE]` - verify photosCount unchanged

### Testing Scenario 3: Full Edit
1. Run `/edit T123` (no specific field)
2. Check `[EDIT SESSION]` - verify isPartialEdit=false
3. Submit the edit
4. Check `[EDIT UPDATE]` - verify photos are only updated if they have values
5. Check `[EDIT COMPLETE]` - verify photos are preserved

---

## Common Issues to Look For

### Issue: Photos Lost During Edit
**Symptoms**: photosCount goes from 1 to 0 during edit

**Check**:
1. `[EDIT START]` - Does original ticket have photos?
2. `[EDIT SESSION]` - Are photos loaded into session?
3. `[EDIT UPDATE]` - Is "photos" in updateFields when it shouldn't be?

**Likely Cause**: 
- Full edit mode updating photos with empty array
- Session not properly loading photos from ticket

---

### Issue: Description Changed to Placeholder
**Symptoms**: Description changes from "chair" to "Photo attachment"

**Check**:
1. `[EDIT START]` - What is the original description?
2. `[EDIT SESSION]` - What is originalText in the session?
3. `[EDIT UPDATE]` - What is descriptionUpdate?

**Likely Cause**:
- Ticket was created with placeholder description
- Session is using wrong description source

---

### Issue: Photos Not Uploaded
**Symptoms**: photoUrl is null in `[NEW TICKET]`

**Check**:
1. Is the photo being sent correctly to Telegram?
2. Is `fastProcessTelegramPhoto` failing?
3. Check for errors in photo upload process

**Likely Cause**:
- Cloudinary upload failure
- Telegram file download issue
- Network problem

---

## Viewing Logs

### In Development (npm run dev)
Logs will appear in the terminal where you ran `npm run dev`

### In Production
Check your hosting platform's logs:
- Vercel: Check Function Logs
- Railway: Check Deployment Logs
- Other: Check application logs

---

## Next Steps

1. **Test ticket creation** with a photo
2. **Test partial edit** (e.g., `/edit T123 priority`)
3. **Test full edit** (e.g., `/edit T123`)
4. **Review logs** to identify where data is lost
5. **Report findings** with specific log outputs

The logs will show exactly where in the flow the photos or description are being lost!
