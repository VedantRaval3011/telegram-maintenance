# 📱 Telegram Wizard - Message Flow Visualization

## 🎯 Overview

This document shows exactly how the Telegram bot wizard will interact with users, including all message states and button configurations based on WorkflowRule settings.

---

## 📋 Example Scenario: Paint Category

### **WorkflowRule Configuration**
```json
{
  "categoryId": "paint_category_id",
  "hasSubcategories": false,
  "requiresLocation": true,
  "requiresSourceLocation": false,
  "requiresTargetLocation": false,
  "requiresAgency": true,
  "agencyType": "name",
  "agencyList": ["ABC Painters", "XYZ Contractors", "PQR Services"],
  "requiresAgencyDate": true,
  "additionalFields": []
}
```

---

## 🔄 Message Flow

### **Step 1: User Sends Initial Message**

```
👤 User: Paint needed in Room 101
```

**Bot Response:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: —
Subcategory: —
Priority: —
Location: —
Agency: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Select Category     │
├─────────────────────────┤
│  ⚡ Select Priority     │
├─────────────────────────┤
│  📍 Select Location     │
├─────────────────────────┤
│  🧾 Select Agency       │
└─────────────────────────┘
```

---

### **Step 2: User Clicks "Select Category"**

**Bot Shows Category List:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: —
Subcategory: —
Priority: —
Location: —
Agency: —
📸 Photos: None

📂 Select Category:

┌─────────────────────────┐
│  🎨 Paint               │
├─────────────────────────┤
│  ⚡ Electrical          │
├─────────────────────────┤
│  🔧 Plumbing            │
├─────────────────────────┤
│  🏗️ Civil               │
└─────────────────────────┘
```

---

### **Step 3: User Selects "Paint"**

**Bot Updates Message:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Subcategory: —
Priority: —
Location: —
Agency: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Select Priority     │
├─────────────────────────┤
│  📍 Select Location     │
├─────────────────────────┤
│  🧾 Select Agency       │
└─────────────────────────┘
```

---

### **Step 4: User Clicks "Select Priority"**

**Bot Shows Priority Options:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: —
Location: —
Agency: —
📸 Photos: None

⚡ Select Priority:

┌─────────────────────────┐
│  🔴 HIGH                │
├─────────────────────────┤
│  🟡 MEDIUM              │
├─────────────────────────┤
│  🟢 LOW                 │
└─────────────────────────┘
```

---

### **Step 5: User Selects "HIGH"**

**Bot Updates:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: —
Agency: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Change Priority     │
├─────────────────────────┤
│  📍 Select Location     │
├─────────────────────────┤
│  🧾 Select Agency       │
└─────────────────────────┘
```

---

### **Step 6: User Clicks "Select Location"**

**Bot Shows Location Tree (Root Level):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: —
Agency: —
📸 Photos: None

📍 Select Location:

┌─────────────────────────┐
│  🏢 Building A          │
├─────────────────────────┤
│  🏢 Building B          │
├─────────────────────────┤
│  🏢 Building C          │
└─────────────────────────┘
```

---

### **Step 7: User Selects "Building A"**

**Bot Shows Children (Floors):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A
Agency: —
📸 Photos: None

📍 Selected: Building A

Select child:

┌─────────────────────────┐
│  ⬆️ Floor 1              │
├─────────────────────────┤
│  ⬆️ Floor 2              │
├─────────────────────────┤
│  ⬆️ Floor 3              │
├─────────────────────────┤
│  ⬅️ Back                │
└─────────────────────────┘
```

---

### **Step 8: User Selects "Floor 2"**

**Bot Shows Rooms:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2
Agency: —
📸 Photos: None

📍 Selected: Floor 2

Select child:

┌─────────────────────────┐
│  🚪 Room 101            │
├─────────────────────────┤
│  🚪 Room 102            │
├─────────────────────────┤
│  🚪 Room 103            │
├─────────────────────────┤
│  ⬅️ Back                │
└─────────────────────────┘
```

---

### **Step 9: User Selects "Room 101" (Leaf Node)**

**Bot Updates (Location Complete):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Change Priority     │
├─────────────────────────┤
│  📍 Change Location     │
├─────────────────────────┤
│  🧾 Select Agency       │
└─────────────────────────┘
```

---

### **Step 10: User Clicks "Select Agency"**

**Bot Shows Agency List (from WorkflowRule):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: —
📸 Photos: None

🧾 Select Agency:

┌─────────────────────────┐
│  👷 ABC Painters        │
├─────────────────────────┤
│  👷 XYZ Contractors     │
├─────────────────────────┤
│  👷 PQR Services        │
└─────────────────────────┘
```

