"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  Palette,
  Shield,
  Zap,
  Download,
  Upload,
  Save,
  RefreshCw,
  MessageSquare,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Globe,
  Moon,
  Sun,
} from "lucide-react";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    companyName: "Maintenance Operations",
    botToken: "",
    chatId: "",
    timezone: "Asia/Kolkata",
    language: "en",
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    enableNotifications: true,
    notifyOnNewTicket: true,
    notifyOnCompletion: true,
    notifyOnHighPriority: true,
    notifyOnAssignment: true,
    dailySummary: true,
    summaryTime: "09:00",
    weeklyReport: true,
    reportDay: "monday",
  });

  // System Preferences
  const [systemSettings, setSystemSettings] = useState({
    autoAssignment: false,
    priorityThreshold: "high",
    autoCloseCompleted: false,
    autoCloseDays: 7,
    requirePhotos: false,
    allowGuestTickets: false,
    maxTicketsPerUser: 10,
  });

  // Display Preferences
  const [displaySettings, setDisplaySettings] = useState({
    theme: "light",
    compactView: false,
    showTicketIds: true,
    defaultView: "pending",
    itemsPerPage: 20,
    enableAnimations: true,
  });

  const sections: SettingsSection[] = [
    {
      id: "general",
      title: "General Settings",
      icon: <SettingsIcon className="w-5 h-5" />,
      description: "Basic configuration and company information",
    },
    {
      id: "notifications",
      title: "Notifications",
      icon: <Bell className="w-5 h-5" />,
      description: "Configure Telegram alerts and reports",
    },
    {
      id: "system",
      title: "System Preferences",
      icon: <Zap className="w-5 h-5" />,
      description: "Automation rules and system behavior",
    },
    {
      id: "display",
      title: "Display & Theme",
      icon: <Palette className="w-5 h-5" />,
      description: "Customize appearance and layout",
    },
    {
      id: "data",
      title: "Data Management",
      icon: <Database className="w-5 h-5" />,
      description: "Backup, export, and import data",
    },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Here you would make actual API calls to save settings
    // For now, we'll just show success
    setIsSaving(false);
    setSaveSuccess(true);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleExport = () => {
    const allSettings = {
      general: generalSettings,
      notifications: notificationSettings,
      system: systemSettings,
      display: displaySettings,
    };

    const dataStr = JSON.stringify(allSettings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `settings-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          try {
            const settings = JSON.parse(event.target.result);
            if (settings.general) setGeneralSettings(settings.general);
            if (settings.notifications) setNotificationSettings(settings.notifications);
            if (settings.system) setSystemSettings(settings.system);
            if (settings.display) setDisplaySettings(settings.display);
            alert("Settings imported successfully!");
          } catch (error) {
            alert("Failed to import settings. Invalid file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 text-gray-700" />
                Settings & Configuration
              </h1>
              <p className="text-gray-600">
                Manage your maintenance system preferences and configurations
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg border border-green-200 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Saved successfully!</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === section.id
                        ? "bg-blue-50 text-blue-700 border-2 border-blue-200 shadow-sm"
                        : "text-gray-700 hover:bg-gray-50 border-2 border-transparent"
                    }`}
                  >
                    <div
                      className={`${
                        activeSection === section.id ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {section.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{section.title}</div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {/* General Settings */}
              {activeSection === "general" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <SettingsIcon className="w-6 h-6 text-blue-600" />
                      General Settings
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Configure basic system information and Telegram bot integration
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={generalSettings.companyName}
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, companyName: e.target.value })
                        }
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
                        placeholder="Your Company Name"
                      />
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h3 className="font-bold text-gray-900 mb-1">Telegram Bot Configuration</h3>
                          <p className="text-sm text-gray-600">
                            Configure your Telegram bot for receiving notifications and updates
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Bot Token
                          </label>
                          <input
                            type="password"
                            value={generalSettings.botToken}
                            onChange={(e) =>
                              setGeneralSettings({ ...generalSettings, botToken: e.target.value })
                            }
                            className="w-full bg-white border border-blue-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all font-mono text-sm"
                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                          />
                          <p className="text-xs text-gray-600 mt-1.5">
                            Get your bot token from{" "}
                            <a
                              href="https://t.me/BotFather"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium"
                            >
                              @BotFather
                            </a>
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Chat ID / Group ID
                          </label>
                          <input
                            type="text"
                            value={generalSettings.chatId}
                            onChange={(e) =>
                              setGeneralSettings({ ...generalSettings, chatId: e.target.value })
                            }
                            className="w-full bg-white border border-blue-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all font-mono text-sm"
                            placeholder="-1001234567890"
                          />
                          <p className="text-xs text-gray-600 mt-1.5">
                            The chat or group where notifications will be sent
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <Globe className="w-4 h-4 inline mr-1" />
                          Timezone
                        </label>
                        <select
                          value={generalSettings.timezone}
                          onChange={(e) =>
                            setGeneralSettings({ ...generalSettings, timezone: e.target.value })
                          }
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="America/New_York">America/New York (EST)</option>
                          <option value="Europe/London">Europe/London (GMT)</option>
                          <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                          <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Language
                        </label>
                        <select
                          value={generalSettings.language}
                          onChange={(e) =>
                            setGeneralSettings({ ...generalSettings, language: e.target.value })
                          }
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिन्दी (Hindi)</option>
                          <option value="ar">العربية (Arabic)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeSection === "notifications" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Bell className="w-6 h-6 text-blue-600" />
                      Notification Settings
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Configure when and how you receive Telegram notifications
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Master Toggle */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="font-bold text-gray-900">Enable Notifications</div>
                            <div className="text-sm text-gray-600">
                              Master switch for all Telegram notifications
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={notificationSettings.enableNotifications}
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                enableNotifications: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                      </label>
                    </div>

                    {/* Individual Notification Toggles */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Event Notifications
                      </h3>

                      {[
                        {
                          key: "notifyOnNewTicket",
                          label: "New Ticket Created",
                          description: "Get notified when a new maintenance ticket is created",
                          icon: <AlertTriangle className="w-4 h-4" />,
                        },
                        {
                          key: "notifyOnCompletion",
                          label: "Ticket Completed",
                          description: "Get notified when a ticket is marked as completed",
                          icon: <CheckCircle2 className="w-4 h-4" />,
                        },
                        {
                          key: "notifyOnHighPriority",
                          label: "High Priority Tickets",
                          description: "Immediate alerts for high-priority maintenance issues",
                          icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
                        },
                        {
                          key: "notifyOnAssignment",
                          label: "Ticket Assignment",
                          description: "Notify when tickets are assigned to users or agencies",
                          icon: <Users className="w-4 h-4" />,
                        },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-gray-600">{item.icon}</div>
                            <div>
                              <div className="font-medium text-gray-900">{item.label}</div>
                              <div className="text-sm text-gray-600">{item.description}</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={
                              notificationSettings[
                                item.key as keyof typeof notificationSettings
                              ] as boolean
                            }
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                [item.key]: e.target.checked,
                              })
                            }
                            disabled={!notificationSettings.enableNotifications}
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                          />
                        </label>
                      ))}
                    </div>

                    {/* Scheduled Reports */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Scheduled Reports
                      </h3>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="flex items-center justify-between mb-4 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Daily Summary</div>
                              <div className="text-sm text-gray-600">
                                Receive a daily summary of all activities
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={notificationSettings.dailySummary}
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                dailySummary: e.target.checked,
                              })
                            }
                            disabled={!notificationSettings.enableNotifications}
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                          />
                        </label>

                        {notificationSettings.dailySummary && (
                          <div className="ml-7">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Summary Time
                            </label>
                            <input
                              type="time"
                              value={notificationSettings.summaryTime}
                              onChange={(e) =>
                                setNotificationSettings({
                                  ...notificationSettings,
                                  summaryTime: e.target.value,
                                })
                              }
                              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="flex items-center justify-between mb-4 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Weekly Report</div>
                              <div className="text-sm text-gray-600">
                                Comprehensive weekly performance report
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={notificationSettings.weeklyReport}
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                weeklyReport: e.target.checked,
                              })
                            }
                            disabled={!notificationSettings.enableNotifications}
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                          />
                        </label>

                        {notificationSettings.weeklyReport && (
                          <div className="ml-7">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Report Day
                            </label>
                            <select
                              value={notificationSettings.reportDay}
                              onChange={(e) =>
                                setNotificationSettings({
                                  ...notificationSettings,
                                  reportDay: e.target.value,
                                })
                              }
                              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                            >
                              <option value="monday">Monday</option>
                              <option value="tuesday">Tuesday</option>
                              <option value="wednesday">Wednesday</option>
                              <option value="thursday">Thursday</option>
                              <option value="friday">Friday</option>
                              <option value="saturday">Saturday</option>
                              <option value="sunday">Sunday</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* System Preferences */}
              {activeSection === "system" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Zap className="w-6 h-6 text-blue-600" />
                      System Preferences
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Configure automation rules and system behavior
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Automation Settings */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Automation Rules
                      </h3>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="flex items-center justify-between mb-4 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-amber-600" />
                            <div>
                              <div className="font-medium text-gray-900">Auto-Assignment</div>
                              <div className="text-sm text-gray-600">
                                Automatically assign tickets to agencies based on category
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={systemSettings.autoAssignment}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                autoAssignment: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="flex items-center justify-between mb-4 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <div>
                              <div className="font-medium text-gray-900">
                                Auto-Close Completed Tickets
                              </div>
                              <div className="text-sm text-gray-600">
                                Automatically archive tickets after completion
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={systemSettings.autoCloseCompleted}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                autoCloseCompleted: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>

                        {systemSettings.autoCloseCompleted && (
                          <div className="ml-7">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Days before auto-close
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={systemSettings.autoCloseDays}
                              onChange={(e) =>
                                setSystemSettings({
                                  ...systemSettings,
                                  autoCloseDays: parseInt(e.target.value),
                                })
                              }
                              className="w-32 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ticket Constraints */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Ticket Constraints
                      </h3>

                      <div className="grid grid-cols-1 gap-3">
                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Shield className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Require Photos</div>
                              <div className="text-sm text-gray-600">
                                Make photo uploads mandatory for ticket completion
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={systemSettings.requirePhotos}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                requirePhotos: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Allow Guest Tickets</div>
                              <div className="text-sm text-gray-600">
                                Allow ticket creation without user authentication
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={systemSettings.allowGuestTickets}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                allowGuestTickets: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum Tickets Per User
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={systemSettings.maxTicketsPerUser}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              maxTicketsPerUser: parseInt(e.target.value),
                            })
                          }
                          className="w-32 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        />
                        <p className="text-xs text-gray-600 mt-1.5">
                          Limit concurrent open tickets per user
                        </p>
                      </div>
                    </div>

                    {/* Priority Settings */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Priority Management
                      </h3>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Default Priority Threshold
                        </label>
                        <select
                          value={systemSettings.priorityThreshold}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              priorityThreshold: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                        <p className="text-xs text-gray-600 mt-1.5">
                          Default priority for new tickets created via Telegram
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Display & Theme */}
              {activeSection === "display" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Palette className="w-6 h-6 text-blue-600" />
                      Display & Theme
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Customize the appearance and layout of your dashboard
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Theme Selection */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Theme
                      </h3>

                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { value: "light", label: "Light", icon: <Sun className="w-5 h-5" /> },
                          { value: "dark", label: "Dark", icon: <Moon className="w-5 h-5" /> },
                          { value: "auto", label: "Auto", icon: <Globe className="w-5 h-5" /> },
                        ].map((theme) => (
                          <button
                            key={theme.value}
                            onClick={() =>
                              setDisplaySettings({ ...displaySettings, theme: theme.value })
                            }
                            className={`p-4 rounded-xl border-2 transition-all ${
                              displaySettings.theme === theme.value
                                ? "border-blue-500 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div
                                className={
                                  displaySettings.theme === theme.value
                                    ? "text-blue-600"
                                    : "text-gray-600"
                                }
                              >
                                {theme.icon}
                              </div>
                              <span className="font-medium text-sm">{theme.label}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* View Preferences */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        View Preferences
                      </h3>

                      <div className="grid grid-cols-1 gap-3">
                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Info className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Compact View</div>
                              <div className="text-sm text-gray-600">
                                Show more items with reduced spacing
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={displaySettings.compactView}
                            onChange={(e) =>
                              setDisplaySettings({
                                ...displaySettings,
                                compactView: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Info className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Show Ticket IDs</div>
                              <div className="text-sm text-gray-600">
                                Display ticket IDs in the ticket list
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={displaySettings.showTicketIds}
                            onChange={(e) =>
                              setDisplaySettings({
                                ...displaySettings,
                                showTicketIds: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">Enable Animations</div>
                              <div className="text-sm text-gray-600">
                                Show smooth transitions and animations
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={displaySettings.enableAnimations}
                            onChange={(e) =>
                              setDisplaySettings({
                                ...displaySettings,
                                enableAnimations: e.target.checked,
                              })
                            }
                            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Default View */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Dashboard Defaults
                      </h3>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Default View
                        </label>
                        <select
                          value={displaySettings.defaultView}
                          onChange={(e) =>
                            setDisplaySettings({
                              ...displaySettings,
                              defaultView: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        >
                          <option value="pending">Pending Tickets</option>
                          <option value="completed">Completed Tickets</option>
                          <option value="all">All Tickets</option>
                        </select>
                        <p className="text-xs text-gray-600 mt-1.5">
                          Default filter when opening the dashboard
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Items Per Page
                        </label>
                        <select
                          value={displaySettings.itemsPerPage}
                          onChange={(e) =>
                            setDisplaySettings({
                              ...displaySettings,
                              itemsPerPage: parseInt(e.target.value),
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        >
                          <option value="10">10 items</option>
                          <option value="20">20 items</option>
                          <option value="50">50 items</option>
                          <option value="100">100 items</option>
                        </select>
                        <p className="text-xs text-gray-600 mt-1.5">
                          Number of tickets to display per page
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Management */}
              {activeSection === "data" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Database className="w-6 h-6 text-blue-600" />
                      Data Management
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Backup, export, and manage your system data
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Backup & Restore */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Settings Backup
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={handleExport}
                          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95"
                        >
                          <Download className="w-5 h-5" />
                          Export Settings
                        </button>

                        <button
                          onClick={handleImport}
                          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                          <Upload className="w-5 h-5" />
                          Import Settings
                        </button>
                      </div>

                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-gray-700">
                            <p className="font-semibold text-gray-900 mb-1">
                              Backup Your Settings
                            </p>
                            <p>
                              Export your current settings to a JSON file for backup or transfer to
                              another system. You can import these settings later to restore your
                              configuration.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Data Export */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                        Data Export
                      </h3>

                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
                        <h4 className="font-bold text-gray-900 mb-3">Export Ticket Data</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Export all your ticket data to various formats for analysis or archival
                        </p>

                        <div className="grid grid-cols-3 gap-3">
                          <button className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-900 px-4 py-3 rounded-lg font-medium border-2 border-purple-200 transition-all active:scale-95">
                            <Download className="w-4 h-4" />
                            CSV
                          </button>
                          <button className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-900 px-4 py-3 rounded-lg font-medium border-2 border-purple-200 transition-all active:scale-95">
                            <Download className="w-4 h-4" />
                            Excel
                          </button>
                          <button className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-900 px-4 py-3 rounded-lg font-medium border-2 border-purple-200 transition-all active:scale-95">
                            <Download className="w-4 h-4" />
                            JSON
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-red-900 text-sm uppercase tracking-wide">
                        Danger Zone
                      </h3>

                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                        <div className="flex items-start gap-3 mb-4">
                          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-bold text-red-900 mb-1">Reset All Settings</h4>
                            <p className="text-sm text-red-700">
                              This will reset all settings to their default values. This action
                              cannot be undone.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to reset all settings? This cannot be undone."
                              )
                            ) {
                              // Reset logic here
                              alert("Settings reset to defaults");
                            }
                          }}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all active:scale-95"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reset to Defaults
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
