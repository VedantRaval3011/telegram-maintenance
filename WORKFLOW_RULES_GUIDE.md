# 🔄 Workflow Rules System - Complete Implementation Guide

## 📋 Overview

The **Workflow Rules** system makes your Telegram bot wizard **100% dynamic and category-driven**. No more hard-coded logic! Each category can have its own custom flow, fields, and requirements.

---

## 🎯 What Was Implemented

### 1. **Database Model** (`WorkflowRuleMaster.ts`)
- Defines rules per category
- Controls which questions the wizard asks
- Supports dynamic additional fields

### 2. **API Routes** (`/api/masters/workflow-rules/route.ts`)
- **GET**: Fetch all rules or filter by categoryId
- **POST**: Create or update a rule (upsert)
- **DELETE**: Remove a rule

### 3. **UI Management Page** (`/masters/workflow-rules/page.tsx`)
- Beautiful card-based list view
- Create/Edit modal with toggles
- Dynamic additional fields builder
- Mint/Emerald theme matching your app

### 4. **Navbar Integration**
- Added "Workflows" link to main navigation

### 5. **Webhook Integration** (Already exists in your code)
- `wizardHelpers.ts` already uses WorkflowRule
- `resolveNextStep()` dynamically determines wizard flow
- `isWizardComplete()` validates based on rules

---

## 🏗️ How It Works

### **Step-by-Step Wizard Flow**

```
User sends message → Bot creates wizard
                   ↓
              Select Category
                   ↓
         Load WorkflowRule for category
                   ↓
    ┌──────────────┴──────────────┐
    │  Rule determines next steps  │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │ IF hasSubcategories = true  │ → Ask Subcategory
    │ IF requiresLocation = true  │ → Ask Building/Floor/Room
    │ IF requiresSourceLocation   │ → Ask "From" location
    │ IF requiresTargetLocation   │ → Ask "To" location
    │ IF requiresAgency = true    │ → Ask Agency Yes/No
    │   └─ IF requiresAgencyDate  │ → Ask Date
    │ IF additionalFields exist   │ → Ask each field
    └─────────────────────────────┘
                   ↓
              Ask Priority
                   ↓
         Show Summary & Create Ticket
```

---

## 🔧 WorkflowRule Fields Explained

| Field | Type | Description | Example Use Case |
|-------|------|-------------|------------------|
| `categoryId` | ObjectId | Links rule to a category | Electrical, Plumbing, etc. |
| `hasSubcategories` | Boolean | Ask user to select subcategory | Machine → Fan, AC, Pump |
| `requiresLocation` | Boolean | Standard location tree (Building→Floor→Room) | Most maintenance issues |
| `requiresSourceLocation` | Boolean | Ask "From" location | Transfer, Shifting |
| `requiresTargetLocation` | Boolean | Ask "To" location | Transfer, Shifting |
| `requiresAgency` | Boolean | Ask if agency handles this | Paint, Civil work |
| `requiresAgencyDate` | Boolean | If agency=yes, ask date | Agency-based work |
| `additionalFields[]` | Array | Custom dynamic fields | Paint Type, Machine ID, etc. |

### **Additional Field Types**
- `text`: Free text input
- `number`: Numeric input
- `date`: Date picker (YYYY-MM-DD)
- `select`: Dropdown with options
- `photo`: Photo upload

---

## 📝 Example Workflow Rules

### **Example 1: Electrical Category**
```json
{
  "categoryId": "673e1234567890abcdef1234",
  "hasSubcategories": true,
  "requiresLocation": true,
  "requiresSourceLocation": false,
  "requiresTargetLocation": false,
  "requiresAgency": false,
  "requiresAgencyDate": false,
  "additionalFields": []
}
```
**Wizard Flow**: Category → Subcategory → Location → Priority → Create

---

### **Example 2: Paint Category**
```json
{
  "categoryId": "673e1234567890abcdef5678",
  "hasSubcategories": false,
  "requiresLocation": true,
  "requiresSourceLocation": false,
  "requiresTargetLocation": false,
  "requiresAgency": true,
  "requiresAgencyDate": true,
  "additionalFields": [
    {
      "key": "paintType",
      "label": "Paint Type",
      "type": "select",
      "options": ["Epoxy", "Enamel", "Oil-based", "Water-based"]
    },
    {
      "key": "surfaceArea",
      "label": "Surface Area (sq ft)",
      "type": "number"
    }
  ]
}
```
**Wizard Flow**: Category → Location → Agency → Agency Date → Paint Type → Surface Area → Priority → Create

---

### **Example 3: Transfer/Shifting Category**
```json
{
  "categoryId": "673e1234567890abcdef9012",
  "hasSubcategories": false,
  "requiresLocation": false,
  "requiresSourceLocation": true,
  "requiresTargetLocation": true,
  "requiresAgency": false,
  "requiresAgencyDate": false,
  "additionalFields": [
    {
      "key": "itemDescription",
      "label": "Item Description",
      "type": "text"
    }
  ]
}
```
**Wizard Flow**: Category → From Location → To Location → Item Description → Priority → Create

---

