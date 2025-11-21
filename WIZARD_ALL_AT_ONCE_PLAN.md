# 📋 Wizard "All-At-Once" Implementation Plan

## 🎯 User Request Summary

The user wants to change the wizard from a **step-by-step flow** to an **all-at-once form** where:

1. **Show all fields at once** - Users see all required fields in one view
2. **Ask for names directly** - When agency or subcategory are required, ask for the NAME (text input) instead of selection
3. **Create Ticket button** - Always visible when form is complete
4. **Store names in database** - Agency name and subcategory name should be stored and displayed

## ✅ Current State

### **What Already Works**
The `buildWizardKeyboard()` function in `wizardHelpers.ts` (lines 366-410) **already shows all fields at once**:
- Category button
- Subcategory button (if required by WorkflowRule)
- Priority button
- Location buttons (main, source, target based on WorkflowRule)
- Agency button (if required)
- Additional Fields button
- **Submit button** (when complete)

### **Current Flow**
1. User sends message → Wizard created
2. Bot shows message with ALL buttons visible
3. User clicks any button → Modal/selection appears for that field
4. After selection → Returns to main wizard view with all buttons
5. When complete → Submit button creates ticket

## 🔧 What Needs to Change

### **1. Agency Handling**
**Current**: Yes/No buttons → If yes, ask for date
**Requested**: Text input for agency NAME → Then ask for date (if required)

**Changes Needed**:
- When user clicks "Agency" button, ask for agency NAME (text input)
- Store `agencyName` in session (✅ already added to model)
- If `requiresAgencyDate` is true, then ask for date
- Display: "Agency: [Name] (Date: YYYY-MM-DD)"

### **2. Subcategory Handling**
**Current**: Show list of subcategories from database
**Requested**: Ask for subcategory NAME (text input)

**Changes Needed**:
- When user clicks "Subcategory" button, ask for subcategory NAME (text input)
- Store `subCategoryName` in session (need to add to model)
- Display: "Subcategory: [Name]"
- **Note**: This means subcategories won't be validated against master data

### **3. Display Names**
**Current**: Shows IDs or fetches names asynchronously
**Requested**: Show proper display names

**Changes Needed**:
- Store `categoryDisplay` when category selected (fetch from Category model)
- Store `subCategoryDisplay` when subcategory entered
- Store `agencyName` when agency entered
- Update `formatWizardMessage()` to use these stored values

## 📝 Implementation Steps

### **Step 1: Update WizardSession Model**
Add new fields:
```typescript
subCategoryName: string | null;  // For manual subcategory entry
categoryDisplay: string | null;   // Store category display name
```

### **Step 2: Modify Agency Flow in Webhook**
Change from Yes/No buttons to text input:
```typescript
if (action === "step" && stepName === "agency") {
  // Ask for agency name (text input)
  await updateWizardSession(session.botMessageId, { 
    waitingForInput: true, 
    inputField: "agency_name" 
  });
  const message = formatWizardMessage(session);
  await editMessageText(chatId, messageId, message + "\n\n🧾 Please type the agency name:", []);
}
```

### **Step 3: Modify Subcategory Flow**
Change from selection to text input:
```typescript
if (action === "step" && stepName === "subcategory") {
  // Ask for subcategory name (text input)
  await updateWizardSession(session.botMessageId, { 
    waitingForInput: true, 
    inputField: "subcategory_name" 
  });
  const message = formatWizardMessage(session);
  await editMessageText(chatId, messageId, message + "\n\n🧩 Please type the subcategory name:", []);
}
```

### **Step 4: Handle Text Input in Webhook**
Update the text input handler to process:
- `agency_name` → Store in `session.agencyName`, then ask for date if needed
- `subcategory_name` → Store in `session.subCategoryName`
- `agency_date` → Store in `session.agencyDate`

### **Step 5: Update Category Selection**
When category is selected, fetch and store display name:
```typescript
if (action === "cat") {
  const cat = await Category.findById(categoryId).lean();
  await updateWizardSession(session.botMessageId, {
    category: categoryId,
    categoryDisplay: cat?.displayName || categoryId,
    subCategoryId: null,
    subCategoryName: null,
  });
}
```

