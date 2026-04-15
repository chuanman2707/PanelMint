# Sentinel Journal

## 2026-04-15

- Hardened `getClientIp` in `src/lib/api-rate-limit.ts` to prefer `x-real-ip` before `x-forwarded-for`, reducing spoofable rate-limit bypass risk on auth endpoints.
- Added unit coverage in `src/lib/__tests__/api-rate-limit.test.ts` for header precedence, forwarded fallback, and default localhost behavior.
