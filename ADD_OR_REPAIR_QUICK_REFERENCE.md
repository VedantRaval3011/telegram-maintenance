# Add New or Repair - Quick Reference

## 📋 Feature Overview
A dynamic workflow field that conditionally prompts users to choose between "Add New" or "Repair" when creating tickets.

---

## 🎯 Key Points

### Admin Control
- **Location**: Workflow Masters (`/masters/workflow-rules`)
- **Toggle**: "Add New or Repair" 
- **Icon**: 🔧 Wrench
- **Badge Color**: Emerald Green

### User Experience
- **When Enabled**: Shows choice between ➕ Add and 🔧 Repair
- **When Disabled**: Field is skipped entirely
- **Position**: After agency fields, before additional fields

---

## 🗄️ Database Fields

```typescript
// WorkflowRuleMaster
requiresAddOrRepair: boolean

// WizardSession (temporary)
addOrRepairChoice: "add" | "repair" | null

// Ticket (permanent)
addOrRepairChoice: "add" | "repair" | null
```

---

## 🎨 UI Elements

### Workflow Master Page
```
Toggle: "Add New or Repair"
Description: "Choose between Add or Repair"
Badge: "🔧 Add/Repair" (emerald-50 background)
```

### Telegram Wizard
```
Field Label: "🔧 Add New or Repair"
Buttons: 
  - "➕ Add"
  - "🔧 Repair"
```

---

## 🔄 Workflow Flow

```
1. Admin enables toggle in Workflow Master
   ↓
2. User creates ticket via Telegram
   ↓
3. Wizard shows "Add New or Repair" field
   ↓
4. User selects Add or Repair
   ↓
5. Choice saved to WizardSession
   ↓
6. Ticket created with addOrRepairChoice field
   ↓
7. Choice persisted in Ticket document
```

---

## 📝 Code Locations

| Component | File Path |
|-----------|-----------|
| Model (Workflow) | `src/models/WorkflowRuleMaster.ts` |
| Model (Session) | `src/models/WizardSession.ts` |
| Model (Ticket) | `src/models/Ticket.ts` |
| UI (Master) | `src/app/masters/workflow-rules/page.tsx` |
| Logic (Webhook) | `src/app/api/webhook/route.ts` |

---

## ⚡ Quick Actions

### Enable for a Category
1. Go to `/masters/workflow-rules`
2. Edit workflow rule
3. Enable "Add New or Repair" toggle
4. Save

### Test the Feature
1. Create ticket via Telegram
2. Look for "🔧 Add New or Repair" step
3. Select option
4. Complete ticket
5. Verify in database

### Disable the Feature
1. Go to `/masters/workflow-rules`
2. Edit workflow rule
3. Disable "Add New or Repair" toggle
4. Save

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Field not showing | Verify toggle is ON in database |
| Selection not saving | Check MongoDB connection |
| TypeScript errors | Rebuild project: `npm run build` |
| Cache issues | Restart dev server |

---

## 📊 Database Queries

### Check if enabled for a category
```javascript
db.workflowrules.findOne({ categoryId: ObjectId("...") })
// Look for: requiresAddOrRepair: true
```

### Find all tickets with Add choice
```javascript
db.tickets.find({ addOrRepairChoice: "add" })
```

### Find all tickets with Repair choice
```javascript
db.tickets.find({ addOrRepairChoice: "repair" })
```

---

## ✅ Success Indicators

- ✅ Toggle appears in Workflow Master UI
- ✅ Badge shows on workflow cards when enabled
- ✅ Field appears in Telegram wizard (when ON)
- ✅ Field hidden in Telegram wizard (when OFF)
- ✅ Selection saved to session
- ✅ Selection saved to ticket
- ✅ Jump navigation works
- ✅ No TypeScript errors
- ✅ No runtime errors

---

## 📚 Related Documentation

- [Implementation Guide](./ADD_OR_REPAIR_IMPLEMENTATION.md)
- [Testing Guide](./ADD_OR_REPAIR_TESTING.md)
- [Workflow Diagram](./add_repair_workflow_diagram.png)

---

**Last Updated**: 2025-12-08  
**Version**: 1.0.0  
**Status**: ✅ Complete & Ready for Testing