### **Step 6: Update formatWizardMessage()**
Use stored display names:
```typescript
const categoryDisplay = (session as any).categoryDisplay || session.category || "—";
const subCategoryDisplay = (session as any).subCategoryName || session.subCategoryId || "—";
const agencyText = session.agencyName ? `${session.agencyName}${session.agencyDate ? ` (Date: ${...})` : ""}` : "—";
```

### **Step 7: Update buildWizardKeyboard()**
Update button labels to show current values:
```typescript
// Agency button shows name if set
if (rule && rule.requiresAgency) {
  const agencyLabel = session.agencyName 
    ? `🧾 Agency: ${session.agencyName}` 
    : "🧾 Provide Agency";
  keyboard.push([{ text: agencyLabel, callback_data: `step_${session.botMessageId}_agency` }]);
}

// Subcategory button shows name if set
if (rule && rule.hasSubcategories) {
  const subLabel = (session as any).subCategoryName
    ? `🧩 Subcategory: ${(session as any).subCategoryName}`
    : "🧩 Provide Subcategory";
  keyboard.push([{ text: subLabel, callback_data: `step_${session.botMessageId}_subcategory` }]);
}
```

### **Step 8: Update Ticket Creation**
Ensure `createTicketFromWizard()` uses the stored names:
```typescript
const ticket = await Ticket.create({
  // ...
  category: session.category,
  categoryDisplay: (session as any).categoryDisplay,
  subCategory: (session as any).subCategoryName || session.subCategoryId,
  // ...
  meta: {
    agency: session.agencyName,
    agencyDate: session.agencyDate,
    // ...
  }
});
```

## 🎨 User Experience Flow

### **Example: Paint Category with Agency**

1. **User sends**: "Paint needed in Room 101"
2. **Bot shows**:
   ```
   🛠 Ticket Wizard
   📝 Issue: Paint needed in Room 101
   
   Category: —
   Subcategory: —
   Priority: —
   Location: —
   Agency: —
   
   [📂 Select Category]
   [⚡ Select Priority]
   [📍 Select Location]
   [🧾 Provide Agency]
   ```

3. **User clicks** "Select Category" → Chooses "Paint"
4. **Bot updates**:
   ```
   Category: Paint ✅
   Subcategory: —
   Priority: —
   Location: —
   Agency: —
   
   [📂 Change Category]
   [⚡ Select Priority]
   [📍 Select Location]
   [🧾 Provide Agency]
   ```

5. **User clicks** "Provide Agency"
6. **Bot asks**: "🧾 Please type the agency name:"
7. **User types**: "ABC Painters"
8. **Bot asks**: "📅 Please type the agency date (YYYY-MM-DD):"
9. **User types**: "2025-12-01"
10. **Bot updates**:
    ```
    Category: Paint ✅
    Priority: —
    Location: —
    Agency: ABC Painters (Date: 2025-12-01) ✅
    
    [📂 Change Category]
    [⚡ Select Priority]
    [📍 Select Location]
    [🧾 Change Agency]
    ```

11. **User fills** Priority and Location
12. **Bot shows**: `[✅ Create Ticket]` button
13. **User clicks** → Ticket created!

## ⚠️ Important Considerations

### **Data Validation**
- **Subcategory**: No longer validated against master data (free text)
- **Agency**: Free text input (no validation)
- **Category**: Still validated (must select from list)
- **Location**: Still validated (must select from tree)

### **Database Changes**
- Add `subCategoryName` field to `WizardSession` model
- Add `categoryDisplay` field to `WizardSession` model
- Update `Ticket` model to store agency name in `meta.agency`

### **Backward Compatibility**
- Existing tickets with `subCategoryId` (ObjectId) will still work
- New tickets will have `subCategory` as text (agency/subcategory names)

## 🚀 Next Steps

1. **Confirm approach** with user
2. **Implement model changes** (WizardSession)
3. **Update webhook handlers** (agency, subcategory flows)
4. **Update keyboard builders** (show current values)
5. **Test thoroughly** with various categories
6. **Update dashboard** to display agency/subcategory names

---

**Status**: Ready to implement
**Estimated Time**: 30-45 minutes
**Risk Level**: Medium (changes core wizard flow)
