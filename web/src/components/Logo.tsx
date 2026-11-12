/**
 * Gagesite mark: a browser window whose top is a striped shop awning, with a doorway below.
 * Keep in sync with src/app/icon.svg (the favicon).
 */
export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="10" width="52" height="46" rx="10" fill="#2266D4" />
      <rect x="11" y="24" width="42" height="27" rx="5" fill="#E5F0FD" />
      <path d="M11 22 h10.5 v3 a5.25 5.25 0 0 1 -10.5 0 Z" fill="#FFFFFF" />
      <path d="M21.5 22 h10.5 v3 a5.25 5.25 0 0 1 -10.5 0 Z" fill="#7FB0F0" />
      <path d="M32 22 h10.5 v3 a5.25 5.25 0 0 1 -10.5 0 Z" fill="#FFFFFF" />
      <path d="M42.5 22 h10.5 v3 a5.25 5.25 0 0 1 -10.5 0 Z" fill="#7FB0F0" />
      <circle cx="13" cy="16" r="1.7" fill="#E5F0FD" />
      <circle cx="18" cy="16" r="1.7" fill="#E5F0FD" />
      <circle cx="23" cy="16" r="1.7" fill="#E5F0FD" />
      <path d="M27 51 V42 a5 5 0 0 1 10 0 V51 Z" fill="#2266D4" />
    </svg>
  );
}
