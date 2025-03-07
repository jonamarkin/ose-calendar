# 📅 Open Source Events Calendar

🚀 **Automatically updated calendar for upcoming open-source events worldwide!**

This project pulls event data from the [Everything Open Source](https://github.com/Everything-Open-Source/open-source-events) repository and generates an **ICS calendar feed** that users can subscribe to in Google Calendar, Outlook, Apple Calendar, and more.

---

## 📌 Features

✅ **Auto-updated** calendar feed  
✅ Works with **Google, Outlook, and Apple Calendar**  
✅ **Easy to subscribe**—just add the ICS URL!

---

## 📆 Subscribe to the Calendar

### 🔗 ICS Calendar Link

Add this URL to your calendar app to automatically sync upcoming open-source events:  
https://jonamarkin.github.io/ose-calendar/events.ics

### How to Add It?

#### 📌 Google Calendar

1. Open [Google Calendar](https://calendar.google.com/)
2. Click **"+" next to "Other calendars"**
3. Select **"From URL"**
4. Paste this URL

5. Click **"Add Calendar"** ✅

#### 📌 Apple Calendar (Mac/iPhone)

1. Open **Calendar** app
2. Click **File → New Calendar Subscription**
3. Paste the ICS URL and click **Subscribe**
4. Set "Auto-refresh" to ensure updates sync

#### 📌 Microsoft Outlook

1. Open **Outlook Calendar**
2. Click **"Add Calendar" → "Subscribe from Web"**
3. Paste the ICS URL
4. Click **"Import"**

---

## 📜 How It Works

This project fetches the latest event list from the [Everything Open Source](https://github.com/Everything-Open-Source/open-source-events) repository and:  
✅ Parses event details from the `README.md`  
✅ Generates an `.ics` file with all upcoming events  
✅ Hosts the `.ics` file publicly using GitHub Pages  
✅ Automatically updates the calendar when the event list changes

💡 **GitHub Actions** runs a workflow that updates the `.ics` file everyday!

---
