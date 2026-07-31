# Walkthrough - MAKNA Flow Complete Isolation & Deployment

We have successfully executed and completed all phases (Phase 1, 2, & 3) of the implementation plan to create, configure, migrate, and deploy the isolated **MAKNA Flow** system alongside MAKNA Grid.

---

## Changes Implemented in Phase 1 (Code Rebranding)

1. **Replicated Codebase:**
   - Cloned/duplicated the codebase from `/Users/sabeqmmursyid/_makna-grid/` to `/Users/sabeqmmursyid/_maknaflow/`, excluding heavy development dependencies (`node_modules`, `.next`, and `.git` tags).

2. **Rebranded Package Name (`package.json`):**
   - Changed the package descriptor name to `"name": "maknaflow"` in the new directory.

3. **Isolated SQLite Fallback Database (`lib/db.js`):**
   - Changed the fallback database filename to `makna_flow.db` to prevent any local SQLite database writes from bleeding into the production `makna_grid.db`.

4. **Rebranded UI Elements:**
   - **Page Metadata Title (`app/layout.js`):** Changed to `'MAKNA FLOW — Isolated SaaS Content Flow Platform'`.
   - **Login UI (`app/login/page.js`):** Updated title text to `MAKNA FLOW` and description to `Isolated SaaS Content Flow Platform`.
   - **Sidebar Brand (`app/components/Sidebar.js`):** Updated logo title to `MAKNA FLOW` and description to `Isolated SaaS Platform`.
   - **ContentFlow Subtitle (`app/content-flow/page.js`):** Rebranded description to refer to `MAKNA Flow`.
   - **Main Dashboard Title (`app/page.js`):** Updated to `MAKNA Flow Platform`.
   - **Settings Description (`app/settings/page.js`):** Updated config description reference to `MAKNA Flow`.
   - **API Headless Server (`apps/api/server.js`):** Changed startup logger and health check engine name to `MAKNA Flow Headless Core API V2.0`.

---

## Changes Implemented in Phase 2 (Database & Environment Isolation)

1. **PostgreSQL Database Isolation:**
   - Created a separate physical PostgreSQL database named **`maknaflow_db`** on Node 3 (`402-homecloud.tail8194e4.ts.net`).
   
2. **Environment File Configuration (`.env.local`):**
   - Configured the environment file `/Users/sabeqmmursyid/_maknaflow/.env.local`.
   - Set the database connection targets: `PGDATABASE=maknaflow_db` and `PG_SEARCH_PATH=public`.
   - Connected other services via Tailscale MagicDNS:
     - Database Host: `402-homecloud.tail8194e4.ts.net`
     - Webhook Worker Host: `sbq-pc.tail8194e4.ts.net`
     - Nextcloud Root Directory: `/maknaflow` (User will create parent folder manually)

3. **Database Migration and Table Seeding:**
   - Bootstrapped npm dependencies inside `/Users/sabeqmmursyid/_maknaflow`.
   - Executed the SQLite-to-PostgreSQL migration script against `maknaflow_db` (using the standard `public` schema).
   - Successfully created all 54 database tables and seeded initial permissions and configuration values in the new database.

---

## Changes Implemented in Phase 3 (Deployment & Background Running)

1. **Optimized Codebase Synchronization:**
   - Configured an optimized `rsync` deployment script that excludes huge media caches and local SQLite files (reducing transfer size from **3.4GB down to 7MB**).
   - Transferred the clean codebase to `/home/sabeqmursyid/maknaflow` on Node 1 Gateway (`makna-ui`).

2. **Next.js Production Build:**
   - Logged into Node 1 via SSH to run `npm install` and `npm run build`.
   - Compiled Next.js production bundles successfully.

3. **Launched Isolated Services:**
   - Started the Express API server on Port `6000` (pointing to `maknaflow_db` on Node 3).
   - Started the Next.js UI Gateway on Port `5000` (routing to the API server on Port 6000).
   - Both services are running stably in the background via native `nohup` matching standard project deployment practices.

4. **Caddy Cleanup & Prepared for Cloudflare Tunnel:**
   - Uninstalled and purged Caddy web server from Node 1 Gateway to free system resources and prevent port conflicts.
   - Restored direct HTTP access via ports to allow direct integration with a **Cloudflare Tunnel** in the future.

---

## Verification Results

Both services are fully responsive on Node 1 directly over the Tailscale network:
* **MAKNA Grid Production (Port 3000):**
  - URL: `http://100.65.62.63:3000` / `http://nuc-desktop.tail8194e4.ts.net:3000`
* **MAKNA Flow Production (Port 5000):**
  - URL: `http://100.65.62.63:5000` / `http://nuc-desktop.tail8194e4.ts.net:5000`
  - Output: Connects cleanly and redirects to `/login`.
* **API Server (Port 6000):** Healthy response connected to PostgreSQL `maknaflow_db` database on Node 3.
  - URL: `http://100.65.62.63:6000/health`
  - Output: `{"status":"healthy","engine":"MAKNA Flow Headless Core API V2.0","port":"6000","database":"PostgreSQL 18.4 (Node 3 100.78.186.123:5432)"}`
