# System Overview

## Purpose

Summarize Logly's deployable surfaces and package boundaries.

## System

Browser and server SDKs send bounded event batches to a project same-origin
route. That route forwards to the central Hono collector, which validates
project/origin/key policy, derives a project-scoped visitor key, and writes
events through the DB package. Better Auth gates operator dashboard routes with
server-validated Postgres sessions. Authenticated dashboard code then reads
project-scoped aggregates and events through the read API.
