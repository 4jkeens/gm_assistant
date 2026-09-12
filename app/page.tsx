"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type TaskKind = "meeting" | "due" | "maintenance" | "allDay";
type ViewMode = "dashboard" | "daily" | "weekly" | "maintenance";

type Task = {
  id: string;
  title: string;
  kind: TaskKind;
  time?: string;
  dueTime?: string;
  description?: string;
  location?: string;
  critical?: boolean;
  completed?: boolean;
  acknowledged?: boolean;
  dismissed?: boolean;
  canceled?: boolean;
  snoozedUntil?: number | null;
  sourceType?: "prototype" | "manual";
  dueAt?: string | null;
  startsAt?: string | null;
};

const seedTasks: Task[] = [
  {
    id: "production-meeting",
    title: "Production Meeting",
    kind: "meeting",
    time: "7:30 AM",
    description: "Morning production review",
    location: "Production floor",
    critical: true,
  },
  {
    id: "parts-ops",
    title: "Parts / OPS Trax",
    kind: "due",
    dueTime: "11:30 AM",
    description: "Due By 11:30 AM — review parts and OPS Trax status.",
  },
  {
    id: "shop-walk",
    title: "Daily Shop Walk",
    kind: "maintenance",
    time: "3:00 PM",
    description: "Front + back of house facility walk.",
    location: "Shop",
  },
  {
    id: "payroll",
    title: "Payroll / Workday Check",
    kind: "due",
    dueTime: "4:00 PM",
    description: "Due By 4:00 PM — verify payroll and Workday items.",
    critical: true,
  },
  {
    id: "staffing-notes",
    title: "Review Staffing Notes",
    kind: "allDay",
    description: "All-day reminder. Re-acknowledge at 1:00 PM if still active.",
  },
];

const schedule = [
  { time: "7:30 AM", title: "Production Meeting", meta: "Production floor" },
  { time: "9:00 AM", title: "WIP Review", meta: "Office" },
  { time: "11:30 AM", title: "Parts / OPS Trax — Due By", meta: "System" },
  { time: "1:00 PM", title: "All-Day Reminder Check", meta: "Dashboard" },
  { time: "3:00 PM", title: "Daily Shop Walk", meta: "Front + Back" },
  { time: "4:00 PM", title: "Payroll / Workday — Due By", meta: "Office" },
];

const weeklyMajor = [
  { day: "Mon", items: ["Production Meeting", "Parts / OPS Trax"] },
  { day: "Tue", items: ["Production Meeting", "Payroll Check"] },
  { day: "Wed", items: ["Production Meeting", "Shop Walk"] },
  { day: "Thu", items: ["Production Meeting", "Parts / OPS Trax"] },
  { day: "Fri", items: ["Production Meeting", "Payroll"] },
];

function parseTodayTime(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function taskTarget(task: Task) {
  const cloudValue = task.kind === "due" ? task.dueAt : task.startsAt;
  if (cloudValue) {
    const cloudDate = new Date(cloudValue);
    if (!Number.isNaN(cloudDate.getTime())) return cloudDate;
  }
  const value = task.kind === "due" ? task.dueTime : task.time;
  return parseTodayTime(value);
}

function minutesUntil(task: Task, now: Date) {
  const target = taskTarget(task);
  if (!target) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 60000);
}

function urgency(task: Task, now: Date) {
  if (task.canceled) return "canceled";
  if (task.completed) return "completed";
  if (task.snoozedUntil && task.snoozedUntil > now.getTime()) return "snoozed";
  const mins = minutesUntil(task, now);
  if (task.kind === "allDay") return "upcoming";
  if (mins === null) return "upcoming";
  if (mins < 0) return "overdue";
  if (task.kind === "due") {
    if (mins <= 30) return "due";
    if (mins <= 60) return "warning";
    return "upcoming";
  }
  if (mins <= 5) return "due";
  return task.acknowledged ? "confirmed" : "upcoming";
}

function countdownText(task: Task, now: Date) {
  const mins = minutesUntil(task, now);
  if (task.kind === "allDay") return "All-day";
  if (mins === null) return "Upcoming";
  if (mins < 0) return `Overdue by ${Math.abs(mins)} min`;
  if (mins === 0) return task.kind === "due" ? "Due now" : "Starts now";
  return task.kind === "due" ? `Due in ${mins} min` : `Starts in ${mins} min`;
}

