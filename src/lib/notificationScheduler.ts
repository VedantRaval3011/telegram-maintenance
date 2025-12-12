// lib/notificationScheduler.ts
import { connectToDB } from "@/lib/mongodb";
import { Ticket, ITicket } from "@/models/Ticket";
import { User } from "@/models/User";
import { Agency } from "@/models/AgencyMaster";
import { NotificationMaster } from "@/models/NotificationMaster";
import { NotificationLog } from "@/models/NotificationLog";
import {
  sendNotificationWithLog,
  buildPendingReminderMessage,
  buildAgencyVisitReminderMessage,
  buildMissedVisitMessage,
  buildTicketAssignedMessage
} from "@/lib/whatsapp";
import { SubCategory } from "@/models/SubCategoryMaster";

export interface SchedulerResult {
  success: boolean;
  pendingReminders: {
    checked: number;
    sent: number;
    errors: number;
  };
  agencyVisitReminders: {
    checked: number;
    sent: number;
    errors: number;
  };
  missedVisitAlerts: {
    checked: number;
    sent: number;
    errors: number;
  };
  duration: number;
}

/**
 * Main scheduler entry point - runs periodically via cron
 */
export async function runNotificationScheduler(): Promise<SchedulerResult> {
  const startTime = Date.now();
  console.log("[Scheduler] Starting notification scheduler...");

  await connectToDB();

  const result: SchedulerResult = {
    success: true,
    pendingReminders: { checked: 0, sent: 0, errors: 0 },
    agencyVisitReminders: { checked: 0, sent: 0, errors: 0 },
    missedVisitAlerts: { checked: 0, sent: 0, errors: 0 },
    duration: 0
  };

  try {
    // Run all checks
    const pendingResult = await checkPendingTicketReminders();
    result.pendingReminders = pendingResult;

    const visitResult = await checkAgencyVisitReminders();
    result.agencyVisitReminders = visitResult;

    const missedResult = await checkMissedVisitAlerts();
    result.missedVisitAlerts = missedResult;

  } catch (error) {
    console.error("[Scheduler] Error running scheduler:", error);
    result.success = false;
  }

  result.duration = Date.now() - startTime;
  console.log(`[Scheduler] Completed in ${result.duration}ms`, result);

  return result;
}

/**
 * Check for pending tickets that need reminders (12-hour logic)
 */
