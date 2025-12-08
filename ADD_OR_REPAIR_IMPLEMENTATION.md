# Add New or Repair Feature Implementation

## Overview
Successfully implemented a new workflow field called "Add New or Repair" that allows workflow masters to add a boolean toggle. When enabled (True), users will be prompted to choose between "Add" and "Repair" during ticket creation.

## Changes Made

### 1. Workflow Master Database Schema
**File:** `src/models/WorkflowRuleMaster.ts`
- Added `requiresAddOrRepair: boolean` field to the `IWorkflowRule` interface
- Added corresponding schema field with default value of `false`

### 2. Workflow Master UI
**File:** `src/app/masters/workflow-rules/page.tsx`
- Added `requiresAddOrRepair` to the `IWorkflowRule` TypeScript interface
- Added the field to form state initialization
- Imported `Wrench` icon from lucide-react
- Added a new Toggle component in the modal for "Add New or Repair"
- Added a badge display (emerald-colored) in the workflow rules list when this feature is enabled

### 3. Wizard Session Model
**File:** `src/models/WizardSession.ts`
- Added `addOrRepairChoice: "add" | "repair" | null` field to `IWizardSession` interface
- Added corresponding schema field with enum validation

### 4. Webhook Handler
**File:** `src/app/api/webhook/route.ts`

#### WizardField Interface
- Added `"add_or_repair"` to the field type union

#### buildFieldsFromRule Function
- Added logic to build the "Add or Repair" field when `rule.requiresAddOrRepair` is true
- Positioned after agency fields and before additional fields
- Label: "🔧 Add New or Repair"

#### updateFieldCompletion Function
- Added completion tracking for `add_or_repair` field
- Displays value as "➕ Add" or "🔧 Repair"

#### buildFieldKeyboard Function
- Added keyboard button options for the field:
  - "➕ Add" button
  - "🔧 Repair" button

#### Callback Handling (Select Action)
- Added case for `add_or_repair` field type
- Saves the user's choice ("add" or "repair") to session

#### Jump Action Handling
- Added case to clear `addOrRepairChoice` when user jumps back to this field

#### Ticket Creation
- Added `addOrRepairChoice` to the ticket data when creating from session

### 5. Ticket Model
**File:** `src/models/Ticket.ts`
- Added `addOrRepairChoice?: "add" | "repair" | null` field to `ITicket` interface
- Added corresponding schema field with enum validation

## How It Works

1. **Configuration**: Admin goes to Workflow Masters and enables the "Add New or Repair" toggle for a specific category

2. **User Flow**:
   - When enabled (True), the wizard will show a field asking "🔧 Add New or Repair"
   - User can choose between:
     - ➕ Add
     - 🔧 Repair
   - When disabled (False), this field is not shown and the workflow continues normally

3. **Storage**: The user's choice is stored in:
   - WizardSession during ticket creation
   - Final Ticket record after submission

## UI Elements

- **Toggle Icon**: 🔧 Wrench
- **Badge Color**: Emerald (green)
- **Button Options**:
  - ➕ Add
  - 🔧 Repair

## Database Fields Summary

| Model | Field Name | Type | Description |
|-------|-----------|------|-------------|
| WorkflowRule | `requiresAddOrRepair` | boolean | Toggle to enable/disable this feature |
| WizardSession | `addOrRepairChoice` | "add" \| "repair" \| null | Stores user's choice during wizard |
| Ticket | `addOrRepairChoice` | "add" \| "repair" \| null | Final choice stored in ticket |

## Testing
The implementation is complete and ready for testing. To test:

1. Navigate to `/masters/workflow-rules`
2. Create or edit a workflow rule
3. Enable the "Add New or Repair" toggle
4. Create a ticket for that category via Telegram
5. Verify the "🔧 Add New or Repair" field appears in the wizard
6. Select either "Add" or "Repair"
7. Complete the ticket creation
8. Verify the choice is stored in the ticket record
