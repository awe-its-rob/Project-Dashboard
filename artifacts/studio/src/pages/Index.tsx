import { useEffect, useRef, useState } from "react";
import { Plus, X, Eye, EyeOff, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

type Category =
  | "video"
  | "design"
  | "music"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "pink";

const DEFAULT_MILESTONES = ["Brief/Concept", "Quote", "Draft 1", "Final", "Invoice", "Paid"];

type Task = {
  id: string;
  label: string;
  done: boolean;
  pinned?: boolean;
};

type Project = {
  id: string;
  title: string;
  category: Category;
  createdAt: number;
  /** number of completed milestones from the left, 0..milestones.length */
  progress: number;
  milestones: string[];
  /** due date per milestone, "" if unset, format "DD.MM" */
  dueDates: string[];
  /** tasks per milestone index */
  tasks: Record<number, Task[]>;
  /** if true, project is hidden from main flow + dropped to bottom */
  hidden?: boolean;
};

/** Normalize "10.1" / "10/1" / "10 1" → "10.01". Returns "" if invalid. */
const formatDueDate = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/[.\/\-\s]+/).filter(Boolean);
  if (parts.length < 2) return "";
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(d) || !Number.isFinite(m)) return "";
  if (d < 1 || d > 31 || m < 1 || m > 12) return "";
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
};

const CATEGORIES: { key: Category; label: string; dot: string; line: string; cssVar: string }[] = [
  { key: "video", label: "Red", dot: "bg-line-video", line: "bg-line-video", cssVar: "--line-video" },
  { key: "design", label: "Blue", dot: "bg-line-design", line: "bg-line-design", cssVar: "--line-design" },
  { key: "music", label: "Yellow", dot: "bg-line-music", line: "bg-line-music", cssVar: "--line-music" },
  { key: "green", label: "Green", dot: "bg-line-green", line: "bg-line-green", cssVar: "--line-green" },
  { key: "purple", label: "Purple", dot: "bg-line-purple", line: "bg-line-purple", cssVar: "--line-purple" },
  { key: "orange", label: "Orange", dot: "bg-line-orange", line: "bg-line-orange", cssVar: "--line-orange" },
  { key: "teal", label: "Teal", dot: "bg-line-teal", line: "bg-line-teal", cssVar: "--line-teal" },
  { key: "pink", label: "Pink", dot: "bg-line-pink", line: "bg-line-pink", cssVar: "--line-pink" },
];

const nextCategory = (existing: { category: Category }[]): Category => {
  const used = new Set(existing.map((p) => p.category));
  const free = CATEGORIES.find((c) => !used.has(c.key));
  if (free) return free.key;
  return CATEGORIES[existing.length % CATEGORIES.length].key;
};

const STORAGE_KEY = "studio.projects.v1";

