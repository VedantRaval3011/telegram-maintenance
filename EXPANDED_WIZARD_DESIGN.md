# 📋 Expanded Wizard Design - All Fields Visible

## 🎯 Design Goal

Create a Telegram wizard where **all fields and options are visible at once** without popups or hidden menus.

## ⚠️ **Telegram Constraints**

### **Inline Keyboard Limits**:
- Maximum **8 buttons per row**
- Maximum **100 buttons total** per message
- Each button has **64-character limit** for callback data

### **Message Limits**:
- Maximum **4096 characters** per message
- Inline keyboards attached to messages

## 💡 **Solution: Sectioned Expanded View**

Since we can't show 50+ categories + 100+ locations + agencies all at once (would exceed limits), we use a **smart sectioned approach**:

### **Layout Structure**:

```
🛠 Ticket Wizard
📝 Issue: [User's description]

━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED FIELDS
━━━━━━━━━━━━━━━━━━━━━━
Category: Electrical ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅

━━━━━━━━━━━━━━━━━━━━━━
🔽 AGENCY (Select One)
━━━━━━━━━━━━━━━━━━━━━━

[👷 ABC Painters]
[👷 XYZ Contractors]
[👷 PQR Services]
[👷 LMN Builders]

━━━━━━━━━━━━━━━━━━━━━━
📋 REMAINING FIELDS
━━━━━━━━━━━━━━━━━━━━━━
Additional Details: Not set

━━━━━━━━━━━━━━━━━━━━━━
NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━
[📂 Category] [⚡ Priority] [📍 Location]
[🧾 Agency] [📝 Details]

[✅ Create Ticket]
```

## 📱 **User Flow**

### **Step 1: Initial State**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

━━━━━━━━━━━━━━━━━━━━━━
🔽 CATEGORY (Select One)
━━━━━━━━━━━━━━━━━━━━━━

[⚡ Electrical]
[🔧 Plumbing]
[🎨 Paint]
[🏗️ Civil]
[❄️ HVAC]
[🪑 Carpentry]
... (all categories shown)

━━━━━━━━━━━━━━━━━━━━━━
QUICK JUMP
━━━━━━━━━━━━━━━━━━━━━━
[⚡ Priority] [📍 Location] [🧾 Agency]
```

### **Step 2: After Selecting Category**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED
━━━━━━━━━━━━━━━━━━━━━━
Category: Electrical ✅

━━━━━━━━━━━━━━━━━━━━━━
🔽 PRIORITY (Select One)
━━━━━━━━━━━━━━━━━━━━━━

[🔴 HIGH]
[🟡 MEDIUM]
[🟢 LOW]

━━━━━━━━━━━━━━━━━━━━━━
📋 REMAINING
━━━━━━━━━━━━━━━━━━━━━━
Subcategory: Not set
Location: Not set
Agency: Not set

━━━━━━━━━━━━━━━━━━━━━━
QUICK JUMP
━━━━━━━━━━━━━━━━━━━━━━
[📂 Change Category] [🧩 Subcategory]
[📍 Location] [🧾 Agency]
```

### **Step 3: After Selecting Priority**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED
━━━━━━━━━━━━━━━━━━━━━━
Category: Electrical ✅
Priority: HIGH ✅

━━━━━━━━━━━━━━━━━━━━━━
🔽 SUBCATEGORY (Select One)
━━━━━━━━━━━━━━━━━━━━━━

[💨 Fan]
[💡 Light]
[🔌 Socket]
[🔧 Switch]
[⚡ MCB/DB]

━━━━━━━━━━━━━━━━━━━━━━
📋 REMAINING
━━━━━━━━━━━━━━━━━━━━━━
Location: Not set
Agency: Not set