---

### **Step 11: User Selects "ABC Painters"**

**Bot Asks for Agency Date (because requiresAgencyDate = true):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: ABC Painters
📸 Photos: None

📅 Please type the agency date (YYYY-MM-DD):
```

---

### **Step 12: User Types "2025-12-15"**

**Bot Updates (All Fields Complete):**
```
🛠 Ticket Wizard
📝 Issue: Paint needed in Room 101

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: ABC Painters (Date: 2025-12-15) ✅
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Change Priority     │
├─────────────────────────┤
│  📍 Change Location     │
├─────────────────────────┤
│  🧾 Change Agency       │
├─────────────────────────┤
│  ✅ Create Ticket       │  ← NEW!
└─────────────────────────┘
```

---

### **Step 13: User Clicks "Create Ticket"**

**Bot Creates Ticket and Sends Confirmation:**
```
🎫 Ticket #1234 Created
📝 Paint needed in Room 101

Category: Paint
Priority: HIGH
Location: Building A > Floor 2 > Room 101
Agency: ABC Painters (Date: 2025-12-15)
Created by: @username
```

---

## 🔄 Alternative Flows

### **Flow A: Category with Subcategories**

**WorkflowRule:**
```json
{
  "categoryId": "electrical_id",
  "hasSubcategories": true,
  "requiresLocation": true,
  "requiresAgency": false
}
```

**After selecting "Electrical" category:**
```
🛠 Ticket Wizard
📝 Issue: Fan not working

Category: Electrical ✅
Subcategory: —
Priority: —
Location: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  🧩 Select Subcategory  │  ← NEW!
├─────────────────────────┤
│  ⚡ Select Priority     │
├─────────────────────────┤
│  📍 Select Location     │
└─────────────────────────┘
```

**Clicking "Select Subcategory":**
```
🧩 Select Subcategory:

┌─────────────────────────┐
│  💨 Fan                 │
├─────────────────────────┤
│  💡 Light               │
├─────────────────────────┤
│  🔌 Socket              │
├─────────────────────────┤
│  🔧 Switch              │
└─────────────────────────┘
```

---

### **Flow B: Transfer Category (Source/Target Locations)**

**WorkflowRule:**
```json
{
  "categoryId": "transfer_id",
  "hasSubcategories": false,
  "requiresLocation": false,
  "requiresSourceLocation": true,
  "requiresTargetLocation": true,
  "requiresAgency": false
}
```

**After selecting "Transfer" category:**
```
🛠 Ticket Wizard
📝 Issue: Move desk from 101 to 202

Category: Transfer ✅
Priority: —
From: —
To: —
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Select Priority     │
├─────────────────────────┤
│  📍 Select From (Source)│  ← NEW!
├─────────────────────────┤
│  📍 Select To (Target)  │  ← NEW!
└─────────────────────────┘
```

---

### **Flow C: Agency with Yes/No (Boolean Type)**

**WorkflowRule:**
```json
{
  "categoryId": "civil_id",
  "requiresAgency": true,
  "agencyType": "boolean",
  "requiresAgencyDate": false
}
```

**Clicking "Agency?":**
```
🧾 Is this work done by an agency?

