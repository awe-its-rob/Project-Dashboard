import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "video" | "design" | "music";

const DEFAULT_MILESTONES = ["Brief/Concept", "Quote", "Draft 1", "Final", "Invoice", "Paid"];

type Task = {
  id: string;
  label: string;
  done: boolean;
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

const CATEGORIES: { key: Category; label: string; dot: string; line: string }[] = [
  { key: "video", label: "Video", dot: "bg-line-video", line: "bg-line-video" },
  { key: "design", label: "Design", dot: "bg-line-design", line: "bg-line-design" },
  { key: "music", label: "Music", dot: "bg-line-music", line: "bg-line-music" },
];

const STORAGE_KEY = "studio.projects.v1";

const Index = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Project[];
      return parsed.map((p) => {
        const milestones =
          Array.isArray(p.milestones) && p.milestones.length === DEFAULT_MILESTONES.length
            ? p.milestones
            : [...DEFAULT_MILESTONES];
        const dueDates =
          Array.isArray(p.dueDates) && p.dueDates.length === milestones.length
            ? p.dueDates
            : milestones.map(() => "");
        return { ...p, progress: p.progress ?? 0, milestones, dueDates, tasks: p.tasks ?? {} };
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

  useEffect(() => {
    document.title = "Studio — Projects";
  }, []);

  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  const addProject = () => {
    const title = draftTitle.trim();
    if (!title) {
      setComposing(false);
      return;
    }
    setProjects((p) => [
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
    setProjects((p) => p.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const renameProject = (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, title: trimmed } : p)));
  };

  const deleteMilestone = (projectId: string, index: number) => {
    setProjects((prev) =>
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
    setProjects((prev) =>
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
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const next = [...p.milestones];
        next[index] = trimmed;
        return { ...p, milestones: next };
      }),
    );
  };

  const updateTasks = (projectId: string, milestoneIndex: number, tasks: Task[]) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, tasks: { ...p.tasks, [milestoneIndex]: tasks } };
      }),
    );
  };

  const setDueDate = (projectId: string, index: number, raw: string) => {
    const formatted = formatDueDate(raw);
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const next = [...p.dueDates];
        next[index] = formatted;
        return { ...p, dueDates: next };
      }),
    );
  };

  const toggleMilestone = (projectId: string, index: number) => {
    setProjects((prev) =>
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
          {projects.map((p) => {
            const cat = CATEGORIES.find((c) => c.key === p.category)!;
            const isExpanded = expandedId === p.id;
            const isEditing = editingProjectId === p.id;
            return (
              <li key={p.id}>
                <div
                  className={cn(
                    "group relative flex items-center gap-4 py-4 px-2 -mx-2 rounded-sm cursor-pointer",
                    "hover:bg-muted/40 transition-colors",
                  )}
                  onClick={() => {
                    if (isEditing) return;
                    setExpandedId(isExpanded ? null : p.id);
                  }}
                  onDoubleClick={() => setEditingProjectId(p.id)}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full shrink-0", cat.dot)}
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
                    <span className="flex-1 text-left text-foreground font-normal truncate">
                      {p.title}
                    </span>
                  )}
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
  const rows = projects.flatMap((p) => {
    const cat = CATEGORIES.find((c) => c.key === p.category)!;
    return Object.entries(p.tasks ?? {}).flatMap(([msIdxStr, tasks]) => {
      const msIdx = Number(msIdxStr);
      const milestoneLabel = p.milestones[msIdx] ?? "";
      return (tasks ?? [])
        .filter((t) => t.label.trim() !== "")
        .map((t) => ({
          projectId: p.id,
          projectTitle: p.title,
          dot: cat.dot,
          milestoneIndex: msIdx,
          milestoneLabel,
          allTasksAtMilestone: tasks,
          task: t,
        }));
    });
  });

  if (rows.length === 0) return null;

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

  return (
    <section
      aria-label="All tasks"
      className="w-full max-w-3xl flex flex-col mt-16 pt-8 border-t border-border"
    >
      <h2 className="text-[10px] tracking-[0.3em] uppercase font-mono-tabular text-muted-foreground text-center mb-6">
        All Tasks
      </h2>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={`${r.projectId}-${r.milestoneIndex}-${r.task.id}`}
            className="group flex items-center gap-3 py-1"
          >
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
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                r.dot,
              )}
            />
            <span
              className={cn(
                "flex-1 text-[10px] tracking-wider uppercase font-mono-tabular leading-tight truncate",
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
        ))}
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
};

const TaskPanel = ({ tasks, onChange }: TaskPanelProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleTask = (id: string) =>
    onChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const renameTask = (id: string, label: string) => {
    onChange(tasks.map((t) => (t.id === id ? { ...t, label: label.trim() } : t)));
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
  fillClass: string;
  onClick: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
};

const StationMarker = ({
  shape,
  checked,
  fillClass,
  onClick,
  onDoubleClick,
  ariaLabel,
}: StationMarkerProps) => {
  const innerSize = 18;
  const ringWidth = 5;
  const ringGap = 3;
  const totalSize = checked ? innerSize + (ringWidth + ringGap) * 2 : innerSize;
  const stroke = checked ? 4 : 2;
  const c = totalSize / 2;

  const renderShape = () => {
    const fill = "hsl(var(--background))";
    const strokeColor = checked ? "hsl(var(--foreground))" : "hsl(var(--foreground))";
    const common = {
      fill,
      stroke: strokeColor,
      strokeWidth: stroke,
      strokeLinejoin: "round" as const,
    };
    const innerR = innerSize / 2 - stroke / 2;
    switch (shape) {
      case "circle":
      default:
        return <circle cx={c} cy={c} r={innerR} {...common} />;
    }
  };

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
        {checked && (
          <circle
            cx={c}
            cy={c}
            r={innerSize / 2 + ringGap + ringWidth / 2}
            fill="none"
            stroke="hsl(var(--line-video))"
            strokeWidth={ringWidth}
          />
        )}
        {renderShape()}
      </svg>
    </button>
  );
};

const ProgressTrack = ({
  milestones,
  dueDates,
  progress,
  lineColor,
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
  const [openTaskPanel, setOpenTaskPanel] = useState<number | null>(null);

  const handleLabelClick = (i: number) => {
    if (editingLabel === i) return;
    if (openTaskPanel === i) {
      setOpenTaskPanel(null);
      return;
    }
    setOpenTaskPanel(i);
  };

  return (
    <div className="px-2 pb-8 pt-4">
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {milestones.map((label, i) => {
          const checked = i < progress;
          const due = dueDates[i] ?? "";
          const isEditingLabel = editingLabel === i;
          const isEditingDate = editingDate === i;
          const isOpen = openTaskPanel === i;
          const milestoneTasks: Task[] = tasks[i] ?? [];
          return (
            <li key={i} className="flex flex-col items-center gap-2 min-w-0 px-1 relative">
              {/* Label above — single click opens tasks, double click renames */}
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
                  onDoubleClick={() => setEditingLabel(i)}
                  className={cn(
                    "text-[10px] tracking-wider uppercase text-center font-mono-tabular leading-tight cursor-text select-none min-h-[1.5em]",
                    checked ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              )}

              {/* Station marker row with connecting line */}
              <div className="relative w-full flex items-center justify-center h-6">
                {/* Line to next milestone — double-click to insert */}
                {i < count - 1 && (
                  <div
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onInsertMilestone(i);
                    }}
                    className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-4 w-full cursor-copy flex items-center"
                    title="Double-click to insert milestone"
                  >
                    {(() => {
                      if (progress >= i + 2) {
                        return (
                          <div className={cn("h-[5px] w-full rounded-full", lineColor)} />
                        );
                      }
                      let frac = 0;
                      const currentTasks = tasks[i] ?? [];
                      const named = currentTasks.filter((t) => t.label.trim() !== "");
                      if (named.length > 0) {
                        frac = named.filter((t) => t.done).length / named.length;
                      }
                      return (
                        <div className="relative h-[5px] w-full rounded-full overflow-hidden">
                          <div
                            className="absolute inset-0 opacity-90"
                            style={{
                              backgroundImage:
                                "linear-gradient(to right, hsl(var(--border)) 55%, transparent 55%)",
                              backgroundSize: "10px 5px",
                              backgroundRepeat: "repeat-x",
                            }}
                          />
                          {frac > 0 && (
                            <div
                              className={cn("absolute inset-y-0 left-0 rounded-full", lineColor)}
                              style={{ width: `${frac * 100}%` }}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <StationMarker
                  shape="circle"
                  checked={checked}
                  fillClass={lineColor}
                  onClick={() => onToggle(i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDeleteMilestone(i);
                  }}
                  ariaLabel={`${label}${checked ? " (completed)" : ""}`}
                />
              </div>

              {/* Next actions toggle below */}
              <button
                onClick={() => handleLabelClick(i)}
                className={cn(
                  "text-[10px] tracking-wider uppercase font-mono-tabular text-center cursor-pointer select-none min-h-[1.2em] transition-colors",
                  isOpen
                    ? "text-foreground underline underline-offset-2"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-expanded={isOpen}
              >
                next actions
              </button>

              {/* Task panel — absolutely positioned below this milestone column */}
              {isOpen && (
                <div className="absolute top-full left-0 z-20 mt-2 w-[320px] max-w-[90vw]">
                  <TaskPanel
                    tasks={milestoneTasks}
                    onChange={(updated) => onUpdateTasks(i, updated)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Reserve vertical space when a task panel is open so it doesn't overlap content below */}
      {openTaskPanel !== null && (
        <div
          style={{
            minHeight: `${((tasks[openTaskPanel] ?? []).length + 1) * 28 + 24}px`,
          }}
        />
      )}
    </div>
  );
};

export default Index;