async function checkPendingTicketReminders(): Promise<{ checked: number; sent: number; errors: number }> {
  const stats = { checked: 0, sent: 0, errors: 0 };

  try {
    // Find all PENDING tickets
    const pendingTickets = await Ticket.find({ status: "PENDING" }).lean();
    stats.checked = pendingTickets.length;

    console.log(`[Scheduler] Found ${pendingTickets.length} pending tickets to check`);

    // Get all active user notification rules
    const userRules = await NotificationMaster.find({
      type: "user",
      active: true
    }).populate("userId subCategoryIds").lean();

    for (const ticket of pendingTickets) {
      try {
        const ticketCreatedAt = new Date(ticket.createdAt);
        const hoursElapsed = (Date.now() - ticketCreatedAt.getTime()) / (1000 * 60 * 60);

        // Find applicable rules based on subcategory
        const applicableRules = userRules.filter(rule => {
          // Check if rule's subcategories include this ticket's subcategory
          if (!ticket.subCategory) return false;
          
          const ruleSubCats = (rule.subCategoryIds as any[])?.map(sc => sc.name) || [];
          return ruleSubCats.includes(ticket.subCategory);
        });

        for (const rule of applicableRules) {
          const reminderAfterHours = rule.reminderAfterHours || 12;
          const maxReminders = rule.maxReminders || 3;

          // Check if time threshold exceeded
          if (hoursElapsed < reminderAfterHours) {
            continue; // Not yet time for reminder
          }

          // Calculate expected reminder number based on elapsed time
          const expectedReminderNum = Math.floor(hoursElapsed / reminderAfterHours);
          
          if (expectedReminderNum > maxReminders) {
            continue; // Max reminders already reached
          }

          // Check how many reminders already sent for this ticket + rule
          const remindersSent = await NotificationLog.countDocuments({
            ticketId: (ticket as any)._id,
            notificationMasterId: (rule as any)._id,
            type: { $in: ["first", "reminder"] }
          });

          if (remindersSent >= expectedReminderNum) {
            continue; // Reminder for this interval already sent
          }

          // Get user phone
          const user = rule.userId as any;
          if (!user?.phone) {
            console.log(`[Scheduler] User ${user?.firstName || "unknown"} has no phone number`);
            continue;
          }

          // Send reminder
          const content = buildPendingReminderMessage(
            ticket as unknown as ITicket,
            hoursElapsed,
            remindersSent + 1
          );

          const sendResult = await sendNotificationWithLog({
            phone: user.phone,
            content,
            ticketId: (ticket as any)._id.toString(),
            userId: (user as any)._id.toString(),
            notificationMasterId: (rule as any)._id.toString(),
            type: remindersSent === 0 ? "first" : "reminder",
            reminderCount: remindersSent + 1
          });

          if (sendResult.ok) {
            stats.sent++;
            console.log(`[Scheduler] Sent reminder #${remindersSent + 1} for ticket ${ticket.ticketId} to ${user.firstName}`);
          } else {
            stats.errors++;
            console.error(`[Scheduler] Failed to send reminder for ticket ${ticket.ticketId}:`, sendResult.error);
          }
        }
      } catch (ticketError) {
        stats.errors++;
        console.error(`[Scheduler] Error processing ticket ${ticket.ticketId}:`, ticketError);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkPendingTicketReminders:", error);
    stats.errors++;
  }

  return stats;
}

/**
 * Check for upcoming agency visits (notify before visit date)
 */
async function checkAgencyVisitReminders(): Promise<{ checked: number; sent: number; errors: number }> {
  const stats = { checked: 0, sent: 0, errors: 0 };

  try {
    // Get all active agency notification rules
    const agencyRules = await NotificationMaster.find({
      type: "agency",
      active: true
    }).populate("agencyId").lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const rule of agencyRules) {
      const notifyBeforeDays = rule.notifyBeforeDays || 1;
      const agency = rule.agencyId as any;

      if (!agency?.phone) {
        console.log(`[Scheduler] Agency ${agency?.name || "unknown"} has no phone number`);
        continue;
      }

      // Calculate target date (visit date = today + notifyBeforeDays)
      const targetVisitDate = new Date(today);
      targetVisitDate.setDate(targetVisitDate.getDate() + notifyBeforeDays);
      targetVisitDate.setHours(23, 59, 59, 999);

      const targetVisitDateStart = new Date(today);
      targetVisitDateStart.setDate(targetVisitDateStart.getDate() + notifyBeforeDays);
      targetVisitDateStart.setHours(0, 0, 0, 0);

      // Find tickets with this agency scheduled for target date
      const ticketsForVisit = await Ticket.find({
        agencyName: agency.name,
        agencyDate: {
          $gte: targetVisitDateStart,
          $lte: targetVisitDate
        },
        status: "PENDING"
      }).lean();

      stats.checked += ticketsForVisit.length;

      for (const ticket of ticketsForVisit) {
        try {
          // Check if reminder already sent
          const alreadySent = await NotificationLog.findOne({
            ticketId: (ticket as any)._id,
            agencyId: (agency as any)._id,
            type: "before_visit"
          });

          if (alreadySent) {
            continue; // Already reminded
          }

          // Send reminder
          const content = buildAgencyVisitReminderMessage(
            ticket as unknown as ITicket,
            ticket.agencyDate!
          );

          const sendResult = await sendNotificationWithLog({
            phone: agency.phone,
            content,
            ticketId: (ticket as any)._id.toString(),
            agencyId: (agency as any)._id.toString(),
            notificationMasterId: (rule as any)._id.toString(),
            type: "before_visit"
          });

          if (sendResult.ok) {
            stats.sent++;
            console.log(`[Scheduler] Sent visit reminder for ticket ${ticket.ticketId} to agency ${agency.name}`);
          } else {
            stats.errors++;
            console.error(`[Scheduler] Failed to send visit reminder:`, sendResult.error);
          }
        } catch (ticketError) {
          stats.errors++;
          console.error(`[Scheduler] Error sending visit reminder for ticket ${ticket.ticketId}:`, ticketError);
        }
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkAgencyVisitReminders:", error);
    stats.errors++;
  }

  return stats;
}

/**
 * Check for missed agency visits (agency didn't update status)
 */
async function checkMissedVisitAlerts(): Promise<{ checked: number; sent: number; errors: number }> {
  const stats = { checked: 0, sent: 0, errors: 0 };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find tickets where:
    // - agencyDate is today or earlier
    // - status is still PENDING
    const missedTickets = await Ticket.find({
      agencyDate: { $lt: today },
      status: "PENDING",
      agencyName: { $ne: null, $exists: true }
    }).lean();

    stats.checked = missedTickets.length;
    console.log(`[Scheduler] Found ${missedTickets.length} potentially missed visits`);

    for (const ticket of missedTickets) {
      try {
        // Check if missed visit alert already sent
        const alreadySent = await NotificationLog.findOne({
          ticketId: (ticket as any)._id,
          type: "missed_visit"
        });

        if (alreadySent) {
          continue; // Already alerted
        }

        // Find the agency
        const agency = await Agency.findOne({ name: ticket.agencyName, isActive: true });

        if (!agency?.phone) {
          console.log(`[Scheduler] Agency ${ticket.agencyName} not found or has no phone`);
          continue;
        }

        // Send missed visit alert
        const content = buildMissedVisitMessage(
          ticket as unknown as ITicket,
          ticket.agencyDate!
        );

        const sendResult = await sendNotificationWithLog({
          phone: agency.phone,
          content,
          ticketId: (ticket as any)._id.toString(),
          agencyId: agency._id.toString(),
          type: "missed_visit"
        });

        if (sendResult.ok) {
          stats.sent++;
          console.log(`[Scheduler] Sent missed visit alert for ticket ${ticket.ticketId} to agency ${agency.name}`);
        } else {
          stats.errors++;
          console.error(`[Scheduler] Failed to send missed visit alert:`, sendResult.error);
        }
      } catch (ticketError) {
        stats.errors++;
        console.error(`[Scheduler] Error sending missed visit alert for ticket ${ticket.ticketId}:`, ticketError);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkMissedVisitAlerts:", error);
    stats.errors++;
  }

  return stats;
}

/**
 * Trigger notification for a newly created ticket based on sub-category routing
 */
export async function triggerTicketCreatedNotification(ticket: ITicket): Promise<void> {
  console.log(`[Notification] Triggering notification for new ticket ${ticket.ticketId}`);

  try {
    await connectToDB();

    if (!ticket.subCategory) {
      console.log(`[Notification] Ticket ${ticket.ticketId} has no sub-category, skipping`);
      return;
    }

    // Find sub-category by name
    const subCategory = await SubCategory.findOne({ name: ticket.subCategory });
    if (!subCategory) {
      console.log(`[Notification] Sub-category ${ticket.subCategory} not found`);
      return;
    }

    // Find users assigned to this sub-category
    const usersWithSubCategory = await User.find({
      subCategories: subCategory._id,
      phone: { $exists: true, $nin: [null, ""] }
    }).lean();

    console.log(`[Notification] Found ${usersWithSubCategory.length} users for sub-category ${ticket.subCategory}`);

    for (const user of usersWithSubCategory) {
      if (!user.phone) continue;

      // Check if there's an active notification rule for this user
      const rule = await NotificationMaster.findOne({
        type: "user",
        userId: user._id,
        active: true
      });

      // Send notification
      const content = buildTicketAssignedMessage(ticket);

      const sendResult = await sendNotificationWithLog({
        phone: user.phone,
        content,
        ticketId: (ticket as any)._id?.toString(),
        userId: user._id.toString(),
        notificationMasterId: rule?._id?.toString(),
        type: "first",
        reminderCount: 1
      });

      if (sendResult.ok) {
        console.log(`[Notification] Sent ticket notification to ${user.firstName || user.username} for ${ticket.ticketId}`);
      } else {
        console.error(`[Notification] Failed to send notification to ${user.firstName}:`, sendResult.error);
      }
    }
  } catch (error) {
    console.error(`[Notification] Error triggering notification for ticket ${ticket.ticketId}:`, error);
  }
}