const Index = () => {
  const [projects, _setProjectsRaw] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Project[];
      return parsed.map((p) => {
        const milestones =
          Array.isArray(p.milestones) && p.milestones.length > 0
            ? p.milestones
            : [...DEFAULT_MILESTONES];
        const dueDates =
          Array.isArray(p.dueDates) && p.dueDates.length === milestones.length
            ? p.dueDates
            : milestones.map(() => "");
        return {
          ...p,
          progress: p.progress ?? 0,
          milestones,
          dueDates,
          tasks: p.tasks ?? {},
          hidden: !!p.hidden,
        };
      });
    } catch {
      return [];
    }
  });
  const [composing, setComposing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState<Category>("video");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const pastRef = useRef<Project[][]>([]);
  const futureRef = useRef<Project[][]>([]);
  const HISTORY_LIMIT = 100;

  const mutate = (updater: (prev: Project[]) => Project[]) => {
    _setProjectsRaw((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      pastRef.current.push(prev);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      futureRef.current = [];
      return next;
    });
  };

  const undo = () => {
    _setProjectsRaw((current) => {
      const prev = pastRef.current.pop();
      if (!prev) return current;
      futureRef.current.push(current);
      return prev;
    });
  };

  const redo = () => {
    _setProjectsRaw((current) => {
      const next = futureRef.current.pop();
      if (!next) return current;
      pastRef.current.push(current);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.title = "Studio — Projects";
  }, []);

  useEffect(() => {
    if (composing) {
      setDraftCategory(nextCategory(projects));
      inputRef.current?.focus();
    }
  }, [composing]);

  const addProject = () => {
    const title = draftTitle.trim();
    if (!title) {
      setComposing(false);
      return;
    }
    mutate((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        title,
        category: draftCategory,
        createdAt: Date.now(),
        progress: 0,
        milestones: [...DEFAULT_MILESTONES],
        dueDates: DEFAULT_MILESTONES.map(() => ""),
        tasks: {},
      },
    ]);
    setDraftTitle("");
    setDraftCategory("video");
    setComposing(false);
  };

  const removeProject = (id: string) => {
    mutate((p) => p.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const renameProject = (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    mutate((prev) => prev.map((p) => (p.id === id ? { ...p, title: trimmed } : p)));
  };

  const deleteMilestone = (projectId: string, index: number) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        if (p.milestones.length <= 1) return p;
        const milestones = p.milestones.filter((_, i) => i !== index);
        const dueDates = p.dueDates.filter((_, i) => i !== index);
        let progress = p.progress;
        if (index < p.progress) progress = p.progress - 1;
        progress = Math.min(progress, milestones.length);
        const tasks: Record<number, Task[]> = {};
        Object.entries(p.tasks ?? {}).forEach(([k, v]) => {
          const i = Number(k);
          if (i === index) return;
          tasks[i > index ? i - 1 : i] = v;
        });
        return { ...p, milestones, dueDates, progress, tasks };
      }),
    );
  };

  const insertMilestone = (projectId: string, afterIndex: number) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const insertAt = afterIndex + 1;
        const milestones = [...p.milestones];
        const dueDates = [...p.dueDates];
        milestones.splice(insertAt, 0, "New");
        dueDates.splice(insertAt, 0, "");
        const progress = p.progress > afterIndex + 1 ? p.progress + 1 : p.progress;
        const tasks: Record<number, Task[]> = {};
        Object.entries(p.tasks ?? {}).forEach(([k, v]) => {
          const i = Number(k);
          tasks[i >= insertAt ? i + 1 : i] = v;
        });
        return { ...p, milestones, dueDates, progress, tasks };
      }),
    );
  };

  const renameMilestone = (projectId: string, index: number, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const next = [...p.milestones];
        next[index] = trimmed;
        return { ...p, milestones: next };
      }),
    );
  };

  const updateTasks = (projectId: string, milestoneIndex: number, tasks: Task[]) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, tasks: { ...p.tasks, [milestoneIndex]: tasks } };
      }),
    );
  };

  const setDueDate = (projectId: string, index: number, raw: string) => {
    const formatted = formatDueDate(raw);
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const next = [...p.dueDates];
        next[index] = formatted;
        return { ...p, dueDates: next };
      }),
    );
  };

  const toggleHidden = (projectId: string) => {
    mutate((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, hidden: !p.hidden } : p)),
    );
    if (expandedId === projectId) setExpandedId(null);
  };

  const toggleMilestone = (projectId: string, index: number) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        // If already checked → uncheck this one and all to its right
        if (index < p.progress) return { ...p, progress: index };
        // Otherwise → check this one and auto-check everything to its left
        return { ...p, progress: index + 1 };
      }),
    );
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-6 py-20">
      <header className="mb-16 text-center">
        <h1 className="text-sm tracking-[0.3em] uppercase text-muted-foreground font-mono-tabular">
          Studio
        </h1>
      </header>

      <section aria-label="Projects" className="w-full max-w-3xl flex flex-col">
        {projects.length === 0 && !composing && (
          <p className="text-center text-sm text-muted-foreground mb-8 font-light">
            No projects yet.
          </p>
        )}

        <ul className="flex flex-col">
          {[...projects]
            .sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden))
            .map((p) => {
            const cat = CATEGORIES.find((c) => c.key === p.category)!;
            const isExpanded = expandedId === p.id;
            const isEditing = editingProjectId === p.id;
            const isHidden = !!p.hidden;
            return (
              <li key={p.id}>
                <div
                  className={cn(
                    "group relative flex items-center gap-4 py-4 px-2 -mx-2 rounded-sm cursor-pointer",
                    "hover:bg-muted/40 transition-colors",
                    isHidden && "opacity-40",
                  )}
                  onClick={() => {
                    if (isEditing || isHidden) return;
                    setExpandedId(isExpanded ? null : p.id);
                  }}
                  onDoubleClick={() => setEditingProjectId(p.id)}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      isHidden ? "bg-muted-foreground" : cat.dot,
                    )}
                    aria-label={cat.label}
                  />
                  {isEditing ? (
                    <InlineEdit
                      initial={p.title}
                      onCommit={(val) => {
                        renameProject(p.id, val);
                        setEditingProjectId(null);
                      }}
                      onCancel={() => setEditingProjectId(null)}
                      className="flex-1 text-foreground font-normal"
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 text-left font-normal truncate",
                        isHidden ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {p.title}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(p.id);
                    }}
                    className={cn(
                      "transition-opacity text-muted-foreground hover:text-foreground",
                      isHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    aria-label={isHidden ? `Unhide ${p.title}` : `Hide ${p.title}`}
                    title={isHidden ? "Unhide project" : "Hide project"}
                  >
                    {isHidden ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    aria-label={`Delete ${p.title}`}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                {isExpanded && (
                  <ProgressTrack
                    milestones={p.milestones}
                    dueDates={p.dueDates}
                    progress={p.progress}
                    lineColor={cat.line}
                    tasks={p.tasks}
                    lineCssVar={cat.cssVar}
                    onToggle={(i) => toggleMilestone(p.id, i)}
                    onRenameMilestone={(i, label) => renameMilestone(p.id, i, label)}
                    onSetDueDate={(i, raw) => setDueDate(p.id, i, raw)}
                    onDeleteMilestone={(i) => deleteMilestone(p.id, i)}
                    onInsertMilestone={(i) => insertMilestone(p.id, i)}
                    onUpdateTasks={(i, tasks) => updateTasks(p.id, i, tasks)}
                  />
                )}
              </li>
            );
          })}

          {composing && (
            <li className="flex items-center gap-4 py-4">
              <button
                onClick={() => {
                  const idx = CATEGORIES.findIndex((c) => c.key === draftCategory);
                  setDraftCategory(CATEGORIES[(idx + 1) % CATEGORIES.length].key);
                }}
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0 transition-colors",
                  CATEGORIES.find((c) => c.key === draftCategory)!.dot,
                )}
                aria-label="Cycle category"
                title="Click to change category"
              />
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addProject();
                  if (e.key === "Escape") {
                    setDraftTitle("");
                    setComposing(false);
                  }
                }}
                onBlur={addProject}
                placeholder="New project"
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground font-light"
              />
            </li>
          )}
        </ul>

        <div className="flex justify-center mt-10">
          <button
            onClick={() => setComposing(true)}
            disabled={composing}
            className={cn(
              "h-10 w-10 rounded-full border border-border flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:border-foreground",
              "transition-colors disabled:opacity-30 disabled:hover:border-border",
            )}
            aria-label="Add project"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </section>

      <AllTasksList projects={projects} onUpdateTasks={updateTasks} />
    </main>
  );
};

