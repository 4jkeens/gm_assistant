# GM Dashboard

Custom tablet-first manager dashboard for a 10-inch Android tablet running Fully Kiosk, with a separate laptop admin view.

## Version 1 prototype now in the repo

The first working UI prototype is now committed on `main`.

### Tablet route
- `/`
- Dark Home Assistant-style layout
- Outlook calendar panel always visible on the left
- Today-only upcoming schedule below the calendar
- Large next-priority task card
- 3–4 smaller upcoming task cards
- 7:25 AM Today’s Rundown
- 4:30 PM Tomorrow Morning preview
- 5-minute normal event behavior represented in the prototype logic
- Due By task states
- Confirm, Snooze 30, Complete, and 5-second Undo
- Swipe right to add a task to Follow-Up
- Swipe left to dismiss a task
- Persistent right-side Follow-Up list with overdue-first sorting
- Tap cards to expand details
- Daily, Monday–Friday Weekly, and Maintenance views
- 5-minute idle dimming behavior
- Offline / last-synced status

### Laptop admin route
- `/admin`
- Summary cards for Overdue, Due Today, Follow-Up, Maintenance Due, and Outlook Sync
- Manual `Refresh Now`
- Prototype `Test Alert`
- Manual task form with Due By as the default
- Daily / weekly / monthly / yearly recurrence choices
- Advanced options for warning timing, morning rundown, Follow-Up, and categories
- Maintenance overview with overdue items
- Learned Critical Event rules
- Alert defaults summary

## Planned integrations

- Read-only Outlook calendar feed (`.ics`) refreshed every 5 minutes
- Supabase cloud state for confirmations, completions, snoozes, Follow-Up, learned rules, maintenance, and manual tasks
- Fully Kiosk wake/brightness/relaunch behavior
- Cross-device Test Alert from laptop to tablet

## Security note

Never commit the private Outlook `.ics` calendar URL or cloud credentials to this repository. They will be supplied through deployment environment variables.

## Stack

- Next.js / React
- TypeScript
- Supabase (next integration step)
- Fully Kiosk on Android
- GitHub Actions build check

## Local development

```bash
npm install
npm run dev
```

Then open:
- Tablet view: `http://localhost:3000/`
- Admin view: `http://localhost:3000/admin`
