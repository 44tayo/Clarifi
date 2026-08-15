-- The HubSpot CRM and Gmail integrations have been removed from the app.
-- These tables stored OAuth access/refresh tokens without row level security
-- enabled (they were only ever reachable via the service-role key), and are
-- no longer written to or read by any code path. Drop them outright rather
-- than leave unused OAuth token storage around.
drop table if exists hubspot_sync_log;
drop table if exists hubspot_connections;
drop table if exists gmail_connections;