function todayKey(prefix: string) {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function SwipeCard({
  task,
  children,
  onPin,
  onDismiss,
  className = "",
}: {
  task: Task;
  children: React.ReactNode;
  onPin: (id: string) => void;
  onDismiss: (id: string) => void;
  className?: string;
}) {
  const start = useRef<number | null>(null);
  return (
    <div
      className={className}
      onTouchStart={(e) => {
        start.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (start.current === null) return;
        const end = e.changedTouches[0]?.clientX ?? start.current;
        const delta = end - start.current;
        if (delta > 70) onPin(task.id);
        if (delta < -70) onDismiss(task.id);
        start.current = null;
      }}
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [followUp, setFollowUp] = useState<string[]>(["payroll"]);
  const [expandedFollowUp, setExpandedFollowUp] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [undo, setUndo] = useState<{ id: string; wasPinned: boolean } | null>(null);
  const [dimmed, setDimmed] = useState(false);
  const [rundownConfirmed, setRundownConfirmed] = useState(false);
  const [tomorrowConfirmed, setTomorrowConfirmed] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCloudTasks = async () => {
    const [{ data: taskRows }, { data: stateRows }] = await Promise.all([
      supabase
        .from("manual_tasks")
        .select("id,title,notes,task_mode,due_at,starts_at,critical,category,pin_by_default")
        .eq("enabled", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_occurrence_state")
        .select("occurrence_key,acknowledged_at,completed_at,snoozed_until,pinned_at,dismissed_at")
        .eq("source_type", "manual"),
    ]);

    if (!taskRows) return;

    const stateMap = new Map((stateRows || []).map((row) => [row.occurrence_key, row]));
    const manualIds = new Set(taskRows.map((row) => row.id));
    const pinnedIds: string[] = [];

    const cloudTasks: Task[] = taskRows.map((row) => {
      const state = stateMap.get(`manual:${row.id}`);
      const when = row.task_mode === "due_by" ? row.due_at : row.starts_at;
      const timeLabel = when
        ? new Date(when).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : undefined;
      const pinned = Boolean(state?.pinned_at) || (!state && Boolean(row.pin_by_default));
      if (pinned && !state?.completed_at) pinnedIds.push(row.id);

      return {
        id: row.id,
        title: row.title,
        kind: row.category === "maintenance" ? "maintenance" : row.task_mode === "due_by" ? "due" : "meeting",
        time: row.task_mode === "scheduled_start" ? timeLabel : undefined,
        dueTime: row.task_mode === "due_by" ? timeLabel : undefined,
        description: row.notes || undefined,
        critical: Boolean(row.critical),
        acknowledged: Boolean(state?.acknowledged_at),
        completed: Boolean(state?.completed_at),
        dismissed: Boolean(state?.dismissed_at),
        snoozedUntil: state?.snoozed_until ? new Date(state.snoozed_until).getTime() : null,
        sourceType: "manual",
        dueAt: row.due_at,
        startsAt: row.starts_at,
      };
    });

    setTasks((current) => [
      ...current.filter((task) => task.sourceType !== "manual"),
      ...cloudTasks,
    ]);
    setFollowUp((current) => [
      ...current.filter((id) => !manualIds.has(id)),
      ...pinnedIds.filter((id) => !current.includes(id)),
    ]);
  };

  const pollDeviceCommands = async () => {
    const { data: commands } = await supabase
      .from("device_commands")
      .select("id,command_type,payload,created_at,expires_at")
      .eq("target_device", "tablet")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: true });

    if (!commands?.length) return;

    for (const command of commands) {
      if (command.expires_at && new Date(command.expires_at).getTime() < Date.now()) {
        await supabase
          .from("device_commands")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("id", command.id);
        continue;
      }

      if (command.command_type === "test_alert") {
        const alertId = `cloud-test-${command.id}`;
        setTasks((current) =>
          current.some((task) => task.id === alertId)
            ? current
            : [
                {
                  id: alertId,
                  title: command.payload?.title || "Test Alert",
                  kind: "due",
                  dueTime: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
                  description: "Admin cloud test alert — tablet connection is working.",
                  critical: true,
                  sourceType: "prototype",
                },
                ...current,
              ]
        );
        setDimmed(false);
      }

      await supabase
        .from("device_commands")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", command.id);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("gm-dashboard-prototype");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
        if (Array.isArray(parsed.followUp)) setFollowUp(parsed.followUp);
      } catch {}
    }
    setRundownConfirmed(localStorage.getItem(todayKey("rundown")) === "yes");
    setTomorrowConfirmed(localStorage.getItem(todayKey("tomorrow")) === "yes");
    setOnline(navigator.onLine);

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("gm-dashboard") : null;
    channel?.addEventListener("message", (event) => {
      if (event.data?.type === "test-alert") {
        setTasks((current) => [
          {
            id: `test-${Date.now()}`,
            title: "Test Alert",
            kind: "due",
            dueTime: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            description: "Admin test alert — confirms the tablet alert path is working.",
            critical: true,
          },
          ...current,
        ]);
        setDimmed(false);
      }
    });
    return () => channel?.close();
  }, []);

  useEffect(() => {
    loadCloudTasks();
    pollDeviceCommands();
    const taskRefresh = setInterval(loadCloudTasks, 15 * 1000);
    const commandRefresh = setInterval(pollDeviceCommands, 4 * 1000);
    return () => {
      clearInterval(taskRefresh);
      clearInterval(commandRefresh);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("gm-dashboard-prototype", JSON.stringify({ tasks, followUp }));
  }, [tasks, followUp]);

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date());
      if (navigator.onLine) setLastSynced(new Date());
    }, 5 * 60 * 1000);
    const onOnline = () => {
      setOnline(true);
      setLastSynced(new Date());
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const resetIdle = () => {
      setDimmed(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setDimmed(true), 5 * 60 * 1000);
    };
    resetIdle();
    window.addEventListener("pointerdown", resetIdle);
    window.addEventListener("keydown", resetIdle);
    return () => {
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const active = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.completed || task.dismissed) return false;
        if (task.snoozedUntil && task.snoozedUntil > now.getTime()) return false;
        return true;
      }),
    [tasks, now]
  );

  const sorted = useMemo(() => {
    const rank: Record<string, number> = {
      overdue: 0,
      due: 1,
      warning: 2,
      confirmed: 3,
      upcoming: 4,
      snoozed: 5,
      canceled: 6,
      completed: 7,
    };
    return [...active].sort((a, b) => {
      const ua = urgency(a, now);
      const ub = urgency(b, now);
      if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub];
      return (minutesUntil(a, now) ?? 9999) - (minutesUntil(b, now) ?? 9999);
    });
  }, [active, now]);

  const topTask = sorted[0];
  const upcoming = sorted.slice(1, 5);

  const followUpTasks = useMemo(() => {
    return followUp
      .map((id) => tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task && !task.completed))
      .sort((a, b) => {
        const aUrgency = urgency(a, now) === "overdue" ? 0 : 1;
        const bUrgency = urgency(b, now) === "overdue" ? 0 : 1;
        if (aUrgency !== bUrgency) return aUrgency - bUrgency;
        const am = minutesUntil(a, now);
        const bm = minutesUntil(b, now);
        if (am === null && bm !== null) return 1;
        if (bm === null && am !== null) return -1;
        return (am ?? 9999) - (bm ?? 9999);
      });
  }, [followUp, tasks, now]);

  const pinTask = (id: string) =>
    setFollowUp((current) => (current.includes(id) ? current : [...current, id]));

  const dismissTask = (id: string) =>
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, dismissed: true } : task)));

  const acknowledgeTask = (id: string) =>
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, acknowledged: true } : task)));

  const snoozeTask = (id: string, minutes = 30) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, snoozedUntil: Date.now() + minutes * 60 * 1000 } : task
      )
    );

  const completeTask = (id: string) => {
    const wasPinned = followUp.includes(id);
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: true } : task)));
    setFollowUp((current) => current.filter((taskId) => taskId !== id));
    setUndo({ id, wasPinned });
    setTimeout(() => setUndo((current) => (current?.id === id ? null : current)), 5000);
  };

  const undoComplete = () => {
    if (!undo) return;
    setTasks((current) => current.map((task) => (task.id === undo.id ? { ...task, completed: false } : task)));
    if (undo.wasPinned) setFollowUp((current) => (current.includes(undo.id) ? current : [...current, undo.id]));
    setUndo(null);
  };

  const confirmRundown = () => {
    setRundownConfirmed(true);
    localStorage.setItem(todayKey("rundown"), "yes");
  };

  const confirmTomorrow = () => {
    setTomorrowConfirmed(true);
    localStorage.setItem(todayKey("tomorrow"), "yes");
  };

  const showRundown = now.getHours() > 7 || (now.getHours() === 7 && now.getMinutes() >= 25);
  const showTomorrow =
    now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30);

  const statusClass = (task: Task) => `status-${urgency(task, now)}`;

  const TaskCard = ({ task, large = false }: { task: Task; large?: boolean }) => {
    const expanded = expandedTask === task.id;
    return (
      <SwipeCard
        task={task}
        onPin={pinTask}
        onDismiss={dismissTask}
        className={`task-card ${statusClass(task)} ${large ? "task-large" : ""}`}
      >
        <div
          className="task-card-main"
          onClick={() => setExpandedTask((current) => (current === task.id ? null : task.id))}
        >
          <div className="task-copy">
            <span className="eyebrow">{countdownText(task, now)}</span>
            <h3>{task.canceled ? <s>{task.title}</s> : task.title}</h3>
            <p>
              {task.kind === "due" ? `Due By ${task.dueTime}` : task.time || "All-day"}
              {task.location ? ` · ${task.location}` : ""}
            </p>
          </div>
          <div className="task-actions" onClick={(e) => e.stopPropagation()}>
            {!task.acknowledged && (
              <button className="button secondary" onClick={() => acknowledgeTask(task.id)}>
                Confirm
              </button>
            )}
            <button className="button ghost" onClick={() => snoozeTask(task.id)}>
              Snooze 30
            </button>
            <button className="button primary" onClick={() => completeTask(task.id)}>
              Complete
            </button>
          </div>
        </div>
        {expanded && (
          <div className="task-details">
            <p>{task.description || "No Outlook notes for this item."}</p>
            <div className="detail-grid">
              <span>Type: {task.kind}</span>
              <span>Critical: {task.critical ? "Yes" : "No"}</span>
              <span>Alert override: This occurrence only</span>
              <span>Swipe right: Follow-Up</span>
            </div>
            <div className="detail-actions">
              <button
                className="text-button"
                onClick={() =>
                  setTasks((current) =>
                    current.map((item) =>
                      item.id === task.id ? { ...item, critical: !item.critical } : item
                    )
                  )
                }
              >
                {task.critical ? "Remove Critical" : "Add to Critical Events"}
              </button>
              <button className="text-button" onClick={() => snoozeTask(task.id, 15)}>
                Alert in 15 min
              </button>
              <button className="text-button" onClick={() => snoozeTask(task.id, 60)}>
                Alert in 1 hr
              </button>
            </div>
          </div>
        )}
      </SwipeCard>
    );
  };

  const renderCenter = () => {
    if (view === "daily") {
      return (
        <section className="panel center-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Today</span>
              <h2>Daily Schedule</h2>
            </div>
            <button className="text-button" onClick={() => setView("dashboard")}>Back</button>
          </div>
          <div className="daily-list">
            {schedule.map((item) => (
              <div className="daily-row" key={item.time + item.title}>
                <strong>{item.time}</strong>
                <span>{item.title}</span>
                <small>{item.meta}</small>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (view === "weekly") {
      return (
        <section className="panel center-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Monday–Friday</span>
              <h2>Weekly Schedule</h2>
            </div>
            <button className="text-button" onClick={() => setView("dashboard")}>Back</button>
          </div>
          <div className="week-grid">
            {weeklyMajor.map((day) => (
              <details className="week-day" key={day.day}>
                <summary>{day.day}<span>{day.items.length} major</span></summary>
                {day.items.map((item) => <div className="week-item" key={item}>{item}</div>)}
                <div className="week-scroll-hint">Tap to expand daily list</div>
              </details>
            ))}
          </div>
        </section>
      );
    }

    if (view === "maintenance") {
      const maintenance = tasks.filter((task) => task.kind === "maintenance");
      return (
        <section className="panel center-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Facility</span>
              <h2>Maintenance</h2>
            </div>
            <button className="text-button" onClick={() => setView("dashboard")}>Back</button>
          </div>
          <div className="maintenance-list">
            {maintenance.map((task) => (
              <div className="maintenance-row" key={task.id}>
                <div><strong>{task.title}</strong><small>{task.description}</small></div>
                <span className="pill purple">Daily</span>
              </div>
            ))}
            <div className="maintenance-row">
              <div><strong>Fire Extinguisher Inspection</strong><small>Check all stations and tags</small></div>
              <span className="pill purple">Monthly</span>
            </div>
            <div className="maintenance-row">
              <div><strong>HVAC Filter Check</strong><small>Inspect and replace if needed</small></div>
              <span className="pill purple">Monthly</span>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="center-panel">
        {topTask && (
          <div className="next-block">
            <div className="section-title">
              <div>
                <span className="eyebrow">Next priority</span>
                <h2>Upcoming Task</h2>
              </div>
              <span className="count-pill">{sorted.length} active</span>
            </div>
            <TaskCard task={topTask} large />
          </div>
        )}

        {showRundown && !rundownConfirmed && (
          <div className="rundown-card">
            <div className="section-title">
              <div>
                <span className="eyebrow">7:25 AM · stays until confirmed</span>
                <h2>Today’s Rundown</h2>
              </div>
              <span className="pill orange">{schedule.length} items</span>
            </div>
            <div className="rundown-scroll">
              {schedule.map((item) => (
                <div className="rundown-row" key={item.time + item.title}>
                  <strong>{item.time}</strong>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
            <button className="button primary wide" onClick={confirmRundown}>Confirm Today’s Rundown</button>
          </div>
        )}

        {showTomorrow && !tomorrowConfirmed && (
          <div className="tomorrow-card">
            <div>
              <span className="eyebrow">4:30 PM preview · stays until confirmed</span>
              <h2>Tomorrow Morning · 7:00–10:00 AM</h2>
              <p>7:30 AM Production Meeting · 9:00 AM WIP Review</p>
            </div>
            <button className="button secondary" onClick={confirmTomorrow}>Acknowledge</button>
          </div>
        )}

        <div className="upcoming-stack">
          <div className="section-title compact">
            <h2>Next Up</h2>
            <span>Swipe right to Follow-Up · left to dismiss</span>
          </div>
          {upcoming.map((task) => <TaskCard task={task} key={task.id} />)}
          {!upcoming.length && <div className="empty">No additional upcoming tasks.</div>}
        </div>
      </section>
    );
  };

  return (
    <main className={`app-shell ${dimmed ? "dimmed" : ""}`}>
      <header className="topbar">
        <div>
          <h1>GM Dashboard</h1>
          <p>{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
        </div>
        <nav className="topnav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>Daily</button>
          <button className={view === "weekly" ? "active" : ""} onClick={() => setView("weekly")}>Weekly</button>
          <button className={view === "maintenance" ? "active" : ""} onClick={() => setView("maintenance")}>Maintenance</button>
        </nav>
        <div className={`sync-chip ${online ? "online" : "offline"}`}>
          <span className="status-dot" />
          <div>
            <strong>{online ? "Outlook synced" : "Offline"}</strong>
            <small>Last synced {lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <aside className="left-column">
          <section className="panel calendar-card">
            <div className="section-title compact">
              <h2>Outlook Calendar</h2>
              <span>Today</span>
            </div>
            <div className="month-title">{now.toLocaleDateString([], { month: "long", year: "numeric" })}</div>
            <div className="calendar-weekdays">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => <span key={day + i}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: 35 }, (_, i) => {
                const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                const day = i - first + 1;
                const max = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const valid = day > 0 && day <= max;
                const today = valid && day === now.getDate();
                return <span className={today ? "today" : !valid ? "muted" : ""} key={i}>{valid ? day : ""}</span>;
              })}
            </div>
          </section>

          <section className="panel schedule-card">
            <div className="section-title compact">
              <h2>Upcoming Schedule</h2>
              <span>Today only</span>
            </div>
            <div className="schedule-list">
              {schedule.map((item) => (
                <div className="schedule-row" key={item.time + item.title}>
                  <span className="schedule-time">{item.time}</span>
                  <div><strong>{item.title}</strong><small>{item.meta}</small></div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {renderCenter()}

        <aside className="right-column">
          <section className="panel followup-panel">
            <div className="followup-header">
              <div>
                <span className="eyebrow">Persistent</span>
                <h2>Follow-Up</h2>
              </div>
              <span className="followup-count">{followUpTasks.length}</span>
            </div>
            <div className="followup-list">
              {followUpTasks.map((task) => {
                const expanded = expandedFollowUp === task.id;
                return (
                  <div
                    className={`followup-card ${urgency(task, now) === "overdue" ? "overdue" : ""}`}
                    key={task.id}
                    onClick={() => setExpandedFollowUp((current) => current === task.id ? null : task.id)}
                  >
                    <div className="followup-line">
                      <div>
                        <strong>{task.title}</strong>
                        <small>{countdownText(task, now)}</small>
                      </div>
                      <span>›</span>
                    </div>
                    {expanded && (
                      <div className="followup-expanded" onClick={(e) => e.stopPropagation()}>
                        <p>{task.description}</p>
                        <button className="button secondary" onClick={() => acknowledgeTask(task.id)}>Acknowledge</button>
                        <button className="button ghost" onClick={() => snoozeTask(task.id)}>Snooze 30</button>
                        <button className="button primary" onClick={() => completeTask(task.id)}>Complete</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!followUpTasks.length && <div className="empty">Swipe a task right to keep it here.</div>}
            </div>
          </section>
        </aside>
      </div>

      {undo && (
        <div className="undo-bar">
          Task completed.
          <button onClick={undoComplete}>Undo</button>
        </div>
      )}
    </main>
  );
}
