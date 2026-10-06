# Tender Document Package Builder

Frontend-only web app (AI DevFest). Turns a set of PDFs into one checked, ordered tender package. All processing happens in the browser; no file is uploaded anywhere.

## Features
- Load `requirements.json` (tender details + required documents, sorted by `order`)
- Upload many PDFs (name + page count); non-PDF, damaged and password-protected files get a clear message
- Match each file to one requirement (1 file ↔ 1 requirement), change/undo anytime
- Expiry date entry, live status: Missing / Expiry date needed / Expired / Not provided / OK
- Duplicate detection by SHA-256 content hash (duplicates cannot go to different documents)
- Generate button disabled while any blocking status exists, with reasons shown
- Package: English cover page, documents in order, footer `<tender_id> | Page X of Y` placed in a bottom margin (never covers content)
- Download as `<tender_id>_Package.pdf`
- English / Bangla toggle (whole UI + document titles)

## Run
```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```
## Notes
Cover page uses Helvetica (English only, as required). Non-Latin characters in tender fields are replaced by `?`.
License: Apache-2.0
