# 🔧 Add New or Repair Feature

> A dynamic workflow field that allows users to specify whether they're adding new items or repairing existing ones when creating tickets.

![Workflow Diagram](./add_repair_workflow_diagram.png)

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Screenshots](#screenshots)
- [Technical Details](#technical-details)

---

## 🎯 Overview

The **Add New or Repair** feature is a configurable workflow field that provides administrators with the ability to conditionally prompt ticket creators to specify whether they are:
- ➕ **Adding** new items/equipment
- 🔧 **Repairing** existing items/equipment

This field integrates seamlessly into the existing dynamic workflow system and is controlled entirely through the Workflow Master configuration.

### When to Use This Feature

Enable this field for categories where the distinction between "new installation" and "repair work" is important, such as:
- Machine Maintenance
- Equipment Installation
- Electrical Work
- Plumbing Tasks
- Paint Jobs

---

## ✨ Features

### ✅ Admin Features
- **Easy Configuration**: Simple toggle in Workflow Master UI
- **Per-Category Control**: Enable/disable for specific ticket categories
- **Visual Feedback**: Emerald-colored badge shows enabled status
- **Zero Code Required**: Fully configurable through UI

### ✅ User Features
- **Clear Choices**: Intuitive "Add" vs "Repair" options with emoji icons
- **Progressive Disclosure**: Only shown when relevant
- **Quick Selection**: One-tap choice in Telegram
- **Edit Capability**: Jump back to change selection if needed

### ✅ Technical Features
- **Type-Safe**: Full TypeScript support
- **Data Persistence**: Choice stored in both session and final ticket
- **Database Indexed**: Optimized for queries
- **Backwards Compatible**: Existing workflows unaffected

---

## 🏗️ Architecture

### Data Flow

```
Admin Config → Workflow Rule → Telegram Wizard → User Choice → Session → Ticket
```

### Database Schema

```typescript
// Configuration Layer
WorkflowRule {
  requiresAddOrRepair: boolean  // Admin toggle
}

// Runtime Layer
WizardSession {
  addOrRepairChoice: "add" | "repair" | null  // Temporary storage
}

// Persistence Layer
Ticket {
  addOrRepairChoice: "add" | "repair" | null  // Final storage
}
```

### Component Hierarchy

```
WorkflowRulesPage (Admin UI)
  ├── Toggle Component
  └── Badge Display

Telegram Webhook (User Interaction)
  ├── buildFieldsFromRule()      // Generates field
  ├── buildFieldKeyboard()        // Creates buttons
  ├── updateFieldCompletion()     // Tracks state
  └── createTicketFromSession()   // Saves to ticket
```

---

## 🚀 Installation

The feature is already integrated into your codebase. No additional installation needed.

### Verification

To verify the feature is properly installed:

```bash
# Check if files were updated
git status

# Verify TypeScript compilation
npm run build

# Start development server
npm run dev
```

---

## 📘 Usage

### For Administrators

#### Enabling the Feature

1. Navigate to **Workflow Masters**
   ```
   http://localhost:3000/masters/workflow-rules
   ```

2. Click **"New Rule"** or **Edit** an existing rule

3. Find the **"Add New or Repair"** toggle in the Toggles Grid section

4. Click the toggle to **enable** it (it will turn emerald green)

5. Click **"Save Rule"**

![Workflow Master UI](./workflow_master_ui_mockup.png)

#### Viewing Enabled Rules

- Rules with this feature enabled show a **🔧 Add/Repair** badge
- The badge has an emerald green background for easy identification

### For End Users (Telegram)

#### Creating a Ticket

1. Send a message to the bot describing your issue

2. Follow the wizard prompts (Category, Priority, etc.)

3. When you reach the **"🔧 Add New or Repair"** step:
   - Select **"➕ Add"** if you're installing new equipment
   - Select **"🔧 Repair"** if you're fixing existing equipment

4. Continue with the remaining fields

5. Submit your ticket

![Telegram Wizard](./telegram_wizard_mockup.png)

#### Changing Your Selection

If you need to change your selection:
1. Look for the **"↩️ 🔧 Add New or Repair"** button in the jump navigation section
2. Click it to return to this field
3. Make a new selection
4. Continue with the wizard

---

## 📚 Documentation

### Complete Documentation Set

| Document | Purpose | Audience |
|----------|---------|----------|
| [Implementation Guide](./ADD_OR_REPAIR_IMPLEMENTATION.md) | Detailed technical implementation | Developers |
| [Testing Guide](./ADD_OR_REPAIR_TESTING.md) | Test scenarios and procedures | QA / Developers |
| [Quick Reference](./ADD_OR_REPAIR_QUICK_REFERENCE.md) | At-a-glance reference | All Users |
| This README | Feature overview and usage | All Users |

---

## 🖼️ Screenshots

### Admin Interface - Workflow Master
![Workflow Master Toggle](./workflow_master_ui_mockup.png)

*The "Add New or Repair" toggle in the Workflow Master configuration panel*

### User Interface - Telegram Wizard
![Telegram Wizard](./telegram_wizard_mockup.png)

*The "Add New or Repair" field in the Telegram ticket creation wizard*

### Workflow Diagram
![Workflow Diagram](./add_repair_workflow_diagram.png)

*Complete workflow showing enabled vs disabled states*

---

## 🔧 Technical Details

### Modified Files

```
src/models/
  ├── WorkflowRuleMaster.ts    (+2 lines)
  ├── WizardSession.ts          (+4 lines)
  └── Ticket.ts                 (+2 lines)

src/app/
  ├── masters/workflow-rules/page.tsx  (+25 lines)
  └── api/webhook/route.ts             (+40 lines)
```

### Database Collections Affected

1. **`workflowrules`**
   - New field: `requiresAddOrRepair`
   - Type: Boolean
   - Default: `false`

2. **`wizardsessions`** (temporary)
   - New field: `addOrRepairChoice`
   - Type: String (enum: "add", "repair", null)
   - TTL: 1 hour

3. **`tickets`** (permanent)
   - New field: `addOrRepairChoice`
   - Type: String (enum: "add", "repair", null)
   - Indexed: Yes

### API Endpoints Modified

```
POST /api/webhook
  └── Handles callback_query for "select_*_add_or_repair_*"
  └── Handles jump action for "jump_*_add_or_repair"
```

### TypeScript Interfaces

```typescript
// Workflow Rule
interface IWorkflowRule {
  // ... existing fields
  requiresAddOrRepair: boolean;
}

// Wizard Session
interface IWizardSession {
  // ... existing fields
  addOrRepairChoice: "add" | "repair" | null;
}

// Ticket
interface ITicket {
  // ... existing fields
  addOrRepairChoice?: "add" | "repair" | null;
}

// Wizard Field
type WizardFieldType = 
  | "category" 
  | "priority" 
  | "add_or_repair"  // ← New
  | /* ... other types */;
```

---

## 📊 Data Analytics

### Querying Tickets by Choice

```javascript
// Find all "Add" tickets
db.tickets.find({ addOrRepairChoice: "add" })

// Find all "Repair" tickets
db.tickets.find({ addOrRepairChoice: "repair" })

// Count by choice
db.tickets.aggregate([
  { $group: { 
      _id: "$addOrRepairChoice", 
      count: { $sum: 1 } 
  }}
])

// Find tickets where choice was not provided
db.tickets.find({ addOrRepairChoice: null })
```

### Analytics Use Cases

- Track ratio of new installations vs repairs
- Identify high-repair categories
- Resource allocation based on workload type
- Maintenance vs installation cost analysis

---

## 🔒 Security & Validation

### Input Validation

- ✅ Enum validation ensures only "add" or "repair" values
- ✅ TypeScript provides compile-time type safety
- ✅ MongoDB schema enforces data integrity

### Error Handling

- Invalid selections are rejected
- Missing field handled gracefully
- Session expiry properly managed

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: Toggle not visible in Workflow Master
**Cause:** UI component not loaded  
**Solution:** Clear browser cache, refresh page

#### Issue: Field not appearing in Telegram
**Cause:** Toggle not enabled for category  
**Solution:** Verify `requiresAddOrRepair: true` in database

#### Issue: Selection not saving
**Cause:** Database connection issue  
**Solution:** Check MongoDB connection, restart server

See [Testing Guide](./ADD_OR_REPAIR_TESTING.md) for detailed troubleshooting.

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-08 | Initial implementation |

---

## 🤝 Contributing

When extending this feature:

1. Maintain type safety across all layers
2. Update all three documentation files
3. Add test scenarios to the testing guide
4. Follow existing naming conventions
5. Keep UI consistent with design system

---

## 📄 License

This feature is part of the Telegram Maintenance System.  
All rights reserved.

---

## 👥 Support

For questions or issues:
1. Check the [Quick Reference](./ADD_OR_REPAIR_QUICK_REFERENCE.md)
2. Review the [Testing Guide](./ADD_OR_REPAIR_TESTING.md)
3. See the [Implementation Guide](./ADD_OR_REPAIR_IMPLEMENTATION.md)

---

## 🎉 Summary

The **Add New or Repair** feature provides:
- ✅ Easy admin configuration
- ✅ Clear user interface
- ✅ Robust data persistence
- ✅ Type-safe implementation
- ✅ Comprehensive documentation
- ✅ Zero breaking changes

**Status**: ✅ Complete and Ready for Production

---

*Last Updated: December 8, 2025*