━━━━━━━━━━━━━━━━━━━━━━
QUICK JUMP
━━━━━━━━━━━━━━━━━━━━━━
[📂 Category] [⚡ Priority] [📍 Location]
[🧾 Agency]
```

### **Step 4: Location Selection (Tree Navigation)**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

━━━━━━━━━━━━━━━━━━━━━━
✅ COMPLETED
━━━━━━━━━━━━━━━━━━━━━━
Category: Electrical ✅
Subcategory: Fan ✅
Priority: HIGH ✅

━━━━━━━━━━━━━━━━━━━━━━
🔽 LOCATION
━━━━━━━━━━━━━━━━━━━━━━
Current: Building A > Floor 2

Select Room:
[🚪 Room 201]
[🚪 Room 202]
[🚪 Room 203]
[🚪 Room 204]
[⬅️ Back to Floors]

━━━━━━━━━━━━━━━━━━━━━━
📋 REMAINING
━━━━━━━━━━━━━━━━━━━━━━
Agency: Not set

━━━━━━━━━━━━━━━━━━━━━━
QUICK JUMP
━━━━━━━━━━━━━━━━━━━━━━
[📂 Category] [⚡ Priority] [🧩 Subcategory]
[🧾 Agency]
```

### **Step 5: All Complete**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

━━━━━━━━━━━━━━━━━━━━━━
✅ ALL FIELDS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━
Category: Electrical ✅
Subcategory: Fan ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 201 ✅
Agency: ABC Electricians (Date: 2025-12-15) ✅

━━━━━━━━━━━━━━━━━━━━━━
MODIFY
━━━━━━━━━━━━━━━━━━━━━━
[📂 Category] [🧩 Subcategory] [⚡ Priority]
[📍 Location] [🧾 Agency]

━━━━━━━━━━━━━━━━━━━━━━

[✅ CREATE TICKET]
```

## 🎨 **Key Features**

### **1. Always Visible Summary**
- ✅ Completed fields shown at top
- ✅ Current progress visible
- ✅ Easy to review before submitting

### **2. One Expanded Section**
- 🔽 Current section shows ALL options
- 📋 No hidden menus or popups
- 👆 Tap any option to select

### **3. Quick Navigation**
- 🔘 Jump to any section instantly
- 🔄 Change previous selections easily
- ⚡ No need to go step-by-step

### **4. Smart Auto-Progress**
- After selecting, automatically expands next incomplete section
- Guides user through the flow
- But allows jumping around freely

### **5. Visual Hierarchy**
```
━━━━━━━━━━━━━━━━━━━━━━  ← Section dividers
✅ COMPLETED              ← Green checkmarks
🔽 CURRENT SECTION        ← Down arrow indicates active
📋 REMAINING              ← Gray/pending
```

## 🔧 **Implementation Strategy**

### **Message Structure**:
```typescript
interface WizardMessage {
  summary: {
    issue: string;
    completed: Field[];
    remaining: Field[];
  };
  activeSection: {
    name: string;
    options: Option[];
    currentValue?: string;
  };
  navigation: {
    quickJump: Button[];
    submit?: Button;
  };
}
```

### **Callback Data Format**:
```
select_{section}_{value}     // Select an option
jump_{section}               // Jump to section
submit                       // Create ticket
```

### **Example**:
```
select_category_electrical
select_priority_high
select_agency_abc_painters
jump_location
submit
```

## 📊 **Comparison**

### **Old Approach** (Current):
```
Message: "Category: —"
Buttons: [Select Category]
↓ User clicks
New Message: Shows all categories
↓ User selects
Back to main message
```

### **New Approach** (Proposed):
```
Message shows:
- Summary of completed fields
- ALL options for current section
- Quick jump buttons

User taps option → Message updates inline
No separate screens, everything in one view
```

## ✅ **Benefits**

1. **Faster**: No popup navigation
2. **Clearer**: See all options at once
3. **Flexible**: Jump to any section
4. **Mobile-Friendly**: Single scrollable view
5. **Within Limits**: Respects Telegram constraints

## 🚀 **Next Steps**

1. Update preview page to show this design
2. Implement in webhook logic
3. Test with real Telegram bot
4. Gather user feedback

---

**This design gives you the "all expanded" feel while working within Telegram's technical limits!** 🎉
