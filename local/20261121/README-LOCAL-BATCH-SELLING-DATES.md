# BIG BROTHER Local Brain V5 / V6 — Batch Selling Date Range Editor
Release: 21-Nov-2026 (Cloud editor save fix / Local parity)

## What is already prepared
- Shared Batch Editor JS in big-brother-stock-report main: Admin can edit Allowed Selling From / To and save a **date-only** correction via **Save Changes** (without touching stock).
- Frontend cache version: `batch-v2-page.js?v=20261121-selling-window-editor-v2` in desktop and mobile Batch Report.
- Offline database patch: `sql/20261121_local_brain_batch_selling_window_parity_v1.sql` (Cloud-equivalent date range read/save RPCs and Invoice Generator batch picker).
- Guarded Windows installer: `local/20261121/APPLY-BATCH-SELLING-DATES-LOCAL-V1.ps1`.
- This release includes **no changes to invoices, existing batch dates, inventory balances, costs, or receivable records**.

## Safe Local Brain procedure
1. **Do not run Cloud-to-Local Refresh solely to install this feature.** It is not a database schema deployment method.
2. On the Local Brain PC, start V5 or V6 and ensure Docker container `supabase_db_Local_Brain` is running.
3. Download `APPLY-BATCH-SELLING-DATES-LOCAL-V1.ps1` into a temporary testing folder **outside** `D:\BIG BROTHER Local Backup\Local Brain`. The installer obtains the matching pinned SQL file from GitHub, or you can download that SQL separately and put it alongside the script.
4. Run PowerShell in that folder:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\APPLY-BATCH-SELLING-DATES-LOCAL-V1.ps1
   ```
   This performs local Docker/database checks and SQL checksum validation, **without changing your database**.
5. When checks pass and you want to deploy the approved patch:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\APPLY-BATCH-SELLING-DATES-LOCAL-V1.ps1 -Apply
   ```
   This creates a **full local PostgreSQL backup first**, then applies schema/function updates in a single SQL transaction. It never connects to Cloud. The backup stays in `LOCAL-BACKUPS` beside the installer.
6. Run **Control Center → Code Sync** to fetch current stock-report frontend HTML/JS/CSS (do not replace Docker database/volumes). Reopen the V5 page on port 8081 or V6 on port 8083/HTTPS 8443. Refresh cached pages if necessary.
7. Use an Admin account: Batch Report → OPEN Batch → Edit Batch → edit **Allowed Selling From / To** only → enter Correction Reason (at least five characters) → **Save Changes**.
8. Reopen the Batch Editor, confirm the saved dates, then verify Invoice Generator shows the new allowed range. Staff outside-range invoices must still be blocked. Run tests on a batch whose existing invoice dates remain inside the intended range.

## Security and boundaries
- **Only OPEN batches** are eligible for selling-date corrections.
- **Only Admin** can save the range; other staff can view the rule, not edit.
- Existing invoice dates must remain inside the new range. The DB rejects invalid changes.
- Existing batch stock, original batch date, closed batches and invoice records are not modified by this migration.
- Legacy batches without windows remain unchanged unless an Admin explicitly sets their allowed range.
- Changing date range *and* stock at once requires two separate audited saves.
- Do not copy SQL changes automatically into a live Local database as part of a test rehearsal. Back up first; do not modify Docker volumes or run Local-to-Cloud Upload.

## Troubleshooting
- "Cannot retrieve matching SQL": download the SQL file above and place it beside the installer.
- "Unknown Local ... RPC shape": your Local Brain schema differs from the guarded migration. **Stop** and review the error; don't force replace functions.
- "Existing Batch invoices fall outside": choose a range covering all already-saved invoices; do not edit invoice history.
- "No Batch changes were made": Control Center Code Sync likely still serves an older `batch-v2-page.js`; check for the cache suffix `selling-window-editor-v2`.
- If SQL application fails, its transaction rolls back; keep the full backup and send its error message for diagnosis.
- The installer does not start Local Brain, apply to Cloud, or automatically perform Code Sync. It must run on the user's Windows Local Brain PC.

## Deployment status
Cloud GitHub frontend and Cloud DB verified. Local package **prepared but not executed** (local Windows Docker is not remotely accessible from this chat).
