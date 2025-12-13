# Critical Bug Fix: Category Name Mismatch

## Problem Description

When clicking on a category like "Water & Air", the subcategories would appear, but the ticket list showed "Showing 0 tickets" and "No tickets match the current filters."

### Root Cause

There was a **mismatch between the category name used for filtering and the category name stored in tickets**:

1. **Category Data Structure:**
   - `cat.name` = Internal name (e.g., "water-air") - stored in database and tickets
   - `cat.displayName` = Display name (e.g., "Water & Air") - shown to users

2. **The Bug:**
   - Line 501: `categoryStats` used `cat.displayName` as the `name` property
   - Line 705: Click handler set filter to `cat.name` (which was actually the displayName)
   - Line 446: Filter compared `t.category` (internal name) with `category` filter (display name)
   - **Result:** "water-air" !== "Water & Air" → No tickets matched!

## The Fix

### 1. Store Both Names in categoryStats (Line 499-502)

**Before:**
```typescript
return {
  id: cat._id,
  name: cat.displayName, // Only display name
  stats: calculateStats(catTickets),
  color: cat.color,
};
```

**After:**
```typescript
return {
  id: cat._id,
  name: cat.displayName, // Display name for UI
  internalName: cat.name, // Internal name for filtering
  stats: calculateStats(catTickets),
  color: cat.color,
};
```

### 2. Use internalName for Filtering (Line 705)

**Before:**
```typescript
setFilters({ category: isAll ? "" : cat.name }); // cat.name is displayName!
```

**After:**
```typescript
setFilters({ category: isAll ? "" : cat.internalName }); // Use internal name
```

### 3. Update isCurrentlySelected Check (Line 690)

**Before:**
```typescript
const isCurrentlySelected = selectedCategory === cat.id || 
  (cat.id === "all" ? filters.category === "" : filters.category === cat.name);
```

**After:**
```typescript
const isCurrentlySelected = selectedCategory === cat.id || 
  (cat.id === "all" ? filters.category === "" : filters.category === cat.internalName);
```

### 4. Update Priority Click Handler (Line 722)

**Before:**
```typescript
setFilters({ 
  priority: filters.priority === p ? "" : p,
  category: cat.name // displayName
});
```

**After:**
```typescript
setFilters({ 
  priority: filters.priority === p ? "" : p,
  category: cat.internalName // internal name
});
```

### 5. Update className Condition (Line 728)

**Before:**
```typescript
className={(selectedCategory === cat.id || ... filters.category === cat.name) ? ...}
```

**After:**
```typescript
className={(selectedCategory === cat.id || ... filters.category === cat.internalName) ? ...}
```

## How It Works Now

### Data Flow:

1. **Category from Database:**
   ```json
   {
     "_id": "123",
     "name": "water-air",
     "displayName": "Water & Air"
   }
   ```

2. **Ticket from Database:**
   ```json
   {
     "ticketId": "T001",
     "category": "water-air",  // Uses internal name
     "description": "Fix leak"
   }
   ```

3. **Category Stats:**
   ```javascript
   {
     id: "123",
     name: "Water & Air",        // Display name (shown in UI)
     internalName: "water-air",  // Internal name (used for filtering)
     stats: { total: 4, ... }
   }
   ```

4. **Click Handler:**
   ```javascript
   setFilters({ category: "water-air" }); // Uses internalName
   ```

5. **Filter Logic:**
   ```javascript
   // Now this matches!
   t.category === "water-air"  // Ticket category
   category === "water-air"     // Filter value
   ```

## Files Modified

- `src/app/dashboard/page.tsx`
  - Line 500: Added `internalName` to categoryStats
  - Line 690: Use `internalName` in isCurrentlySelected check
  - Line 705: Use `internalName` when setting category filter
  - Line 722: Use `internalName` in priority click handler
  - Line 728: Use `internalName` in className condition

## Testing

✅ Click "Water & Air" category
✅ Subcategories appear (Distil, ICP)
✅ **Tickets now show: "Showing 4 tickets"** (FIXED!)
✅ All 4 tickets are displayed
✅ Can filter by subcategory
✅ Can filter by priority
✅ Category remains highlighted

## Result

The critical bug is now fixed! When you click on "Water & Air":
- ✅ Filter is set to "water-air" (internal name)
- ✅ Matches tickets with category "water-air"
- ✅ All 4 tickets are displayed correctly
- ✅ Subcategories are visible
- ✅ Page scrolls to ticket list
