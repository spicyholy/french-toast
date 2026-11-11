# Example · Prevent duplicate document bookmarks

Document type · ADR\
Status · Example / Pending adoption\
Updated · 2026-11-11\
Related requirements and documents · EX-BMK-001 AC2, [PRD](../prd/product.md), [API contract](../api/contract.md), [implementation brief](../implementation/000_example.md)

## Context

Requests can overlap when a user saves a document from several tabs or retries after losing the response to a network interruption.

## Decision and alternatives

Add a uniqueness constraint on the user and document pair and use an atomic insert. Return the same success response when the pair already exists. With a read before an unguarded insert, two concurrent requests can both find no record. Disabling the button during a save reduces duplicate actions on one page. The database constraint handles other tabs and retries.

## Impact

A migration adds the table and constraint. Existing document access checks and detail page behavior are preserved. AC2 in the [test example](../test/000_example.md) checks that concurrent requests both succeed and produce one record.
