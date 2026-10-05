type P = { filled?: boolean };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Heart = ({ filled }: P) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} aria-hidden>
    <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
  </svg>
);
export const Play = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" /></svg>
);
export const Download = () => (
  <svg {...base} aria-hidden><path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20h15" /></svg>
);
export const Close = () => (
  <svg {...base} aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Left = () => (
  <svg {...base} aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
);
export const Right = () => (
  <svg {...base} aria-hidden><path d="M9 5l7 7-7 7" /></svg>
);
export const Down = () => (
  <svg {...base} aria-hidden><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const Note = () => (
  <svg {...base} aria-hidden><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" /></svg>
);
export const Lock = () => (
  <svg {...base} aria-hidden><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
);
export const Sun = () => (
  <svg {...base} aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
);
export const Moon = () => (
  <svg {...base} aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
);
export const Send = () => (
  <svg {...base} aria-hidden><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>
);
export const Film = () => (
  <svg {...base} aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>
);
export const Photo = () => (
  <svg {...base} aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5.5-5.5L5 20" /></svg>
);
export const Check = () => (
  <svg {...base} aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