┌─────────────────────────┐
│  ✅ Yes                 │
├─────────────────────────┤
│  ❌ No                  │
└─────────────────────────┘
```

**If user selects "Yes":**
```
Category: Civil ✅
Priority: HIGH ✅
Location: Building A > Floor 1 ✅
Agency: Yes ✅
```

**If user selects "No":**
```
Category: Civil ✅
Priority: HIGH ✅
Location: Building A > Floor 1 ✅
Agency: No ✅
```

---

### **Flow D: Additional Fields**

**WorkflowRule:**
```json
{
  "categoryId": "paint_id",
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

**After basic fields filled:**
```
🛠 Ticket Wizard
📝 Issue: Paint needed

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: ABC Painters ✅
📸 Photos: None

┌─────────────────────────┐
│  📂 Change Category     │
├─────────────────────────┤
│  ⚡ Change Priority     │
├─────────────────────────┤
│  📍 Change Location     │
├─────────────────────────┤
│  🧾 Change Agency       │
├─────────────────────────┤
│  📝 Additional Details  │  ← NEW!
└─────────────────────────┘
```

**Clicking "Additional Details":**
```
📝 Provide additional details:

┌─────────────────────────┐
│  ✍️ Paint Type          │
├─────────────────────────┤
│  ✍️ Surface Area (sq ft)│
├─────────────────────────┤
│  ⬅️ Back                │
└─────────────────────────┘
```

**Clicking "Paint Type":**
```
✍️ Paint Type:

┌─────────────────────────┐
│  🎨 Epoxy               │
├─────────────────────────┤
│  🎨 Enamel              │
├─────────────────────────┤
│  🎨 Oil-based           │
├─────────────────────────┤
│  🎨 Water-based         │
└─────────────────────────┘
```

**After selecting "Epoxy", clicking "Surface Area":**
```
🛠 Ticket Wizard
📝 Issue: Paint needed

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: ABC Painters ✅
paintType: Epoxy ✅
📸 Photos: None

✍️ Please type value for Surface Area (sq ft):
```

**User types "500":**
```
🛠 Ticket Wizard
📝 Issue: Paint needed

Category: Paint ✅
Priority: HIGH ✅
Location: Building A > Floor 2 > Room 101 ✅
Agency: ABC Painters ✅
paintType: Epoxy ✅
surfaceArea: 500 ✅
📸 Photos: None

┌─────────────────────────┐
│  ✅ Create Ticket       │
└─────────────────────────┘
```

---

## 📸 Photo Upload Flow

**User sends photo before filling form:**
```
👤 User: [Sends photo]
```

**Bot Response:**
```
🛠 Ticket Wizard
📝 Issue: [Photo caption or "Issue description"]

Category: —
Priority: —
Location: —
Agency: —
📸 Photos: 1 attached ✅

┌─────────────────────────┐
│  📂 Select Category     │
├─────────────────────────┤
│  ⚡ Select Priority     │
├─────────────────────────┤
│  📍 Select Location     │
└─────────────────────────┘
```

**User can send multiple photos:**
```
📸 Photos: 3 attached ✅
```

---

## 🎨 Key Features

### **1. All-at-Once View** ✅
- All fields visible in one message
- Users can fill fields in any order
- No forced step-by-step flow

### **2. Dynamic Buttons** ✅
- Buttons appear/disappear based on WorkflowRule
- Button labels change: "Select" → "Change"
- "Create Ticket" button only appears when complete

### **3. Real-time Updates** ✅
- Message updates after each selection
- Green checkmarks show completed fields
- Current values always visible

### **4. Flexible Agency Configuration** ✅
- **Boolean Type**: Simple Yes/No buttons
- **Name Type**: Select from predefined agency list
- Optional agency date field

### **5. Smart Location Tree** ✅
- Navigate through building → floor → room
- Back button to go up one level
- Leaf nodes automatically complete selection

### **6. Additional Fields Support** ✅
- Text input
- Number input
- Date input (YYYY-MM-DD)
- Select dropdown
- Photo upload

---

## 🔧 Technical Implementation

### **Button Callback Data Format**
```
cat_{botMessageId}_{categoryId}
sub_{botMessageId}_{subcategoryId}
pri_{botMessageId}_{low|medium|high}
loc_{botMessageId}_child_{locationId}
loc_{botMessageId}_back_{parentId}
agency_{botMessageId}_{agencyName}
agency_bool_{botMessageId}_{yes|no}
step_{botMessageId}_{stepName}
submit_{botMessageId}
```

### **Session Data Structure**
```typescript
{
  botMessageId: 12345,
  chatId: 67890,
  userId: 11111,
  originalText: "Paint needed in Room 101",
  category: "paint_id",
  categoryDisplay: "Paint",
  subCategoryId: null,
  priority: "high",
  locationPath: [
    { id: "building_a_id", name: "Building A" },
    { id: "floor_2_id", name: "Floor 2" },
    { id: "room_101_id", name: "Room 101" }
  ],
  locationComplete: true,
  agencyName: "ABC Painters",
  agencyDate: "2025-12-15",
  additionalFieldValues: {
    paintType: "Epoxy",
    surfaceArea: "500"
  },
  photos: ["cloudinary_url_1", "cloudinary_url_2"],
  currentStep: "complete"
}
```

---

## ✅ Summary

The wizard provides a **flexible, all-at-once interface** where:
- ✅ All fields are visible simultaneously
- ✅ Users can fill fields in any order
- ✅ Each category has custom fields based on WorkflowRule
- ✅ Agency can be Yes/No or selection from list
- ✅ Subcategories fetched from database
- ✅ Location uses smart tree navigation
- ✅ Additional fields support multiple types
- ✅ Photos can be uploaded anytime
- ✅ "Create Ticket" button appears when complete

**Result**: A dynamic, user-friendly wizard that adapts to each category's specific requirements! 🎉
