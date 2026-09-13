"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ManualTask = {
  id: string;
  name: string;
  dueDate: string;
  dueTime: string;
  recurrence: string;
  critical: boolean;
  notes: string;
  pin: boolean;
  taskMode: "due_by" | "scheduled_start";
};

const initialRules = [
  { match: "Production Meeting / Production Mtg", type: "Critical Meeting" },
  { match: "Due By [time]", type: "Deadline task" },
  { match: "Fire Extinguisher / HVAC / Inspection", type: "Maintenance" },
];

const maintenance = [
  { name: "Fire Extinguisher Inspection", last: "Aug 12", next: "Sep 12", frequency: "Monthly", overdue: true },
  { name: "Daily Shop Walk", last: "Today", next: "Tomorrow", frequency: "Daily", overdue: false },
  { name: "HVAC Filter Check", last: "Aug 28", next: "Sep 28", frequency: "Monthly", overdue: false },
];

function toLocalParts(value: string | null) {
  if (!value) return { date: "", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function makeLocalIso(date: string, time: string) {
  if (!date) return null;
  const d = new Date(`${date}T${time || "17:00"}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminPage() {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState("Loading…");
  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [saving, setSaving] = useState(false);\n  const [microsoftStatus, setMicrosoftStatus] = useState("Checking…");\n  const [microsoftIdentity, setMicrosoftIdentity] = useState("");
  const [form, setForm] = useState({
    name: "",
    dueDate: "",
    dueTime: "",
    recurrence: "None",
    taskMode: "Due By",
    critical: false,
    notes: "",
    alert1h: true,
    alert30m: true,
    includeRundown: true,
    pin: false,
    category: "Auto",
  });

  const overdueMaintenance = useMemo(() => maintenance.filter((item) => item.overdue), []);

  const loadCloudData = async () => {
    const [{ data: taskRows, error: taskError }, { data: syncRow }] = await Promise.all([
      supabase
        .from("manual_tasks")
        .select("id,title,notes,task_mode,due_at,starts_at,recurrence_type,critical,pin_by_default")
        .eq("enabled", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("sync_state")
        .select("status,last_success_at,last_error")
        .eq("source", "outlook_ics")
        .maybeSingle(),
    ]);

    if (!taskError && taskRows) {
      setTasks(
        taskRows.map((row) => {
          const when = row.task_mode === "scheduled_start" ? row.starts_at : row.due_at;
          const parts = toLocalParts(when);
          return {
            id: row.id,
            name: row.title,
            dueDate: parts.date,
            dueTime: parts.time,
            recurrence: row.recurrence_type
              ? row.recurrence_type.charAt(0).toUpperCase() + row.recurrence_type.slice(1)
              : "None",
            critical: Boolean(row.critical),
            notes: row.notes || "",
            pin: Boolean(row.pin_by_default),
            taskMode: row.task_mode,
          };
        })
      );
    }

    if (syncRow) {
      const labels: Record<string, string> = {
        never_synced: "Not connected yet",
        syncing: "Refreshing…",
        connected: "Connected",
        offline: "Offline",
        error: "Error",
      };
      setSyncMessage(labels[syncRow.status] || syncRow.status);
      setLastSync(syncRow.last_success_at ? new Date(syncRow.last_success_at) : null);
    } else {
      setSyncMessage("Not connected yet");
    }
  };

  useEffect(() => {
    loadCloudData();
  }, []);

  const testAlert = async () => {
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error } = await supabase.from("device_commands").insert({
      command_type: "test_alert",
      target_device: "tablet",
      payload: { title: "Test Alert", source: "admin" },
      expires_at: expires,
    });

    if (error) {
      setSyncMessage("Test alert failed");
      return;
    }

    setSyncMessage("Test alert sent");
    setTimeout(() => loadCloudData(), 1800);
  };

  const refresh = async () => {
    setSyncMessage("Refreshing…");
    await loadCloudData();
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    const when = makeLocalIso(form.dueDate, form.dueTime);
    const taskMode = form.taskMode === "Scheduled Start" ? "scheduled_start" : "due_by";
    const categoryMap: Record<string, string> = {
      Auto: "auto",
      Critical: "critical",
      "Due By": "due_by",
      Meeting: "meeting",
      Maintenance: "maintenance",
    };

    const alertMinutes = [
      ...(form.alert1h ? [60] : []),
      ...(form.alert30m ? [30] : []),
      0,
    ];

    const { error } = await supabase.from("manual_tasks").insert({
      title: form.name.trim(),
      notes: form.notes || null,
      task_mode: taskMode,
      due_at: taskMode === "due_by" ? when : null,
      starts_at: taskMode === "scheduled_start" ? when : null,
      recurrence_type: form.recurrence.toLowerCase(),
      critical: form.critical,
      category: categoryMap[form.category] || "auto",
      include_in_rundown: form.includeRundown,
      pin_by_default: form.pin,
      alert_minutes: alertMinutes,
    });

    setSaving(false);

    if (error) {
      setSyncMessage("Task save failed");
      return;
    }

    setForm((current) => ({
      ...current,
      name: "",
      dueDate: "",
      dueTime: "",
      notes: "",
      critical: false,
      pin: false,
    }));
    await loadCloudData();
  };

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dueToday = tasks.filter((task) => task.dueDate === todayDate).length;
  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;
    const when = new Date(`${task.dueDate}T${task.dueTime || "23:59"}:00`);
    return when.getTime() < Date.now();
  }).length;
  const followUpCount = tasks.filter((task) => task.pin).length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>GM Dashboard · Admin</h1>
          <p>Laptop controls for tasks, rules, maintenance, and Outlook sync.</p>
        </div>
        <div className="admin-actions">
          <Link className="button ghost" href="/">Open Tablet View</Link>\n          <a className="button secondary" href="/api/microsoft/login">Connect Outlook</a>
          <button className="button secondary" onClick={testAlert}>Test Alert</button>
          <button className="button primary" onClick={refresh}>Refresh Now</button>
        </div>
      </header>

      <section className="summary-grid">
        <div className="summary-card"><span>Overdue Tasks</span><strong>{overdueTasks}</strong></div>
        <div className="summary-card"><span>Due Today</span><strong>{dueToday}</strong></div>
        <div className="summary-card"><span>Follow-Up</span><strong>{followUpCount}</strong></div>
        <div className="summary-card"><span>Maintenance Due</span><strong>{overdueMaintenance.length}</strong></div>
        <div className="summary-card sync">
          <span>Outlook Sync</span>
          <strong>{syncMessage}</strong>
          <small>{lastSync ? `Last sync ${lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No successful Outlook sync yet"}</small>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>New Task</h2>
          <form className="form-grid" onSubmit={createTask}>
            <div className="form-field full">
              <label>Task name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Submit weekly payroll" />
            </div>
            <div className="form-field">
              <label>Due date</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Due time</label>
              <input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Recurrence</label>
              <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                <option>None</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Yearly</option>
              </select>
            </div>
            <div className="form-field">
              <label>Task type</label>
              <select value={form.taskMode} onChange={(e) => setForm({ ...form, taskMode: e.target.value })}>
                <option>Due By</option>
                <option>Scheduled Start</option>
              </select>
            </div>
            <label className="form-check full">
              <input type="checkbox" checked={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.checked })} />
              Critical event
            </label>
            <div className="form-field full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional task details" />
            </div>

            <details className="advanced">
              <summary>Advanced Options</summary>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="form-check">
                  <input type="checkbox" checked={form.alert1h} onChange={(e) => setForm({ ...form, alert1h: e.target.checked })} />
                  1-hour warning
                </label>
                <label className="form-check">
                  <input type="checkbox" checked={form.alert30m} onChange={(e) => setForm({ ...form, alert30m: e.target.checked })} />
                  30-minute warning
                </label>
                <label className="form-check">
                  <input type="checkbox" checked={form.includeRundown} onChange={(e) => setForm({ ...form, includeRundown: e.target.checked })} />
                  Include in 7:25 rundown
                </label>
                <label className="form-check">
                  <input type="checkbox" checked={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.checked })} />
                  Pin to Follow-Up by default
                </label>
                <div className="form-field full">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option>Auto</option>
                    <option>Critical</option>
                    <option>Due By</option>
                    <option>Meeting</option>
                    <option>Maintenance</option>
                  </select>
                </div>
              </div>
            </details>

            <button className="button primary wide full" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create Task"}
            </button>
          </form>

          {tasks.length > 0 && (
            <>
              <h2 style={{ marginTop: 22 }}>Cloud Tasks</h2>
              <div className="admin-list">
                {tasks.map((task) => (
                  <div className="admin-row" key={task.id}>
                    <div>
                      <strong>{task.name}</strong>
                      <small>{task.dueDate || "No date"} · {task.dueTime || "No time"} · {task.recurrence}</small>
                    </div>
                    <span className={task.critical ? "pill orange" : "pill purple"}>
                      {task.critical ? "Critical" : task.taskMode === "scheduled_start" ? "Scheduled" : "Due By"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <section className="admin-panel">
            <h2>Maintenance · Overdue</h2>
            <div className="admin-list">
              {overdueMaintenance.map((item) => (
                <div className="admin-row overdue" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>Last: {item.last} · Next: {item.next}</small>
                  </div>
                  <span className="pill orange">{item.frequency}</span>
                </div>
              ))}
            </div>

            <h2 style={{ marginTop: 22 }}>All Maintenance</h2>
            <div className="admin-list">
              {maintenance.map((item) => (
                <div className="admin-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>Last: {item.last} · Next: {item.next}</small>
                  </div>
                  <span className="pill purple">{item.frequency}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Learned Rules</h2>
            <div className="admin-list">
              {initialRules.map((rule) => (
                <div className="admin-row" key={rule.match}>
                  <div>
                    <strong>{rule.match}</strong>
                    <small>Close title variations are recognized.</small>
                  </div>
                  <span className="pill purple">{rule.type}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Defaults</h2>
            <div className="admin-list">
              <div className="admin-row"><div><strong>Normal event warning</strong><small>Visual only</small></div><span>5 min</span></div>
              <div className="admin-row"><div><strong>Due By warnings</strong><small>Then deadline / overdue</small></div><span>1 hr + 30 min</span></div>
              <div className="admin-row"><div><strong>Default snooze</strong><small>Can override per task</small></div><span>30 min</span></div>
              <div className="admin-row"><div><strong>Morning rundown</strong><small>Stays until confirmed</small></div><span>7:25 AM</span></div>
              <div className="admin-row"><div><strong>Tomorrow preview</strong><small>7:00–10:00 AM items</small></div><span>4:30 PM</span></div>
              <div className="admin-row"><div><strong>All-day reminder</strong><small>Back from lunch</small></div><span>1:00 PM</span></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
