# Nodo CRM - Platform Context & Handoff Summary

This document summarizes the current state of the Nodo CRM platform, its architecture, and the features we have built. You can provide this file to a new AI session to immediately bring it up to speed.

## 1. Platform Overview
**Nodo CRM** is a multi-portal web application built to manage solar and energy storage (BESS) installation projects. It connects various stakeholders across the lifecycle of an energy project.

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS, Lucide Icons
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Auth)
- **Deployment**: Vercel

### User Roles & Portals
The platform uses Role-Based Access Control (RBAC) to route users to specific portals upon login:
- **`nodo_admin` (`/admin`)**: Full platform visibility, global dashboard, user management, project oversight.
- **`nodo_analista` (`/analista`)**: Similar to admin but focused on project analysis and progressing deals.
- **`epc` (`/epc`)**: The installers/engineering companies. They submit projects, update statuses, and manage their clients.
- **`cliente_final` (`/cliente`)**: View-only access to their specific installed projects.
- **`financiero` (`/financiero`)**: Access to the financial portfolio and performance of funded projects.
- **`suministrador` (`/mem`)**: Access to the energy marketplace (Mercado Eléctrico Mayorista).

## 2. Core Architecture & Data Model
- **Projects (`proyectos`)**: The central entity. Tracks the state of a deal from `recibido` (Lead) to `completado` (Completed). Uses a JSONB column `historial_estados` to track timestamps of stage transitions.
- **Clients (`clientes`)**: Associated with projects.
- **Products (`proyecto_sitio_productos`)**: Technical and financial metadata for projects (CAPEX, estimated monthly savings, system type: `fv` or `bess`).
- **Telemetry (`telemetria_egauge`)**: Live production data (kWh) for operational projects.
- **Profiles (`profiles`)**: Extended user data linked to Supabase Auth.

## 3. Recently Built Features

### A. Rich Analytics Dashboard
We built a centralized, high-performance analytics dashboard available in the Admin and Analyst portals.
- **Server-Side Aggregation (`lib/dashboard-data.ts`)**: A robust data fetching layer that pulls from 8+ tables simultaneously, computing aggregations on the server to keep the UI lightning fast.
- **Time-Period Filtering**: The dashboard includes client-side time selectors (All Time, YTD, Last Quarter, etc.) that instantly recalculate metrics.
- **Key Dashboard Sections**:
  - **KPIs**: Total projects, Pipeline Value, Installed Capacity, Win Rate.
  - **Sales Pipeline**: Projects by stage, Conversion Funnel (waterfall drop-offs), and Pipeline Velocity (average days between stages).
  - **Financial Performance**: CAPEX breakdown (FV vs. BESS), Monthly Savings, and projected 25-year ROI.
  - **Operational**: Fleet production tracking.
  - **Stale Pipeline Alerts**: A dynamic list highlighting projects stuck in a stage for more than X days (configurable 15/30/60/90 days).

### B. User Management System Refactor
We streamlined how platform users are managed, separating viewing from editing to improve security and UX.
- **Directory (`/usuarios`)**: A view-only directory accessible from the main sidebar for Admins and Analysts. Includes global statistics (total, active, pending, EPCistas) and filtering.
- **Roles & Permissions (`/configuracion/roles`)**: Moved all destructive/administrative actions here. Admins and Analysts can:
  - Change user roles.
  - Edit user email addresses (via Supabase Admin API).
  - Reset user passwords (via Supabase Admin API).
  - Delete users safely (with self-deletion prevention).

## 4. Next Steps & Known Context
- **Deployment**: We are using existing branches (e.g., `feature/rich-analytics-dashboard`, `fix/usuarios-readonly-roles-management`) to push changes, avoiding branch clutter.
- **Data Integrity**: The accuracy of the financial dashboard relies heavily on the `proyecto_sitio_productos` table being populated correctly by EPCs (specifically `capex` and `ahorro_mensual_estimado`).
- **Styles**: We prefer raw CSS/Tailwind over heavy charting libraries to maintain bundle size efficiency. All dashboard charts are built using custom HTML/Tailwind implementations.
