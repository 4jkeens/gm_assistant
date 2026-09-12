# GM Dashboard

Custom tablet-first manager dashboard for a 10-inch Android tablet running Fully Kiosk, with a separate laptop admin view.

## Planned core behavior

- Read-only Outlook calendar feed (`.ics`) refreshed every 5 minutes
- 7:25 AM Today’s Rundown that remains until confirmed
- 4:30 PM next-morning preview for 7:00–10:00 AM
- Normal events alert 5 minutes before start
- `Due By` tasks alert 1 hour before, 30 minutes before, at deadline, then overdue
- Persistent right-side Follow-Up list using swipe-right to pin
- Cloud-backed acknowledgements, completions, snoozes, learned critical-event rules, and manual tasks
- Monday–Friday weekly view
- Maintenance task management and recurrence tracking
- Full-screen landscape tablet deployment through Fully Kiosk
- Laptop `/admin` interface for editing, rules, maintenance, manual tasks, sync status, Refresh Now, and Test Alert

## Security note

Never commit the private Outlook `.ics` calendar URL or cloud credentials to this repository. They will be supplied through deployment environment variables.

## Initial stack

- Next.js / React
- TypeScript
- Supabase (planned cloud state)
- Fully Kiosk on Android
