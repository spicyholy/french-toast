# Example · Bookmark button on the document detail page

Document type · Screen design\
Status · Example / Pending adoption\
Updated · 2026-11-11\
Related requirements and documents · EX-BMK-001 AC1–AC3, [PRD](../prd/product.md), [API contract](../api/contract.md), [implementation brief](../implementation/000_example.md)

## Local wireframe

```text
Document detail
┌────────────────────────────────┐
│ Document title       [Bookmark] │
│                                │
│ Document content               │
└────────────────────────────────┘
Status area below the button · Saving / Saved / Save failed [Retry]
```

| State | Behavior |
| --- | --- |
| Initial lookup | Show a loading state and disable the save action. Show “Bookmark” if unsaved or “Saved” if saved. |
| Saving | Keep the button in place at the same size and prevent duplicate clicks. Stay on the detail page. |
| Save succeeds | Show “Saved.” On reentry, restore the state from the lookup. |
| Save fails | Show the error and a “Retry” button. Retrying sends the same save request. |
| Document missing | Show the existing document missing state. Hide the save action. |

Use existing button colors and spacing from the detail page. Leave 16 px between the title and button and use a 1 px button border. Use text and color to show success and failure. Make the action keyboard accessible, keep a visible focus indicator, and announce status to screen readers. Update the text without a page transition animation. Add design references to the [references directory](references/) or link an accessible Figma file.
