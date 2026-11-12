export default function ProjectsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The workspace draws its own sidebar, so there's no shared header here.
  return children;
}
