# RankIT Frontend (frontend-react)

This app is the React dashboard for RankIT and is connected to the Express backend.

## Backend Connection

The frontend calls the backend API URL from REACT_APP_API_URL.

1. Create a .env file in frontend-react.
2. Add this value:

REACT_APP_API_URL=http://localhost:5000/api

If REACT_APP_API_URL is not set, the app defaults to http://localhost:5000/api.

When the frontend is opened from another device, localhost API configs are automatically rewritten to that device-visible host IP.

## Run Order

1. Start backend first from backend folder.
2. Start frontend from frontend-react folder.

Backend command:

npm run dev

Frontend command:

npm start

Open http://localhost:3000.

## Useful Scripts (frontend-react)

npm start
Runs the app in development mode.

npm test
Runs the test suite once in watch mode.

npm run build
Creates a production build.

## Notes

- Login and role routing depend on backend JWT responses.
- Self-registration now supports tallier, tabulator, and grievance committee roles (pending approval flow).
- Tabulator view polls backend every 5 seconds for gatekeeper unlock state.
- Tabulator view now includes Manage Judges for assigning approved talliers to the selected event.
- Tabulator dashboard is split into separate tabs: Dashboard, Manage Judges, View Final Rankings, and Download Tabulation PDF.
- Tabulator Print area includes Preview Master Report, which opens a PDF preview first, then allows download or print.
- Master Event Report includes dynamic criterion columns and totals, with deductions displayed in a dedicated table column.
- Master Report Preview now features tabbed navigation: Main Report (all criteria, totals, and deductions) and Deduction Notes (separate detailed report of all deduction entries).
- Deduction Notes PDF displays each contestant with total deductions and itemized list of deduction reasons and amounts.
- Master PDF report uses deterministic row chunking per page to prevent unnecessary trailing blank pages.
- Tabulator printable reports now include the current tabulator username.
- Browser print for Print Tabulation PDF and Print Tally PDF now auto-sizes to report content so only necessary pages are used.
- Admin User Configuration area has subtabs for User Approval and Manual Create User.
- Grievance Committee users have a dedicated Grievance Dashboard for viewing preliminary scores and filing deduction entries via a modal form.
- Superadmin Analytics now includes subtabs for Users By Role, Event Submissions, and Average Score Trend visualizations.
- Superadmin Audit Trail now opens a preview-first PDF modal (matching Master Report), allowing print via toolbar and filtered-log PDF download.
- Superadmin User Oversight now includes a Users subtab that shows all users in one table with horizontal username/role/status filtering and preview-first PDF export, without nested inner tabs.
- Superadmin page now uses manual/triggered audit refresh (polling removed) and persists per-user UI state plus action history in localStorage.
- Frontend now has a global icon-only light/dark theme switcher available on all pages, with theme preference persisted in localStorage.
- The global theme icon is rendered as a high-layer floating control and moves to a safe bottom-right position on mobile to avoid navbar/content overlap.
- Mobile navbar layout now keeps brand and account actions in a horizontal top row, with role links in a horizontal scrollable row below for better small-screen usability.
- All in-app data tables now default to 10 rows per page and include pager controls (Previous/Next) for consistent navigation across dashboards.
- Tallier Print Tally PDF outputs all contestants for the selected event in tabular format with columns for contestant number, contestant name, and per-criterion scores.
- Tabulator ranking displays include raw average, deduction points, and final score (after grievance deductions).
- Tallier printable report now includes the current tallier username.
