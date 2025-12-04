import React from "react";

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
}: CapsuleProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-row h-32 ${
        onClick ? "cursor-pointer hover:shadow-md transition-all duration-200" : ""
      } ${className}`}
      style={color ? { borderLeftWidth: '4px', borderLeftColor: color } : {}}
    >
      {/* Left Section: Priority */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-center border-r border-gray-100">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex justify-between items-center">
          <span>Priority</span>
          {selectedPriority && onPriorityClick && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onPriorityClick("");
              }}
              className="text-gray-400 hover:text-gray-600 font-bold text-sm px-1 rounded hover:bg-gray-50 transition-colors"
              title="Reset Priority"
            >
              ×
            </button>
          )}
        </div>
        <div className="space-y-1">
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("high");
              }
            }}
            className={`flex justify-between items-center text-xs ${
              onPriorityClick ? "cursor-pointer" : ""
            } ${selectedPriority === "high" ? "font-semibold" : ""}`}
          >
            <span className="text-gray-600">High</span>
            <span className="font-semibold text-gray-900">({priority.high})</span>
          </div>
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("medium");
              }
            }}
            className={`flex justify-between items-center text-xs ${
              onPriorityClick ? "cursor-pointer" : ""
            } ${selectedPriority === "medium" ? "font-semibold" : ""}`}
          >
            <span className="text-gray-600">Medium</span>
            <span className="font-semibold text-gray-900">({priority.medium})</span>
          </div>
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("low");
              }
            }}
            className={`flex justify-between items-center text-xs ${
              onPriorityClick ? "cursor-pointer" : ""
            } ${selectedPriority === "low" ? "font-semibold" : ""}`}
          >
            <span className="text-gray-600">Low</span>
            <span className="font-semibold text-gray-900">({priority.low})</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Total */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-center items-center bg-gray-50/50">
        <div className="text-xs font-medium text-gray-600 mb-1">{title}</div>
        <div className="text-4xl font-bold text-gray-900">{total}</div>
      </div>

      {/* Right Section: Source */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-center border-l border-gray-100 relative">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Source
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">In-house</span>
            <span className="font-semibold text-gray-900">{source.inHouse}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Outsource</span>
            <span className="font-semibold text-gray-900">{source.outsource}</span>
          </div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="absolute bottom-2 right-2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-90 hover:opacity-100 transition-opacity font-medium"
          >
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </div>
  );
}
