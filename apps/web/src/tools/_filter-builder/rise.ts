export const RISE = `
@keyframes fb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fb-rise { animation: fb-rise .45s cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .fb-rise { animation: none; } }
`;
