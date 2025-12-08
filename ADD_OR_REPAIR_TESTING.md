# Testing Guide: Add New or Repair Feature

## Prerequisites
- Development server running (`npm run dev`)
- Database connection configured
- Telegram bot configured and running

## Test Scenarios

### Scenario 1: Enable Feature in Workflow Master

#### Steps:
1. Navigate to `http://localhost:3000/masters/workflow-rules`
2. Click on "Create New Rule" or Edit an existing rule
3. Select a category (e.g., "Machine Maintenance")
4. Scroll down to the toggles section
5. Find and enable the "Add New or Repair" toggle
   - Label: "Add New or Repair"
   - Description: "Choose between Add or Repair"
   - Icon: 🔧 Wrench
6. Click "Save Rule"

#### Expected Results:
- ✅ Toggle should be visible in the modal
- ✅ After saving, the workflow rule card should show an emerald-colored badge "🔧 Add/Repair"
- ✅ No console errors

---

### Scenario 2: Create Ticket with Feature Enabled

#### Steps:
1. Open Telegram and start a conversation with your bot
2. Send a message to create a ticket for the category where you enabled "Add New or Repair"
3. Follow the wizard flow (Category → Priority → etc.)
4. When you reach the "Add New or Repair" step:
   - The wizard should display: "🔧 Add New or Repair"
   - Two buttons should be shown:
     - "➕ Add"
     - "🔧 Repair"
5. Select one of the options (e.g., "➕ Add")
6. Complete the rest of the wizard
7. Submit the ticket

#### Expected Results:
- ✅ The "Add New or Repair" field appears in the correct order
- ✅ After selecting an option, it shows in the "Completed" section as either "➕ Add" or "🔧 Repair"
- ✅ The wizard advances to the next field automatically
- ✅ The ticket is created successfully

---

### Scenario 3: Verify Data Persistence

#### Steps:
1. After creating a ticket (from Scenario 2)
2. Check the MongoDB database
3. Query the `tickets` collection for the newly created ticket
4. Verify the `addOrRepairChoice` field

#### Expected Results:
- ✅ The ticket document contains `addOrRepairChoice: "add"` or `addOrRepairChoice: "repair"`
- ✅ The value matches what you selected in the wizard

---

### Scenario 4: Create Ticket with Feature Disabled

#### Steps:
1. Go to Workflow Rules and edit the same category
2. **Disable** the "Add New or Repair" toggle
3. Save the rule
4. Create a new ticket via Telegram for this category
5. Go through the wizard

#### Expected Results:
- ✅ The "Add New or Repair" field does NOT appear in the wizard
- ✅ The workflow proceeds directly from the previous field to the next field
- ✅ Ticket is created successfully
- ✅ In the database, `addOrRepairChoice` is `null` or not present

---

### Scenario 5: Jump Back to Change Selection

#### Steps:
1. Create a ticket with "Add New or Repair" enabled
2. Select "➕ Add"
3. Proceed to a later step (e.g., Location)
4. Click the "↩️ 🔧 Add New or Repair" jump button
5. Select "🔧 Repair" instead
6. Complete the ticket

#### Expected Results:
- ✅ Jump button appears in the navigation section
- ✅ Clicking it allows you to change the selection
- ✅ The previously selected value is cleared
- ✅ New selection is saved correctly
- ✅ Final ticket has `addOrRepairChoice: "repair"`

---

### Scenario 6: Multiple Categories

#### Steps:
1. Enable "Add New or Repair" for Category A (e.g., "Machine")
2. Keep it disabled for Category B (e.g., "Paint")
3. Create tickets for both categories

#### Expected Results:
- ✅ Category A: Shows "Add New or Repair" field
- ✅ Category B: Does NOT show "Add New or Repair" field
- ✅ Each category follows its own workflow configuration independently

---

## Edge Cases to Test

### Edge Case 1: Session Timeout
- Start a ticket creation
- Wait for the session to expire (default: 1 hour)
- Try to interact with the wizard

**Expected:** Session expired message, wizard removed

### Edge Case 2: Cancel Wizard
- Start ticket creation
- Select "Add" or "Repair"
- Click "❌ Cancel"

**Expected:** Wizard cancelled, no ticket created, `addOrRepairChoice` not saved

### Edge Case 3: View Preview Pages
- Navigate to `/masters/workflow-rules/preview`
- Navigate to `/masters/workflow-rules/preview-expanded`

**Expected:** 
- ✅ Any workflow rules with "Add New or Repair" enabled should display this information
- ✅ No errors on these pages

---

## Verification Checklist

### Database Fields
- [ ] WorkflowRule collection has `requiresAddOrRepair` field
- [ ] WizardSession collection has `addOrRepairChoice` field
- [ ] Ticket collection has `addOrRepairChoice` field

### UI Components
- [ ] Workflow Rules page shows toggle for "Add New or Repair"
- [ ] Badge appears on workflow rule cards when enabled
- [ ] Telegram wizard shows the field when enabled
- [ ] Buttons are properly styled with emojis

### Functionality
- [ ] Enabling/disabling toggle works correctly
- [ ] Selection is saved to wizard session
- [ ] Selection is saved to final ticket
- [ ] Jump navigation works
- [ ] Field appears in correct order in wizard
- [ ] Conditional display works (only shown when toggle is true)

---

## Troubleshooting

### Issue: Field not appearing in Telegram wizard
**Solution:** 
1. Check that `requiresAddOrRepair` is `true` in the database for that category
2. Verify the cache is up to date (restart the dev server if needed)
3. Check console for any errors

### Issue: Selection not being saved
**Solution:**
1. Check network tab for failed API calls
2. Verify MongoDB connection is active
3. Check that the callback handler is receiving the correct data

### Issue: TypeScript errors
**Solution:**
1. Run `npm run build` to check for compilation errors
2. Ensure all models are properly typed
3. Clear `.next` cache and restart dev server

---

## Success Criteria
All scenarios should pass without errors. The feature should work seamlessly as part of the dynamic workflow system, appearing only when configured by the admin and correctly storing the user's choice.
