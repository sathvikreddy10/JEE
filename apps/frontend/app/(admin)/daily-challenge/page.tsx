"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { log as cli } from "@/lib/logger";
import { fetchJSON } from "@/lib/api";
import { Calendar, Clock, Trash2, AlertCircle, CheckCircle2, BookOpen, Users } from "lucide-react";

/* ─── Types ─── */
interface DailyChallenge {
  id: number; batchId: number; batchName: string; setId: number; setName: string;
  date: string; startTime: string; endTime: string; createdBy: string;
}
interface TomorrowStatus {
  date: string; totalBatches: number; assignedCount: number; missingCount: number;
  missingBatches: { id: number; name: string }[]; allSet: boolean; hoursUntilMidnight: number;
}

/* ─── Helpers ─── */
function tomorrowDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) }
  catch { return iso }
}
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function DailyChallengePage() {
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tomorrow, setTomorrow] = useState<TomorrowStatus | null>(null);
  const [batches, setBatches] = useState<{ id: number; name: string }[]>([]);
  const [papers, setPapers] = useState<{ id: number; name: string; subject: string; questionCount: number }[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | "">("");
  const [selectedPaper, setSelectedPaper] = useState<number | "">("");
  const [date, setDate] = useState(tomorrowDate());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const fetchChallenges = useCallback(async () => {
    try { setChallenges(await fetchJSON<DailyChallenge[]>("/api/admin/daily-challenge")) }
    catch (e) { cli.err("daily challenges", e) }
  }, []);
  const fetchTomorrowStatus = useCallback(async () => {
    try { setTomorrow(await fetchJSON<TomorrowStatus>("/api/admin/daily-challenge/tomorrow-status")) }
    catch (e) { cli.err("tomorrow status", e) }
  }, []);
  const fetchOptions = useCallback(async () => {
    try {
      const [bd, sd] = await Promise.all([
        fetchJSON<{ id: number; name: string }[]>("/api/batches"),
        fetchJSON<{ id: number; name: string; subject: string; questionCount: number; isReadyForDailyChallenge: boolean }[]>("/api/admin/sets"),
      ]);
      setBatches(bd);
      setPapers(sd.filter(p => p.isReadyForDailyChallenge));
    } catch (e) { cli.err("options", e) }
  }, []);

  useEffect(() => {
    Promise.all([fetchChallenges(), fetchTomorrowStatus(), fetchOptions()]).then(() => setLoading(false));
  }, [fetchChallenges, fetchTomorrowStatus, fetchOptions]);

  const handleAssign = async () => {
    if (!selectedBatch || !selectedPaper || !date || !startTime || !endTime) { setError("All fields required"); return }
    setAssigning(true); setError(null); setSuccess(null);
    try {
      await fetchJSON("/api/admin/daily-challenge", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatch, setId: selectedPaper, date, startTime: new Date(`${date}T${startTime}:00`).toISOString(), endTime: new Date(`${date}T${endTime}:00`).toISOString() }),
      });
      setSuccess(`Challenge assigned for ${formatDateLabel(date)}`);
      await Promise.all([fetchChallenges(), fetchTomorrowStatus()]);
    } catch (e) { setError((e as Error).message) }
    finally { setAssigning(false) }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchJSON(`/api/admin/daily-challenge/${id}`, { method: "DELETE" });
      setChallenges(prev => prev.filter(c => c.id !== id));
      await fetchTomorrowStatus();
    } catch (e) { setError((e as Error).message) }
  };

  const grouped = challenges.reduce<Record<string, DailyChallenge[]>>((acc, c) => { (acc[c.date] ??= []).push(c); return acc }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-10 space-y-8 max-w-5xl">
      <div className="flex items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Daily Challenge</h1>
          <p className="text-sm text-muted-foreground">Assign papers as daily challenges for your batches</p>
        </div>
        {tomorrow && (
          <Badge variant={tomorrow.allSet ? "success" : "destructive"} className="text-sm px-4 py-2 gap-2">
            {tomorrow.allSet ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {tomorrow.allSet ? "All batches covered" : `${tomorrow.missingCount} batch${tomorrow.missingCount !== 1 ? "es" : ""} missing`}
          </Badge>
        )}
      </div>

      {tomorrow && !tomorrow.allSet && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Missing challenges for {formatDateLabel(tomorrow.date)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tomorrow.missingBatches.map(b => b.name).join(", ")} {tomorrow.missingBatches.length === 1 ? "has" : "have"} no challenge assigned.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Assign New Challenge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Batch</label>
              <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value ? Number(e.target.value) : "")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Select batch…</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Paper</label>
              <select value={selectedPaper} onChange={e => setSelectedPaper(e.target.value ? Number(e.target.value) : "")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Select paper…</option>
                {papers.length === 0 ? (
                  <option value="" disabled>No papers marked for Daily Challenge</option>
                ) : papers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.questionCount} Qs · {p.subject})</option>)}
              </select>
              {papers.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Go to Papers → click "Daily" to make papers available here.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">End</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
              </div>
            </div>
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">{success}</div>}
          <Button onClick={handleAssign} disabled={assigning}>
            {assigning ? "Assigning…" : "Assign Challenge"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Assigned Challenges</h2>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : challenges.length === 0 ? (
          <Card className="text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No daily challenges assigned yet</p>
            <p className="text-xs text-muted-foreground mt-1">Use the form above to assign papers to batches</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(dateStr => (
              <div key={dateStr}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{formatDateLabel(dateStr)}</h3>
                  <Badge variant="secondary" className="text-[10px]">{grouped[dateStr].length}</Badge>
                </div>
                <div className="rounded-lg border bg-card overflow-hidden">
                  {grouped[dateStr].map((c, i) => (
                    <div key={c.id} className={cn("flex items-center p-4 transition-colors hover:bg-muted/30", i > 0 && "border-t")}>
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{c.batchName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{c.setName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{formatTime(c.startTime)} – {formatTime(c.endTime)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