type AllTasksListProps = {
  projects: Project[];
  onUpdateTasks: (projectId: string, milestoneIndex: number, tasks: Task[]) => void;
};

const AllTasksList = ({ projects, onUpdateTasks }: AllTasksListProps) => {
  const rows = projects
    .filter((p) => !p.hidden)
    .flatMap((p) => {
      const cat = CATEGORIES.find((c) => c.key === p.category)!;
      return Object.entries(p.tasks ?? {}).flatMap(([msIdxStr, tasks]) => {
        const msIdx = Number(msIdxStr);
        const milestoneLabel = p.milestones[msIdx] ?? "";
        const milestoneManuallyChecked = msIdx < p.progress;
        const named = (tasks ?? []).filter((t) => t.label.trim() !== "");
        const ratio =
          named.length > 0 ? named.filter((t) => t.done).length / named.length : 0;
        const overridden = milestoneManuallyChecked && ratio < 1;
        return (tasks ?? [])
          .filter((t) => t.label.trim() !== "")
          .map((t) => ({
            projectId: p.id,
            projectTitle: p.title,
            dot: cat.dot,
            cssVar: cat.cssVar,
            milestoneIndex: msIdx,
            milestoneLabel,
            allTasksAtMilestone: tasks,
            task: t,
            flagged: overridden && !t.done,
          }));
      });
    });

  if (rows.length === 0) return null;

  // Order: unchecked-pinned > unchecked-unpinned > checked (greyed, sunk).
  // Within each tier, preserve original order.
  const tier = (r: (typeof rows)[number]) => {
    if (r.task.done) return 2;
    if (r.task.pinned) return 0;
    return 1;
  };
  const sortedRows = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ta = tier(a.r);
      const tb = tier(b.r);
      if (ta !== tb) return ta - tb;
      return a.i - b.i;
    })
    .map((x) => x.r);

  const toggle = (
    projectId: string,
    milestoneIndex: number,
    allTasks: Task[],
    taskId: string,
  ) => {
    onUpdateTasks(
      projectId,
      milestoneIndex,
      allTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    );
  };

  const togglePin = (
    projectId: string,
    milestoneIndex: number,
    allTasks: Task[],
    taskId: string,
  ) => {
    onUpdateTasks(
      projectId,
      milestoneIndex,
      allTasks.map((t) => (t.id === taskId ? { ...t, pinned: !t.pinned } : t)),
    );
  };

  return (
    <section
      aria-label="All tasks"
      className="w-full max-w-3xl flex flex-col mt-16 pt-8 border-t border-border"
    >
      <h2 className="text-[10px] tracking-[0.3em] uppercase font-mono-tabular text-muted-foreground text-center mb-6">
        All Tasks
      </h2>
      <ul className="flex flex-col gap-1">
        {sortedRows.map((r) => {
          const isPinned = !!r.task.pinned;
          return (
            <li
              key={`${r.projectId}-${r.milestoneIndex}-${r.task.id}`}
              className="group flex items-center gap-3 py-1"
            >
              <button
                onClick={() =>
                  togglePin(r.projectId, r.milestoneIndex, r.allTasksAtMilestone, r.task.id)
                }
                className={cn(
                  "shrink-0 transition-opacity",
                  isPinned
                    ? "opacity-100 text-foreground"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground",
                )}
                aria-label={isPinned ? "Unpin task" : "Pin task"}
                title={isPinned ? "Unpin task" : "Pin task"}
              >
                <Pin
                  className="h-3 w-3"
                  strokeWidth={1.5}
                  style={isPinned ? { fill: "currentColor" } : undefined}
                />
              </button>
              <button
                onClick={() =>
                  toggle(r.projectId, r.milestoneIndex, r.allTasksAtMilestone, r.task.id)
                }
                className={cn(
                  "h-3.5 w-3.5 rounded-sm border shrink-0 transition-colors",
                  r.task.done
                    ? "bg-foreground border-foreground"
                    : "bg-background border-border hover:border-foreground",
                )}
                aria-label={r.task.done ? "Mark incomplete" : "Mark complete"}
              />
              <span className={cn("h-2 w-2 rounded-full shrink-0", r.dot)} />
              {r.flagged && (
                <span
                  className="text-sm leading-none font-bold shrink-0 -ml-1"
                  style={{ color: `hsl(var(${r.cssVar}))` }}
                  aria-label="Incomplete under completed milestone"
                  title="Incomplete under completed milestone"
                >
                  *
                </span>
              )}
              <span
                className={cn(
                  "flex-1 tracking-wider uppercase font-mono-tabular leading-tight truncate transition-all",
                  isPinned ? "text-xs" : "text-[10px]",
                  r.task.done ? "line-through text-muted-foreground" : "text-foreground",
                )}
              >
                {r.task.label}
              </span>
              <span className="text-[10px] tracking-wider uppercase font-mono-tabular text-muted-foreground truncate max-w-[40%] text-right">
                {r.projectTitle}
                {r.milestoneLabel && (
                  <span className="opacity-60"> · {r.milestoneLabel}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

type InlineEditProps = {
  initial: string;
  onCommit: (val: string) => void;
  onCancel: () => void;
  className?: string;
  centered?: boolean;
};

const InlineEdit = ({ initial, onCommit, onCancel, className, centered }: InlineEditProps) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(value)}
      className={cn(
        "bg-transparent outline-none border-b border-border focus:border-foreground transition-colors",
        centered && "text-center",
        className,
      )}
    />
  );
};

type ProgressTrackProps = {
  milestones: string[];
  dueDates: string[];
  progress: number;
  lineColor: string;
  lineCssVar: string;
  tasks: Record<number, Task[]>;
  onToggle: (index: number) => void;
  onRenameMilestone: (index: number, label: string) => void;
  onSetDueDate: (index: number, raw: string) => void;
  onDeleteMilestone: (index: number) => void;
  onInsertMilestone: (afterIndex: number) => void;
  onUpdateTasks: (index: number, tasks: Task[]) => void;
};

type TaskPanelProps = {
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
  /** When set, incomplete tasks are flagged with a colored asterisk (used when the
   * milestone has been manually checked but tasks remain incomplete). */
  flagColorVar?: string;
};

const TaskPanel = ({ tasks, onChange, flagColorVar }: TaskPanelProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleTask = (id: string) =>
    onChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const renameTask = (id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      onChange(tasks.filter((t) => t.id !== id));
    } else {
      onChange(tasks.map((t) => (t.id === id ? { ...t, label: trimmed } : t)));
    }
    setEditingId(null);
  };

  const removeTask = (id: string) => onChange(tasks.filter((t) => t.id !== id));

  const addTask = () => {
    const newTask: Task = { id: crypto.randomUUID(), label: "", done: false };
    onChange([...tasks, newTask]);
    setEditingId(newTask.id);
  };

  return (
    <div className="mt-2 mb-4 ml-1 flex flex-col gap-1">
      {tasks.map((task) => (
        <div key={task.id} className="group flex items-center gap-2 py-0.5">
          <button
            onClick={() => toggleTask(task.id)}
            className={cn(
              "h-3.5 w-3.5 rounded-sm border shrink-0 transition-colors",
              task.done
                ? "bg-foreground border-foreground"
                : "bg-background border-border hover:border-foreground",
            )}
            aria-label={task.done ? "Mark incomplete" : "Mark complete"}
          />
          {flagColorVar && !task.done && (
            <span
              className="text-sm leading-none font-bold shrink-0 -ml-1"
              style={{ color: `hsl(var(${flagColorVar}))` }}
              aria-label="Incomplete under completed milestone"
              title="Milestone marked complete with incomplete task"
            >
              *
            </span>
          )}
          {editingId === task.id ? (
            <InlineEdit
              initial={task.label}
              onCommit={(val) => renameTask(task.id, val)}
              onCancel={() => {
                if (!task.label) removeTask(task.id);
                else setEditingId(null);
              }}
              className="flex-1 text-[10px] tracking-wider uppercase font-mono-tabular leading-tight text-foreground"
            />
          ) : (
            <span
              onClick={() => setEditingId(task.id)}
              className={cn(
                "flex-1 text-[10px] tracking-wider uppercase font-mono-tabular leading-tight cursor-text select-none",
                task.done ? "line-through text-muted-foreground" : "text-foreground",
                !task.label && "text-muted-foreground normal-case",
              )}
            >
              {task.label || "unnamed task"}
            </span>
          )}
          <button
            onClick={() => removeTask(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label="Remove task"
          >
            <X className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      ))}

      <button
        onClick={addTask}
        className="flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-foreground transition-colors w-fit"
        aria-label="Add task"
      >
        <Plus className="h-3 w-3" strokeWidth={1.5} />
        <span className="text-[10px] tracking-wider uppercase font-mono-tabular">add task</span>
      </button>
    </div>
  );
};

type StationShape = "circle" | "square" | "triangle" | "pentagon" | "diamond" | "ring";

const STATION_SHAPES: StationShape[] = [
  "circle",
  "square",
  "triangle",
  "pentagon",
  "diamond",
  "ring",
];

type StationMarkerProps = {
  shape: StationShape;
  checked: boolean;
  ratio: number;
  fillClass: string;
  onClick: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
};

const StationMarker = ({
  checked,
  ratio,
  fillClass,
  onClick,
  onDoubleClick,
  ariaLabel,
}: StationMarkerProps) => {
  const innerSize = 18;
  const ringWidth = 5;
  const ringGap = 3;
  const showRing = ratio > 0;
  const totalSize = showRing ? innerSize + (ringWidth + ringGap) * 2 : innerSize;
  const stroke = 2;
  const c = totalSize / 2;
  const ringR = innerSize / 2 + ringGap + ringWidth / 2;
  const circumference = 2 * Math.PI * ringR;
  const dashOn = circumference * Math.min(1, Math.max(0, ratio));
  const dashOff = circumference - dashOn;

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-pressed={checked}
      aria-label={ariaLabel}
      title="Click to toggle, double-click to delete"
      className={cn(
        "relative z-10 inline-flex items-center justify-center border-0 transition-colors",
        checked ? fillClass.replace("bg-", "text-") : "text-foreground/70 hover:text-foreground",
      )}
      style={{
        background: "transparent",
        padding: 0,
        lineHeight: 0,
        width: totalSize,
        height: totalSize,
      }}
    >
      <svg
        width={totalSize}
        height={totalSize}
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        className="block"
        shapeRendering="geometricPrecision"
      >
        {showRing && (
          <circle
            cx={c}
            cy={c}
            r={ringR}
            fill="none"
            stroke={`hsl(var(${fillClass.replace("bg-line-", "--line-")}))`}
            strokeWidth={ringWidth}
            strokeDasharray={`${dashOn} ${dashOff}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="butt"
            transform={`rotate(-90 ${c} ${c})`}
            style={{ transition: "stroke-dasharray 200ms ease" }}
          />
        )}
        <circle
          cx={c}
          cy={c}
          r={innerSize / 2 - stroke / 2}
          fill="hsl(var(--background))"
          stroke="hsl(var(--foreground))"
          strokeWidth={stroke}
        />
      </svg>
    </button>
  );
};

const ProgressTrack = ({
  milestones,
  dueDates,
  progress,
  lineColor,
  lineCssVar,
  onToggle,
  onRenameMilestone,
  onSetDueDate,
  onDeleteMilestone,
  onInsertMilestone,
  tasks,
  onUpdateTasks,
}: ProgressTrackProps) => {
  const count = milestones.length;
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<number | null>(null);

  // Auto-open to the first milestone that still has incomplete tasks.
  // If a milestone's tasks are all complete (or it has none at all), skip
  // to the next milestone to the right. If every milestone is fully done,
  // fall back to the last one.
  const initialOpenIndex = (() => {
    for (let i = 0; i < count; i++) {
      const named = (tasks[i] ?? []).filter((t) => t.label.trim() !== "");
      const hasIncomplete = named.some((t) => !t.done);
      if (hasIncomplete) return i;
    }
    return Math.max(0, count - 1);
  })();
  const [openTaskPanel, setOpenTaskPanel] = useState<number | null>(initialOpenIndex);

  // Click-vs-doubleclick disambiguation on the marker so deleting (dblclick)
  // doesn't also fire toggle (single click).
  const clickTimerRef = useRef<number | null>(null);
  const cancelPendingMarkerClick = () => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };
  const handleMarkerClick = (i: number) => {
    cancelPendingMarkerClick();
    clickTimerRef.current = window.setTimeout(() => {
      onToggle(i);
      clickTimerRef.current = null;
    }, 140);
  };
  const handleMarkerDoubleClick = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    cancelPendingMarkerClick();
    onDeleteMilestone(i);
  };

  const handleLabelClick = (i: number) => {
    if (editingLabel === i) return;
    if (openTaskPanel === i) {
      setOpenTaskPanel(null);
      return;
    }
    setOpenTaskPanel(i);
  };

  // If a milestone is overridden (manually checked but with incomplete tasks),
  // jump the panel open to it so the user sees the warning.
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const named = (tasks[i] ?? []).filter((t) => t.label.trim() !== "");
      const ratio = named.length > 0 ? named.filter((t) => t.done).length / named.length : 0;
      if (i < progress && ratio < 1) {
        setOpenTaskPanel(i);
        return;
      }
    }
  }, [progress, tasks, count]);

  return (
    <div className="px-2 pb-8 pt-4 relative">
      <ol
        className="relative grid items-center"
        style={{
          gridTemplateColumns: `repeat(${count}, 1fr)`,
          gridTemplateRows: "auto auto auto",
          rowGap: "0.5rem",
        }}
      >
        {milestones.map((label, i) => {
          const checked = i < progress;
          const isEditingLabel = editingLabel === i;
          const isOpen = openTaskPanel === i;
          const namedTasks = (tasks[i] ?? []).filter((t) => t.label.trim() !== "");
          const taskRatio =
            namedTasks.length > 0
              ? namedTasks.filter((t) => t.done).length / namedTasks.length
              : 0;
          const ratio = checked ? 1 : taskRatio;
          const milestoneComplete = ratio >= 1;
          return (
            <li key={i} style={{ display: "contents" }}>
              {/* Row 1: label (aligned to bottom so all markers stay on a single line) */}
              <div
                className="px-1 min-w-0 flex items-end justify-center"
                style={{ gridColumn: i + 1, gridRow: 1 }}
              >
                {isEditingLabel ? (
                  <InlineEdit
                    initial={label}
                    centered
                    onCommit={(val) => {
                      onRenameMilestone(i, val);
                      setEditingLabel(null);
                    }}
                    onCancel={() => setEditingLabel(null)}
                    className="text-[10px] tracking-wider uppercase font-mono-tabular w-full"
                  />
                ) : (
                  <span
                    onClick={() => handleLabelClick(i)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingLabel(i);
                    }}
                    className={cn(
                      "text-[10px] tracking-wider uppercase text-center font-mono-tabular leading-tight cursor-pointer select-none transition-colors",
                      checked ? "text-foreground" : "text-muted-foreground",
                      isOpen && "underline underline-offset-2",
                    )}
                    title="Click to toggle tasks, double-click to rename"
                  >
                    {label}
                  </span>
                )}
              </div>

              {/* Row 2: station marker + connecting line */}
              <div
                className="relative w-full flex items-center justify-center h-6 px-1"
                style={{ gridColumn: i + 1, gridRow: 2 }}
              >
                {i < count - 1 && (
                  <div
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onInsertMilestone(i);
                    }}
                    className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-4 w-full cursor-copy flex items-center"
                    title="Double-click to insert milestone"
                  >
                    {milestoneComplete ? (
                      <div className={cn("h-[5px] w-full rounded-full", lineColor)} />
                    ) : (
                      <div
                        className="h-[5px] w-full rounded-full opacity-90"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, hsl(var(--border)) 55%, transparent 55%)",
                          backgroundSize: "10px 5px",
                          backgroundRepeat: "repeat-x",
                        }}
                      />
                    )}
                  </div>
                )}
                <div className="relative inline-flex items-center justify-center">
                  <StationMarker
                    shape="circle"
                    checked={checked}
                    ratio={ratio}
                    fillClass={lineColor}
                    onClick={() => handleMarkerClick(i)}
                    onDoubleClick={(e) => handleMarkerDoubleClick(i, e)}
                    ariaLabel={`${label}${checked ? " (completed)" : ""}`}
                  />
                  {checked && namedTasks.length > 0 && taskRatio < 1 && (
                    <span
                      className="absolute -top-1 -right-1 z-20 text-sm leading-none font-bold pointer-events-none"
                      style={{ color: `hsl(var(${lineCssVar}))` }}
                      aria-label="Marked complete with incomplete tasks"
                      title="Marked complete with incomplete tasks"
                    >
                      *
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: dropdown chevron toggle */}
              <div
                className="px-1 flex justify-center"
                style={{ gridColumn: i + 1, gridRow: 3 }}
              >
                <button
                  onClick={() => handleLabelClick(i)}
                  className={cn(
                    "text-[9px] leading-none cursor-pointer select-none transition-all p-1 -m-1",
                    isOpen
                      ? "text-foreground rotate-180"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Hide tasks" : "Show tasks"}
                  title={isOpen ? "Hide tasks" : "Show tasks"}
                >
                  ▼
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Task panel — left-aligned to its milestone column */}
      {openTaskPanel !== null && (() => {
        const named = (tasks[openTaskPanel] ?? []).filter((t) => t.label.trim() !== "");
        const r = named.length > 0 ? named.filter((t) => t.done).length / named.length : 0;
        const overridden = openTaskPanel < progress && named.length > 0 && r < 1;
        return (
          <div className="mt-3 relative w-full">
            <div
              className="w-[320px] max-w-[90vw]"
              style={{
                marginLeft: `calc(${((openTaskPanel + 0.5) / count) * 100}% - 0.5rem)`,
              }}
            >
              <TaskPanel
                tasks={tasks[openTaskPanel] ?? []}
                onChange={(updated) => onUpdateTasks(openTaskPanel, updated)}
                flagColorVar={overridden ? lineCssVar : undefined}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Index;
