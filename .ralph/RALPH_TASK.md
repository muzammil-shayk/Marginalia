---
task: Create a separate /api/download endpoint that handles all download logic
completion_criteria:
  - Puppeteer installed
  - Express route POST /api/download created
  - documentExporter.ts updated to fetch from the new endpoint
  - Downloads for TXT, HTML, and PDF work
  - PDF perfectly matches the preview styling
max_iterations: 10
---

## Requirements

Move the frontend document export string building (for TXT, HTML) to the backend.
For PDF, use puppeteer on the generated HTML string to create a binary PDF and send it as an attachment.
Ensure the PDF perfectly matches the preview.
