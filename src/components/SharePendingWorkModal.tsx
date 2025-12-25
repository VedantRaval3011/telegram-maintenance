"use client";
import React, { useState } from "react";
import { X, Share2, MessageCircle, Copy, Check, Send } from "lucide-react";

interface Ticket {
  ticketId: string;
  description: string;
  priority: string;
  location?: string;
  agencyName?: string;
  photos?: string[];
  videos?: string[];
  status: string;
  category?: string;
  subCategory?: string;
}

interface SharePendingWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyName: string;
  tickets: Ticket[];
}

// Generate the pending work message
export function generatePendingWorkMessage(agencyName: string, tickets: Ticket[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Filter only pending tickets for this agency (exclude NONE agency)
  const pendingTickets = tickets.filter(
    (t) => t.status === "PENDING" && 
           t.agencyName && 
           !["NONE", "__NONE__"].includes(t.agencyName) &&
           t.agencyName.toLowerCase().trim() === agencyName.toLowerCase().trim()
  );

  if (pendingTickets.length === 0) {
    return `🛠️ Pending Maintenance Work Summary\nAgency: ${agencyName}\nDate: ${dateStr}\n\n✅ No pending tickets at this time.`;
  }

  // Group by priority
  const highPriority = pendingTickets.filter((t) => t.priority?.toLowerCase() === "high");
  const mediumPriority = pendingTickets.filter((t) => t.priority?.toLowerCase() === "medium");
  const lowPriority = pendingTickets.filter((t) => t.priority?.toLowerCase() === "low");

  let message = `🛠️ *Pending Maintenance Work Summary*\n`;
  message += `Agency: *${agencyName}*\n`;
  message += `Date: ${dateStr}\n\n`;
  message += `Total Pending Tickets: *${pendingTickets.length}*\n\n`;

  let ticketNumber = 1;

  // Format ticket details
  const formatTicket = (ticket: Ticket, index: number): string => {
    let text = `${ticketNumber}) Ticket: *${ticket.ticketId}*\n`;
    text += `   Issue: ${ticket.description || "No description"}\n`;
    
    // Add category and subcategory
    if (ticket.category) {
      const categoryDisplay = ticket.subCategory
        ? `${ticket.category} → ${ticket.subCategory}`
        : ticket.category;
      text += `   Category: ${categoryDisplay}\n`;
    }
    
    text += `   Location: ${ticket.location || "Not specified"}\n`;
    
    // Determine source (In-house vs Outsource)
    const source = ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)
      ? "Outsource"
      : "In-house";
    text += `   Source: ${source}\n`;

    // Add photos if available
    if (ticket.photos && ticket.photos.length > 0) {
      text += `   📷 Photos:\n`;
      ticket.photos.forEach((photoUrl) => {
        text += `   ${photoUrl}\n`;
      });
    }

    // Add videos if available
    if (ticket.videos && ticket.videos.length > 0) {
      text += `   🎬 Videos:\n`;
      ticket.videos.forEach((videoUrl) => {
        text += `   ${videoUrl}\n`;
      });
    }

    ticketNumber++;
    return text;
  };

  // High Priority
  if (highPriority.length > 0) {
    message += `🔴 *High Priority (${highPriority.length})*\n`;
    message += `${"─".repeat(20)}\n`;
    highPriority.forEach((ticket, idx) => {
      message += formatTicket(ticket, idx);
      message += "\n";
    });
  }

  // Medium Priority
  if (mediumPriority.length > 0) {
    message += `🟡 *Medium Priority (${mediumPriority.length})*\n`;
    message += `${"─".repeat(20)}\n`;
    mediumPriority.forEach((ticket, idx) => {
      message += formatTicket(ticket, idx);
      message += "\n";
    });
  }

  // Low Priority
  if (lowPriority.length > 0) {
    message += `🟢 *Low Priority (${lowPriority.length})*\n`;
    message += `${"─".repeat(20)}\n`;
    lowPriority.forEach((ticket, idx) => {
      message += formatTicket(ticket, idx);
      message += "\n";
    });
  }

  message += `\n📋 Please review the above pending issues and confirm action plan.`;

  return message;
}

// Plain text version (without markdown formatting)
export function generatePlainTextMessage(agencyName: string, tickets: Ticket[]): string {
  const formatted = generatePendingWorkMessage(agencyName, tickets);
  // Remove markdown formatting (* for bold)
  return formatted.replace(/\*/g, "");
}

export default function SharePendingWorkModal({
  isOpen,
  onClose,
  agencyName,
  tickets,
}: SharePendingWorkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const message = generatePendingWorkMessage(agencyName, tickets);
  const plainMessage = generatePlainTextMessage(agencyName, tickets);

  // WhatsApp deep link
  const handleWhatsAppShare = () => {
    const encodedMessage = encodeURIComponent(plainMessage);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  // Telegram deep link
  const handleTelegramShare = () => {
    const encodedMessage = encodeURIComponent(plainMessage);
    const telegramUrl = `https://t.me/share/url?text=${encodedMessage}`;
    window.open(telegramUrl, "_blank");
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Share2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Share Pending Work</h2>
              <p className="text-sm text-gray-600">{agencyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Message Preview */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Message Preview</label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto text-sm text-gray-800 font-mono whitespace-pre-wrap">
              {plainMessage}
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all group"
            >
              <div className="p-2 bg-green-500 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-green-800">Share on WhatsApp</div>
                <div className="text-xs text-green-600">Opens WhatsApp with message</div>
              </div>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Telegram */}
            <button
              onClick={handleTelegramShare}
              className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group"
            >
              <div className="p-2 bg-blue-500 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-blue-800">Share on Telegram</div>
                <div className="text-xs text-blue-600">Opens Telegram with message</div>
              </div>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all group"
            >
              <div className={`p-2 rounded-lg shadow-sm group-hover:scale-110 transition-all ${copied ? "bg-green-500" : "bg-gray-500"}`}>
                {copied ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Copy className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-gray-800">
                  {copied ? "Copied!" : "Copy Message"}
                </div>
                <div className="text-xs text-gray-600">
                  {copied ? "Message copied to clipboard" : "Copy to clipboard"}
                </div>
              </div>
              {!copied && (
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
