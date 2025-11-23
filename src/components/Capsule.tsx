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
      className={`bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl shadow-lg overflow-hidden flex flex-row h-28 min-w-[300px] ${
        onClick ? "cursor-pointer hover:shadow-xl transition-shadow" : ""
      } ${className}`}
      style={color ? { borderLeftWidth: '4px', borderLeftColor: color } : {}}
    >
      {/* Left Section: Priority */}
      <div className="flex-1 p-3 flex flex-col justify-center border-r border-[#c9b6a5]/50 bg-[#f5ebe0]">
        <div className="text-[10px] text-[#7d6856] font-medium mb-1 uppercase tracking-wider flex justify-between items-center">
          <span>Priority</span>
          {selectedPriority && onPriorityClick && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onPriorityClick("");
              }}
              className="text-[#2c2420] hover:text-red-600 font-bold px-1 rounded hover:bg-[#d4c0ae]/30 transition-colors"
              title="Reset Priority"
            >
              ×
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("high");
              }
            }}
            className={`flex justify-between items-center text-xs text-[#2c2420] px-1 rounded ${onPriorityClick ? "cursor-pointer hover:bg-[#d4c0ae]/50" : ""} ${selectedPriority === "high" ? "bg-[#d4c0ae]/50" : ""}`}
          >
            <span>High</span>
            <span className="font-bold">({priority.high})</span>
          </div>
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("medium");
              }
            }}
            className={`flex justify-between items-center text-xs text-[#2c2420] px-1 rounded ${onPriorityClick ? "cursor-pointer hover:bg-[#d4c0ae]/50" : ""} ${selectedPriority === "medium" ? "bg-[#d4c0ae]/50" : ""}`}
          >
            <span>Medium</span>
            <span className="font-bold">({priority.medium})</span>
          </div>
          <div 
            onClick={(e) => {
              if (onPriorityClick) {
                e.stopPropagation();
                onPriorityClick("low");
              }
            }}
            className={`flex justify-between items-center text-xs text-[#2c2420] px-1 rounded ${onPriorityClick ? "cursor-pointer hover:bg-[#d4c0ae]/50" : ""} ${selectedPriority === "low" ? "bg-[#d4c0ae]/50 " : ""}`}
          >
            <span>Low</span>
            <span className="font-bold">({priority.low})</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Total */}
      <div 
        className="flex-1 p-3 flex flex-col justify-center items-center bg-[#ede0d1]"
        style={color ? { backgroundColor: `${color}15` } : {}}
      >
        <div className="text-xs text-[#7d6856] font-medium mb-0.5">{title}</div>
        <div className="text-3xl font-extrabold text-[#2c2420]">{total}</div>
      </div>

      {/* Right Section: Source */}
      <div className="flex-1 p-3 flex flex-col justify-center border-l border-[#c9b6a5]/50 bg-[#f5ebe0] relative">
        <div className="text-[10px] text-[#7d6856] font-medium mb-1 uppercase tracking-wider">
          Source
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-xs text-[#2c2420]">
            <span>In-house</span>
            <span className="font-bold">{source.inHouse}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-[#2c2420]">
            <span>Outsource</span>
            <span className="font-bold">{source.outsource}</span>
          </div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="absolute bottom-1 right-1 bg-[#2c2420] text-[#f5ebe0] text-[10px] px-2 py-0.5 rounded-full opacity-80 hover:opacity-100 transition-opacity"
          >
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </div>
  );
}
