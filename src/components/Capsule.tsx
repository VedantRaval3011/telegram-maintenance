import React, { useState } from "react";
import { Activity, ArrowUpCircle } from "lucide-react";

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

// Helper function to create a lighter version of a color
function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));

  return `rgb(${r}, ${g}, ${b})`;
}

// Helper function to determine if a color is light or dark
function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

interface CapsuleProps {
  title: string;
  total: number;
  priority: {
    high: number;
    medium: number;
    low: number;
  };
  source: {
    inHouse: number;
    outsource: number;
  };
  className?: string;
  onClick?: () => void;
  onAction?: (e: React.MouseEvent) => void;
  actionLabel?: string;
  onPriorityClick?: (priority: string) => void;
  selectedPriority?: string;
  color?: string;
  onScrollBack?: () => void;
  onAuditClick?: (e: React.MouseEvent) => void;
}

export default function Capsule({
  title,
  total,
  priority,
  source,
  className = "",
  onClick,
  onAction,
  actionLabel,
  onPriorityClick,
  selectedPriority,
  color,
  onScrollBack,
  onAuditClick,
}: CapsuleProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Use the color prop to generate section backgrounds
  const baseColor = color || "#6b7280"; // Default gray if no color provided
  const isLight = isLightColor(baseColor);

  // Generate different shades for sections - darker on hover
  const hoverOffset = isHovered ? 0.1 : 0; // Make colors darker on hover
  const priorityBg = lightenColor(baseColor, 0.85 - hoverOffset);
  const middleBg = lightenColor(baseColor, 0.75 - hoverOffset);
  const sourceBg = lightenColor(baseColor, 0.9 - hoverOffset);

  // Text colors based on the base color
  const textColor = isLight ? "#1f2937" : "#111827";
  const labelColor = isLight ? "#4b5563" : "#374151";

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "#ef4444"; // Red
      case "medium":
        return "#eab308"; // Yellow
      case "low":
        return "#10b981"; // Green
      default:
        return labelColor;
    }
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`rounded-xl sm:rounded-2xl shadow-sm overflow-hidden flex flex-row h-28 sm:h-32 border transition-all duration-200 ${onClick ? "cursor-pointer" : ""
        } ${isHovered ? "shadow-md" : ""} ${className}`}
      style={{
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '4px',
        borderTopColor: lightenColor(baseColor, 0.5),
        borderRightColor: lightenColor(baseColor, 0.5),
        borderBottomColor: lightenColor(baseColor, 0.5),
        borderLeftColor: baseColor,
        borderStyle: 'solid'
      }}
    >
      {/* Left Section: Priority */}
      <div
        className="flex-1 px-2 sm:px-4 py-2 sm:py-3 flex flex-col justify-center transition-colors duration-200"
        style={{ backgroundColor: priorityBg }}
      >
        <div
          className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide mb-1 sm:mb-2"
          style={{ color: labelColor }}
        >
          Priority
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onPriorityClick?.("high");
            }}
            className={`flex justify-between items-center text-[10px] sm:text-xs ${onPriorityClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
          >
            <span style={{ color: getPriorityColor("high") }} className="font-semibold">High</span>
            <span className="font-semibold" style={{ color: textColor }}>({priority.high})</span>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onPriorityClick?.("medium");
            }}
            className={`flex justify-between items-center text-[10px] sm:text-xs ${onPriorityClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
          >
            <span style={{ color: getPriorityColor("medium") }} className="font-semibold">Med</span>
            <span className="font-semibold" style={{ color: textColor }}>({priority.medium})</span>
          </div>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onPriorityClick?.("low");
            }}
            className={`flex justify-between items-center text-[10px] sm:text-xs ${onPriorityClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
          >
            <span style={{ color: getPriorityColor("low") }} className="font-semibold">Low</span>
            <span className="font-semibold" style={{ color: textColor }}>({priority.low})</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Total */}
      <div
        className="flex-1 px-2 sm:px-4 py-2 sm:py-3 flex flex-col justify-center items-center transition-colors duration-200 relative max-w-[150px]"
        style={{ backgroundColor: middleBg }}
        title={title}
      >
        <div 
          className="text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 text-center truncate w-full" 
          style={{ color: labelColor }}
        >
          {title}
        </div>
        <div className="text-2xl sm:text-4xl font-bold" style={{ color: textColor }}>{total}</div>
        
        {/* Audit & Scroll-back buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {onScrollBack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScrollBack();
              }}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
              title="Scroll to top"
            >
              <ArrowUpCircle size={16} style={{ color: labelColor }} />
            </button>
          )}
          {onAuditClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAuditClick(e);
              }}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
              title="View audit summary"
            >
              <Activity size={16} style={{ color: labelColor }} />
            </button>
          )}
        </div>
      </div>

      {/* Right Section: Source */}
      <div
        className="flex-1 px-2 sm:px-4 py-2 sm:py-3 flex flex-col justify-center relative transition-colors duration-200 min-w-0"
        style={{ backgroundColor: sourceBg }}
      >
        <div
          className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide mb-1 sm:mb-2"
          style={{ color: labelColor }}
        >
          Source
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex justify-between items-center text-[10px] sm:text-xs gap-1">
            <span style={{ color: labelColor }} className="whitespace-nowrap">In-house</span>
            <span className="font-semibold" style={{ color: textColor }}>{source.inHouse}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-xs gap-1">
            <span style={{ color: labelColor }} className="whitespace-nowrap">Outsource</span>
            <span className="font-semibold" style={{ color: textColor }}>{source.outsource}</span>
          </div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="absolute bottom-2 right-2 text-white text-[10px] px-2 py-1 rounded-lg opacity-90 hover:opacity-100 transition-opacity font-medium"
            style={{ backgroundColor: baseColor }}
          >
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </div>
  );
}
