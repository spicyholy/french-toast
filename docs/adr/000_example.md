# Title · ADR-000 · Prevent duplicate document bookmarks

Document type · ADR (Example)\
Updated · 2026-11-25\
Related requirements and documents · EX-BMK-001 AC2, [PRD](../prd/product.md), [API contract](../api/contract.md), [implementation brief](../implementation/000_example.md)

## Status

Proposed

## Context

A user can save the same document from two tabs or retry after a lost response. EX-BMK-001 AC2 requires these requests to leave exactly one bookmark.

## Decision

Enforce uniqueness on the user and document pair in the database. Insert the bookmark atomically and return the same success response if the pair already exists. A read before an unguarded insert lets two requests both see an empty result. Disabling the save button protects only the current tab.

## Consequence

Retries and concurrent saves produce one bookmark. Deployment requires a migration to create the table and its uniqueness constraint. The document detail page keeps its existing behavior and access checks.

## Governance

During code review, the reviewer checks that the migration enforces uniqueness on the pair and that the save uses an atomic insert. During testing, the tester sends two concurrent saves for the same pair and verifies that both succeed and exactly one row exists.

## Notes

The [AC2 test example](../test/000_example.md) gives the requests, database check, and expected responses.
