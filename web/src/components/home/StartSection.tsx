"use client";

import { ArrowRight, CaretRight, FolderSimple, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RemoveProjectDialog from "@/components/home/RemoveProjectDialog";
import { api, type Project } from "@/lib/api";

export default function StartSection() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e) => {
      setProjects([]);
      setError(`Can't reach the backend: ${e.message}`);
    });
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await api.createProject(name);
      router.push(`/projects/${project.id}/01-scope`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <section id="start" className="scroll-mt-24 px-4 py-32 md:px-6 md:py-48">
      <div className="relative isolate mx-auto max-w-[1400px] overflow-hidden rounded-[2.5rem] bg-[#0e2a57] px-6 py-20 text-white md:px-16 md:py-28">
        <div className="absolute -right-24 -top-24 -z-10 size-[520px] rounded-full bg-accent/60 blur-[140px]" />
        <div className="absolute -bottom-40 left-10 -z-10 size-[420px] rounded-full bg-sky-400/30 blur-[140px]" />

        <h2 className="max-w-5xl font-display text-[clamp(2.75rem,6vw,6rem)] font-extrabold leading-[0.98] tracking-tight">
          Start with your business name
        </h2>
        <p className="mt-6 max-w-xl text-lg text-white/75">
          The first conversation takes about ten minutes. You can stop and come back any time.
        </p>

        <form onSubmit={create} className="mt-12 max-w-2xl">
          <label htmlFor="project-name" className="text-sm font-medium text-white/85">
            Project name
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bean There Café"
              className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-6 py-4 text-white outline-none backdrop-blur transition placeholder:text-white/55 focus:border-white/70 focus:bg-white/15"
            />
            <button
              disabled={creating || !name.trim()}
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-7 py-4 font-semibold text-[#0e2a57] transition hover:bg-accent-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Start a project"}
              <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-0.5" />
            </button>
          </div>
          {error && <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white">{error}</p>}
        </form>
      </div>

      <div className="mx-auto mt-20 max-w-3xl">
        <h3 className="font-display text-3xl font-bold tracking-tight">Your projects</h3>
        <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
          {projects === null && (
            <div className="animate-pulse divide-y divide-line" aria-label="Loading projects">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="size-10 rounded-xl bg-surface-2" />
                  <div className="h-4 w-40 rounded bg-surface-2" />
                </div>
              ))}
            </div>
          )}
          {projects?.length === 0 && (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                <FolderSimple size={24} />
              </span>
              <p className="mt-4 font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-muted">Name your first project above to get started.</p>
            </div>
          )}
          {projects && projects.length > 0 && (
            <ul className="divide-y divide-line">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className={`group/row relative grid transition-all duration-300 ease-out ${
                    leaving === project.id ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                  }`}
                >
                  <div className="overflow-hidden">
                    <Link
                      href={`/projects/${project.id}`}
                      className="group flex items-center gap-4 py-4 pl-5 pr-16 transition hover:bg-surface-2"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft font-display font-bold text-accent-ink">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{project.name}</span>
                        <span className="block text-sm text-muted">
                          Created {new Date(project.created_at).toLocaleDateString()}
                          {project.live_url && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          )}
                        </span>
                      </span>
                      <CaretRight
                        size={18}
                        className="text-faint transition group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoving(project)}
                    aria-label={`Remove ${project.name}`}
                    title="Remove project"
                    className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-faint opacity-100 transition duration-200 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 active:scale-90 md:opacity-0 md:group-hover/row:opacity-100"
                  >
                    <Trash size={17} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {removing && (
        <RemoveProjectDialog
          project={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            const id = removing.id;
            setRemoving(null);
            setLeaving(id);
            // Let the row fold away, then drop it from the list.
            setTimeout(() => {
              setProjects((list) => list?.filter((p) => p.id !== id) ?? null);
              setLeaving(null);
            }, 320);
          }}
        />
      )}
    </section>
  );
}
