# Capsule Alignment Fix & Audit Logs Implementation

## Summary
This document outlines the changes made to fix the Capsule component alignment issues and implement a comprehensive Audit Logs system.

## 1. Capsule Alignment Fix

### Issue
The SOURCE section in capsules was showing cut-off text and misaligned values.

### Solution
**File**: `src/components/Capsule.tsx`

- Added `min-w-0` class to prevent flex item overflow
- Added `gap-1` to create spacing between labels and values
- Added `whitespace-nowrap` to prevent text wrapping for labels

### Changes
```typescript
// Added min-w-0 to container
className="flex-1 px-2 sm:px-4 py-2 sm:py-3 flex flex-col justify-center relative transition-colors duration-200 min-w-0"

// Added gap-1 and whitespace-nowrap to rows
<div className="flex justify-between items-center text-[10px] sm:text-xs gap-1">
  <span style={{ color: labelColor }} className="whitespace-nowrap">In-house</span>
  <span className="font-semibold" style={{ color: textColor }}>{source.inHouse}</span>
</div>
```

## 2. Source Data Calculation Fix

### Issue
All capsules were showing incorrect source data (In-house vs Outsource) because the calculation was based on category.agency instead of ticket.agencyName.

### Solution
**File**: `src/app/dashboard/page.tsx`

Fixed the `calculateStats` function to check the ticket's `agencyName` field:

```typescript
// OLD (Incorrect)
subset.forEach((t: any) => {
  const catName = (t.category || "").toLowerCase();
  const cat = categories.find((c: any) => c.name.toLowerCase() === catName);
  if (cat && cat.agency) {
    outsource++;
  } else {
    inHouse++;
  }
});

// NEW (Correct)
subset.forEach((t: any) => {
  const agencyName = (t.agencyName || "").toString().trim();
  // Ticket is outsourced if it has a valid agency name
  if (agencyName && !["NONE", "__NONE__", ""].includes(agencyName.toUpperCase())) {
    outsource++;
  } else {
    inHouse++;
  }
});
```

## 3. Audit Logs System Implementation

### Overview
Created a comprehensive audit logging system to track all ticket activities including creation, completion, and assignment events.

### Components Created

#### A. API Route
**File**: `src/app/api/audit-logs/route.ts`

Features:
- Fetches tickets from database
- Transforms ticket data into audit log entries
- Supports filtering by:
  - Status (PENDING/COMPLETED)
  - User (creator or completer)
  - Category
  - Date range
- Returns structured audit logs with:
  - CREATED events (when ticket is created)
  - COMPLETED events (when ticket is completed)
  - ASSIGNED events (when ticket is assigned)

#### B. Audit Logs Page
**File**: `src/app/audit-logs/page.tsx`

Features:
- **Statistics Dashboard**: Shows total logs, created, completed, and assigned counts
- **Search Functionality**: Search by ticket ID, user, category, or description
- **Advanced Filters**:
  - Action type (Created/Completed/Assigned)
  - Status (Pending/Completed)
  - User
  - Category
  - Date range (From/To)
- **Export to CSV**: Download audit logs as CSV file
- **Detailed Table View**: Shows:
  - Timestamp (date and time)
  - Ticket ID
  - Action (with color-coded badges)
  - User who performed the action
  - Detailed information (category, priority, location, description, etc.)
- **Real-time Updates**: Auto-refreshes every 10 seconds
- **Responsive Design**: Works on mobile and desktop

#### C. Navigation Integration
**Files Modified**:
- `src/models/AdminUser.ts` - Added `audit_logs` to APP_SECTIONS
- `src/contexts/AuthContext.tsx` - Added `audit_logs` to SECTION_PATHS

The Audit Logs link now appears in the navigation bar for users with permission.

### Audit Log Entry Structure

Each audit log entry contains:
```typescript
{
  id: string;              // Unique identifier
  ticketId: string;        // Ticket ID (e.g., "T123")
  action: string;          // "CREATED" | "COMPLETED" | "ASSIGNED"
  user: string;            // Username who performed the action
  timestamp: Date;         // When the action occurred
  details: {
    category?: string;
    subCategory?: string;
    priority?: string;
    location?: string;
    description?: string;
    agencyName?: string;
    agencyDate?: Date;
    agencyTime?: string;
    completionPhotos?: number;
    completionVideos?: number;
    assignedTo?: string;
  }
}
```

### Permission Control

The Audit Logs section is permission-controlled:
- Super admins have automatic access
- Other users need the `audit_logs` permission granted in their admin user settings
- Access is controlled through the existing authentication system

## 4. MongoDB Connection Improvements

### Issue
MongoDB connection timeouts were not handled gracefully.

### Solution
**File**: `src/lib/mongodb.ts`

- Added timeout configuration (10s server selection timeout)
- Added error recovery (reset cached promise on failure)
- Added specific error messages for connection timeouts

**File**: `src/app/api/auth/login/route.ts`

- Enhanced error handling to distinguish between database connection errors and authentication failures
- Returns HTTP 503 for database connection issues
- Provides user-friendly error messages

## Testing Checklist

- [ ] Capsule SOURCE section displays correctly without text cutoff
- [ ] Source data (In-house/Outsource) is accurate across all capsules
- [ ] Audit Logs page loads successfully
- [ ] Audit Logs can be filtered by various criteria
- [ ] Search functionality works correctly
- [ ] CSV export generates valid file
- [ ] Navigation link appears for authorized users
- [ ] Permission control works correctly
- [ ] Real-time updates refresh data
- [ ] Responsive design works on mobile

## Notes

1. **Database Connectivity**: The application currently has MongoDB connection timeout issues. This needs to be resolved by:
   - Checking internet connectivity
   - Verifying MongoDB Atlas IP whitelist settings
   - Ensuring the cluster is not paused

2. **Super Admin Access**: The default super admin (username: `admin`) automatically has access to all sections including Audit Logs.

3. **Performance**: The audit logs API is limited to 500 entries by default. For production use with large datasets, consider implementing pagination.

4. **Future Enhancements**:
   - Add more granular audit events (e.g., ticket edits, deletions)
   - Implement audit log retention policies
   - Add user activity analytics
   - Create audit log archiving system
