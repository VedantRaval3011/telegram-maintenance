# UI Color Theme - Soft Pastel Professional

## Overview
This document outlines the soft pastel professional color theme applied to the Telegram Maintenance application.

## Priority Colors

### High Priority
- **Background**: `#F5E8FF` (soft lavender)
- **Text Color**: `#7A3EFE` (violet)
- **Usage**: High priority tickets and urgent items

### Medium Priority
- **Background**: `#EAF3FF` (soft ice blue)
- **Text Color**: `#297DFF` (blue)
- **Usage**: Medium priority tickets and standard items

### Low Priority
- **Background**: `#FFF0E6` (soft peach)
- **Text Color**: `#FF7A39` (orange)
- **Usage**: Low priority tickets and non-urgent items

## Category Colors

### Machine
- **Background**: `#E9F0FF`
- **Text Color**: `#4169E1`

### Electrical
- **Background**: `#F3E8FF`
- **Text Color**: `#9B4DFF`

### HVAC
- **Background**: `#E8FAFF`
- **Text Color**: `#0894C7`

### Cleaning
- **Background**: `#FFF5E6`
- **Text Color**: `#C67A00`

### Paint
- **Background**: `#F9E8FF`
- **Text Color**: `#C74AFF`

### Transfer / Others
- **Background**: `#E8FFF9`
- **Text Color**: `#00A38C`

## Design Guidelines

### Capsules
- **Border Radius**: 12-16px (using `rounded-xl` in Tailwind)
- **Inner Shadow**: Soft 1px inner shadow (`inset 0 1px 2px rgba(0, 0, 0, 0.05)`)
- **No Harsh Borders**: Removed all border utilities
- **Text**: NO white text on pastel backgrounds - always use colored text

### Key Rules
1. ❌ **Do NOT use**: red, yellow, or green colors
2. ✅ **Do use**: Soft tinted pastel backgrounds
3. ✅ **Always**: Match text color with background (e.g., violet text on lavender bg)
4. ✅ **Consistency**: Apply the same style across all capsules and badges

## Implementation Files

- **Capsule Component**: `src/components/Capsule.tsx`
- **Category Colors**: `src/lib/categoryColors.ts`
- **Ticket Card**: `src/components/TicketCard.tsx`

## Component Usage

```tsx
import Capsule from "@/components/Capsule";

// Priority capsule
<Capsule text="HIGH" type="priority" variant="high" />
<Capsule text="MEDIUM" type="priority" variant="medium" />
<Capsule text="LOW" type="priority" variant="low" />

// Category capsule
<Capsule text="Machine" type="category" variant="machine" />
<Capsule text="Electrical" type="category" variant="electrical" />
<Capsule text="HVAC" type="category" variant="hvac" />
```
