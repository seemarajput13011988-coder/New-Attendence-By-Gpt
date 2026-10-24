# K&B Workforce 2.0 — Phase 1 starter

This is a **working UI/authentication prototype**, not a production workforce tracker. It has responsive employee/admin interfaces, Firebase email/password login, role checks, admin task assignment, task viewing, and shift-start event recording. It does NOT yet provide secure shift-end handling, location tracking, offline sync, chat, payroll, approvals, or exports.

## Setup
1. Back up your existing Firebase Realtime Database and deployed HTML files.
2. Enable **Firebase Authentication > Email/Password** in Firebase Console.
3. Create employee and admin accounts in Authentication.
4. Using trusted Firebase Console access, create `/profiles/<AUTH_UID>` entries, e.g. `{ "role": "employee", "name": "Technician A", "team": "Team Alpha" }`, and one admin `{ "role": "admin", "name": "Administrator" }`. **Never allow clients to assign their own roles.**
5. Review `database.rules.json` against your existing database paths. **Do not blindly overwrite production rules:** these rules deny legacy paths and may interrupt your current site. Test in a separate Firebase test project first.
6. Host this folder through Netlify or a local web server (ES modules cannot reliably load from `file://`). The existing Firebase project is configured in `firebase.js`; ensure your deployed domain is in Firebase Authentication authorized domains.
7. Test with separate admin and employee accounts.

## Important limitations
- `End shift` is intentionally disabled until a Cloud Function or another trusted backend safely closes existing shift records.
- Starting a shift records a server timestamp, but this prototype does not prevent multiple active shifts. Implement server-side uniqueness and business-hours enforcement before real attendance use.
- Browser location tracking is NOT implemented; reliable Android background tracking requires a native app and explicit employee consent.
- The role checks in UI are supplemental; database rules provide authorization. For production, use server-managed custom claims and trusted backend validation, plus rate limits, audit trails, and stronger input validation.
- Firebase web config is not a password. Do not embed service account credentials in these files.
- This is a new data model (`profiles`, `tasks`, `shifts`) and does not automatically migrate old `workers`/`attendance` data.
- Tailwind CDN is used for ease of preview; bundle Tailwind for production.
