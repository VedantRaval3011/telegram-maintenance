# Draggable Audit Modal Implementation

## ✅ Changes Made

### 1. **Removed Background Blur & Overlay**
- **Removed**: The dark semi-transparent overlay (`bg-black/60 backdrop-blur-sm`).
- **Updated Wrapper**: The modal wrapper is now `pointer-events-none`. This allows you to click and interact with the content *behind* the modal while it is open.
- **Removed specific close-on-background-click**: Since the background is now interactive, clicking outside no longer closes the modal automatically (this is standard behavior for modeless/draggable windows). The 'X' button in the header remains the primary way to close it.

### 2. **Implemented Draggable Functionality**
- **Draggable Header**: The modal can now be moved by clicking and dragging the **header** (where "Audit Insights" is written).
- **Cursor Feedback**: The cursor changes to a "move" icon when hovering over the header.
- **Smooth Dragging**: Uses direct DOM manipulation for smooth, lag-free dragging performance.
- **Smart Positioning**: The modal starts centered but can be moved anywhere on the screen.

## 🎨 User Experience
- **Modeless Interaction**: You can now open an audit report and move it aside to compare with other tickets on the dashboard.
- **No Obstruction**: The background remains fully visible and clear (no blur or dimming).

## 📁 Files Modified
- `src/components/TicketCard.tsx`: Added drag logic refs, event handlers, and updated modal JSX structure.
