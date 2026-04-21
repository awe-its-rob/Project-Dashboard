import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "video" | "design" | "music";

const DEFAULT_MILESTONES = ["Brief/Concept", "Quote", "Draft 1", "Final", "Invoice", "Paid"];

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
        return { ...p, progress: p.progress ?? 0, milestones, dueDates };
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
        return { ...p, milestones, dueDates, progress };
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
        return { ...p, milestones, dueDates, progress };
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

      <section aria-label="Projects" className="w-full max-w-md flex flex-col">
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
              <li key={p.id} className="border-b border-border/60">
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
                    onToggle={(i) => toggleMilestone(p.id, i)}
                    onRenameMilestone={(i, label) => renameMilestone(p.id, i, label)}
                    onSetDueDate={(i, raw) => setDueDate(p.id, i, raw)}
                    onDeleteMilestone={(i) => deleteMilestone(p.id, i)}
                    onInsertMilestone={(i) => insertMilestone(p.id, i)}
                  />
                )}
              </li>
            );
          })}

          {composing && (
            <li className="flex items-center gap-4 py-4 border-b border-border/60">
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
    </main>
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
  onToggle: (index: number) => void;
  onRenameMilestone: (index: number, label: string) => void;
  onSetDueDate: (index: number, raw: string) => void;
  onDeleteMilestone: (index: number) => void;
  onInsertMilestone: (afterIndex: number) => void;
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
}: ProgressTrackProps) => {
  const count = milestones.length;
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<number | null>(null);

  return (
    <div className="px-2 pb-8 pt-4">
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {milestones.map((label, i) => {
          const checked = i < progress;
          const due = dueDates[i] ?? "";
          const isEditingLabel = editingLabel === i;
          const isEditingDate = editingDate === i;
          return (
            <li key={i} className="flex flex-col items-center gap-2 min-w-0 px-1 relative">
              {/* Label above */}
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

              {/* Circle row with connecting line */}
              <div className="relative w-full flex items-center justify-center h-3.5">
                {/* Line to next milestone — double-click to insert */}
                {i < count - 1 && (
                  <div
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onInsertMilestone(i);
                    }}
                    className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-3 w-full cursor-copy flex items-center"
                    title="Double-click to insert milestone"
                  >
                    {progress >= i + 2 ? (
                      <div className={cn("h-px w-full", lineColor)} />
                    ) : (
                      <div
                        className="h-px w-full"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, hsl(var(--border)) 50%, transparent 50%)",
                          backgroundSize: "6px 1px",
                          backgroundRepeat: "repeat-x",
                        }}
                      />
                    )}
                  </div>
                )}
                <button
                  onClick={() => onToggle(i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDeleteMilestone(i);
                  }}
                  aria-pressed={checked}
                  aria-label={`${label}${checked ? " (completed)" : ""}`}
                  title="Click to toggle, double-click to delete"
                  className={cn(
                    "relative z-10 h-3.5 w-3.5 rounded-full border transition-colors",
                    checked
                      ? cn(lineColor, "border-transparent")
                      : "bg-background border-border hover:border-foreground",
                  )}
                />
              </div>

              {/* Due date below */}
              {isEditingDate ? (
                <InlineEdit
                  initial={due}
                  centered
                  onCommit={(val) => {
                    onSetDueDate(i, val);
                    setEditingDate(null);
                  }}
                  onCancel={() => setEditingDate(null)}
                  className="text-[10px] tracking-wider font-mono-tabular w-full"
                />
              ) : (
                <span
                  onDoubleClick={() => setEditingDate(i)}
                  className="text-[10px] tracking-wider font-mono-tabular text-center text-muted-foreground cursor-text select-none min-h-[1.2em]"
                  title="Double-click to edit due date (DD.MM)"
                >
                  {due || "—"}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Index;