## 🚀 How to Use

### **1. Access the Workflow Rules Page**
Navigate to: `http://localhost:3000/masters/workflow-rules`

### **2. Create a New Rule**
1. Click **"New Rule"** button
2. Select a **Category**
3. Toggle the required features:
   - ✅ Has Subcategories
   - ✅ Requires Location
   - ✅ Source/Target Locations
   - ✅ Agency Info
4. Add **Additional Fields** if needed
5. Click **"Save Rule"**

### **3. Edit an Existing Rule**
1. Find the category card
2. Click the **Edit** icon (appears on hover)
3. Modify settings
4. Click **"Save Rule"**

### **4. Delete a Rule**
1. Click the **Trash** icon on a category card
2. Confirm deletion

---

## 🔗 Integration with Telegram Bot

### **How the Bot Uses Rules**

When a user selects a category, the webhook:

```typescript
// 1. Load the rule
const rule = await WorkflowRule.findOne({ categoryId: selectedCategoryId });

// 2. Determine next step
const nextStep = await resolveNextStep(session);
// This function checks the rule and returns:
// "subcategory", "location", "source_location", "target_location", 
// "agency", "agency_date", "additional_fields", "priority", or "complete"

// 3. Show appropriate UI
await showStepUI(session, chatId, messageId);
```

### **Dynamic Field Handling**

For additional fields:
```typescript
if (rule.additionalFields && rule.additionalFields.length > 0) {
  for (const field of rule.additionalFields) {
    // Bot asks: "What is the {field.label}?"
    // Stores answer in: session.additionalFieldValues[field.key]
  }
}
```

---

## 🎨 UI Features

### **Card View**
- **Visual badges** for each enabled feature
- **Hover effects** reveal edit/delete buttons
- **Color-coded tags**:
  - 🔵 Blue: Subcategories
  - 🟣 Purple: Location
  - 🟠 Orange: Transfer (From/To)
  - 🔴 Rose: Agency

### **Modal Form**
- **Toggle switches** for boolean fields
- **Dynamic field builder** with drag-and-drop feel
- **Type selector** for additional fields
- **Options input** for select fields (comma-separated)

---

## ✅ Benefits

### **Before Workflow Rules** ❌
- Hard-coded wizard logic
- Same questions for all categories
- Difficult to add new categories
- No flexibility

### **After Workflow Rules** ✅
- ✨ **100% Dynamic**: Each category has custom flow
- 🎯 **Flexible**: Add/remove fields without code changes
- 🚀 **Scalable**: Support unlimited categories
- 🔧 **Maintainable**: Non-technical users can configure rules
- 📊 **Data-Driven**: Rules stored in database, not code

---

## 🔮 Future Enhancements (Optional)

1. **Conditional Logic**: Show field X only if field Y = "value"
2. **Field Validation**: Min/max values, regex patterns
3. **Multi-Language**: Translate labels per user language
4. **Templates**: Clone rules from existing categories
5. **Analytics**: Track which fields are most used
6. **Approval Workflows**: Route tickets based on rules

---

## 📚 Files Modified/Created

### **Created**
- ✅ `/src/app/api/masters/workflow-rules/route.ts` - API endpoints
- ✅ `/src/app/masters/workflow-rules/page.tsx` - UI management page
- ✅ `/src/models/WorkflowRuleMaster.ts` - Database model (already existed)

### **Modified**
- ✅ `/src/components/Navbar.tsx` - Added Workflows link
- ✅ `/src/app/layout.tsx` - Added Toaster for notifications
- ✅ `/src/lib/wizardHelpers.ts` - Already uses WorkflowRule (no changes needed)
- ✅ `/src/app/api/webhook/route.ts` - Already integrated (no changes needed)

### **Dependencies Added**
- ✅ `react-hot-toast` - Toast notifications

---

## 🎓 Quick Start Guide

### **Step 1: Create Categories**
Go to `/masters/categories` and create your categories (if not done already).

### **Step 2: Create Workflow Rules**
1. Go to `/masters/workflow-rules`
2. Click "New Rule"
3. Select a category
4. Configure the wizard flow
5. Save

### **Step 3: Test in Telegram**
1. Send a message to your bot
2. Select the category you configured
3. Bot will follow the workflow rule!

---

## 🐛 Troubleshooting

### **Issue: Rule not applying to bot**
- **Solution**: Make sure the category ID in the rule matches the category ID in your database

### **Issue: Additional fields not showing**
- **Solution**: Check that `additionalFields` array is properly formatted with `key`, `label`, and `type`

### **Issue: Bot skips a step**
- **Solution**: Verify the boolean flags in the rule (e.g., `requiresLocation` should be `true`)

---

## 🎉 Summary

You now have a **fully dynamic, production-ready Workflow Rules system** that:
- ✅ Makes your bot wizard 100% configurable
- ✅ Supports unlimited categories with custom flows
- ✅ Provides a beautiful UI for non-technical users
- ✅ Integrates seamlessly with your existing codebase
- ✅ Follows your Mint/Emerald design theme

**Next Steps**: Create workflow rules for your categories and watch the magic happen! 🚀
