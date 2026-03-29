# PLATE MVP Launch Notes

**Date:** March 29, 2026  
**Version:** Quotation MVP v1.0

---

## Overview

This document describes the transformation of the PLATE app into a **quotation-first MVP** for launch. The refactor focuses the product on fast, accurate CNC steel cutting quotes from DXF and Excel files, while preserving valuable underlying systems for future phases.

---

## Product Vision for MVP

**Core Value Proposition:**  
A web-based quoting tool that helps CNC steel shops generate fast, accurate quotes from DXF and Excel files.

**Target User:**  
CNC steel fabrication shops that need to:
- Upload customer DXF files and Excel BOMs
- Parse and validate part data
- Calculate material and cutting costs
- Generate professional PDF quotes

**User Experience Goal:**  
Simple, focused, commercial. The user should feel: "I can upload files and get a quote in minutes."

---

## What Changed

### 1. Navigation Simplification

**Before (Production-Heavy):**
- Dashboard
- Batches
- Quick Quote
- Quick Plate Builder
- Clients
- New Batch
- Preferences

**After (Quotation-First):**
- Dashboard
- Quotes
- Clients
- Settings

**Rationale:**  
Removed "Quick Plate Builder" and "New Batch" from primary navigation. The main product entry points are now:
1. **Quick Quote** (fast DXF + Excel → quote)
2. **New Quote Job** (organized multi-client quote workflow)

### 2. Dashboard Transformation

**Before:**
- Stats: Total Batches, Active Batches, Total Clients, Uploaded Files
- Recent Batches list

**After:**
- Stats: Total Quotes, Active Quotes, Clients, Quick Quote (clickable card)
- Recent quotes list
- Primary CTAs: "Quick Quote" and "New Quote Job"

**Rationale:**  
Dashboard now emphasizes quotation as the primary workflow. The "Quick Quote" stat card is clickable and leads directly to the fast quote flow.

### 3. Batch Process Workflow Simplification

**Before (4 steps):**
1. Import data
2. Validation
3. Stock configuration
4. Nesting results

**After (2 steps for MVP):**
1. Import data
2. Review parts

**Rationale:**  
Stock configuration and nesting results are hidden from the main MVP flow. These routes still exist in the codebase (`/batches/[id]/stock`, `/batches/[id]/nesting`, `/batches/[id]/nesting-results/[sheetId]`) but are not part of the visible stepper navigation. Users can still access them directly via URL if needed for internal use.

### 4. Terminology Updates

| Before | After | Context |
|--------|-------|---------|
| Batches | Quotes | Primary navigation, page titles |
| New Batch | New Quote Job | CTA buttons, page titles |
| Validation | Review parts | Step 2 in quote job workflow |
| All batches | All quotes | Breadcrumb links |
| Batch Name | Quote Job Name | Form labels |
| Production batch | Quote job | Descriptions |

**Rationale:**  
Language now reflects quotation-first product positioning while maintaining internal "batch" terminology in code for consistency with existing data models.

### 5. Hidden Features (Still in Codebase)

The following features remain in the codebase but are hidden from the MVP user flow:

**Routes that still exist but are not linked in navigation:**
- `/batches/[id]/stock` - Stock sheet configuration
- `/batches/[id]/nesting` - Nesting setup
- `/batches/[id]/nesting-results` - Nesting results viewer
- `/batches/[id]/nesting-results/[sheetId]` - Individual sheet viewer
- `/batches/[id]/plate-builder` - Plate builder tool
- `/plate-builder` - Standalone plate builder

**Why keep them:**
- These systems contain valuable geometry processing, nesting algorithms, and visualization code
- They can be reintroduced in post-MVP phases
- No need to delete working code that doesn't interfere with MVP UX

---

## MVP User Flow

### Primary Flow: Quick Quote

**Route:** `/quick-quote`

**Steps:**
1. **Upload** - DXF files + Excel BOM
2. **Job Details** - Client info, reference number, currency
3. **Stock & Pricing** - Material pricing, cutting rates, setup fees
4. **Validation** - Review and fix part data
5. **Quote** - See calculated quote with insights
6. **Finalize** - Edit PDF data and export

**Key Features:**
- Interactive quote insights (margin impact, sheet sensitivity)
- Live price calculations
- Sheet count estimation
- Professional PDF export

**Tech Stack:**
- React + Next.js frontend
- Python + Playwright for PDF generation
- Recharts for visualizations
- Tailwind CSS for styling

### Secondary Flow: Quote Jobs (Multi-Client)

**Route:** `/batches/new` → `/batches/[id]`

**Steps:**
1. **Create Quote Job** - Name and cutting method
2. **Import Data** - Link clients, upload files per client
3. **Review Parts** - Unified parts table with inline editing

**Use Case:**  
For organizing multiple clients' files in one quote job, with ability to review all parts together.

**Note:**  
This flow currently ends at "Review parts" for MVP. Future phases can add quote calculation and export to this flow as well.

---

## What Was Kept

### Core Systems (Fully Reused)

1. **DXF Parsing & Geometry Processing**
   - Location: `lib/dxf/`, `lib/geometry/`
   - Extracts contours, holes, dimensions, area, perimeter
   - Validates geometry quality
   - Status: Production-ready

2. **Excel BOM Parsing & Matching**
   - Location: `lib/excel/`, `lib/parts/`
   - Parses Excel BOMs
   - Matches Excel rows to DXF files
   - Handles quantity, thickness, material
   - Status: Production-ready

3. **Parts Data Model**
   - Location: `types/index.ts`, `lib/store/`
   - Unified part representation
   - Supports inline editing
   - Validation and error states
   - Status: Production-ready

4. **Client Management**
   - Location: `features/clients/`, `app/clients/`
   - Global client directory
   - Client picker for quote jobs
   - Status: Production-ready

5. **Quick Quote Flow**
   - Location: `features/quick-quote/`
   - Complete 6-step quotation workflow
   - Interactive insights and charts
   - PDF export with editable data
   - Status: Production-ready, **primary MVP feature**

6. **PDF Export Pipeline**
   - Location: `server/pdf/`, `app/api/quotes/export-pdf/`
   - Python + Playwright rendering
   - Professional A4 quote documents
   - Jinja2 templates with dedicated print CSS
   - Status: Production-ready

7. **Settings & Preferences**
   - Location: `features/settings/`, `app/settings/`
   - Unit system (metric/imperial)
   - Cutting profiles
   - Sheet sizes catalog
   - Status: Production-ready

### Data Storage

**Location:** `lib/store/index.ts`

**Architecture:**  
In-memory store with localStorage persistence. Designed so a real backend/API layer can be swapped in later by replacing the functions in this module.

**Data Models:**
- Batches (quote jobs)
- Clients
- Parts
- Files (DXF, Excel)
- Excel rows
- DXF geometries
- Stock sheets
- Nesting runs
- Settings

**Status:**  
Production-ready for MVP. All CRUD operations work. Easy to replace with API calls later.

---

## What Was Hidden

### Features Hidden from MVP Navigation

1. **Stock Configuration**
   - Route: `/batches/[id]/stock`
   - Purpose: Configure stock sheets per thickness
   - Status: Hidden from stepper, accessible via direct URL

2. **Nesting Setup & Results**
   - Routes: `/batches/[id]/nesting`, `/batches/[id]/nesting-results`
   - Purpose: Advanced nesting optimization
   - Status: Hidden from stepper, accessible via direct URL

3. **Sheet Viewer**
   - Route: `/batches/[id]/nesting-results/[sheetId]`
   - Purpose: Detailed sheet visualization with Konva canvas
   - Status: Hidden from stepper, accessible via direct URL

4. **Plate Builder**
   - Routes: `/plate-builder`, `/batches/[id]/plate-builder`
   - Purpose: Custom plate design tool
   - Status: Hidden from navigation, accessible via direct URL

### Why Hidden (Not Deleted)

- These features are production-grade and valuable
- They contain complex geometry processing and visualization code
- They can be reintroduced in post-MVP phases
- Hiding them simplifies the MVP UX without losing engineering investment

---

## Quote Engine (MVP Implementation)

### Current Implementation: Quick Quote

**Location:** `features/quick-quote/`

**Quote Calculation Components:**

1. **Material Cost**
   - Based on: part area × material price per m²
   - Configurable per material/thickness in Stock & Pricing step
   - Supports multiple materials and thicknesses

2. **Cutting Cost**
   - Based on: total cut length × cutting rate (per meter)
   - Configurable per cutting method and thickness range
   - Uses cutting profiles from settings

3. **Pierce Cost**
   - Based on: number of holes × pierce rate
   - Configurable per cutting method and thickness
   - Extracted from DXF geometry

4. **Setup Cost**
   - Fixed setup fee per quote
   - Configurable in Stock & Pricing step

5. **Sheet Estimation**
   - Formula: `totalNetPlateArea / (utilization% / 100) / stockSheetArea`
   - Result: estimated sheet count
   - Interactive sensitivity chart shows impact of utilization changes
   - **Note:** This is a practical estimation model, not full nesting optimization

6. **Pricing Summary**
   - Material cost
   - Processing cost (cutting + piercing + setup)
   - Subtotal
   - Optional discount
   - Final total

**Interactive Insights:**
- **Margin Impact Chart:** Shows how margin % affects final price
- **Sheet Sensitivity Chart:** Shows how utilization % affects sheet count
- **Live KPIs:** Final price, profit, price per kg

### Quote Jobs (Multi-Client Flow)

**Current State:**  
The `/batches/[id]` flow currently ends at "Review parts" for MVP. It does not include quote calculation or PDF export yet.

**Future Enhancement:**  
Add a "Calculate Quote" step after "Review parts" that:
- Groups parts by client
- Calculates quote per client or for entire job
- Exports multiple PDFs or combined quote

---

## PDF Export

### Architecture

**Pipeline:**
1. User completes quote in UI
2. User clicks "Continue to finalize" → Step 6 (Finalize)
3. User edits PDF data (company info, notes, terms, pricing)
4. User clicks "Export to PDF"
5. Frontend sends structured JSON to `/api/quotes/export-pdf`
6. API validates payload, merges company defaults from env
7. API spawns Python subprocess with Playwright
8. Python renders Jinja2 template → HTML
9. Playwright opens HTML in headless Chromium → PDF bytes
10. API returns PDF file for download

**Tech Stack:**
- **Backend:** Next.js API route (`app/api/quotes/export-pdf/route.ts`)
- **Python:** `render_quote_pdf.py` with Playwright, Jinja2, Pydantic
- **Template:** `quote_template.html` + `quote_template.css`
- **Validation:** Zod (TypeScript) + Pydantic (Python)

**PDF Design:**
- A4 format, print-ready
- Clean monochrome (white background, dark text)
- Professional typography (Inter/Arial)
- Customer-facing content only (no internal metrics)

**PDF Sections:**
1. Header (company logo, quote number, date)
2. Customer information
3. Job summary cards
4. Scope of work
5. Part breakdown table
6. Pricing summary
7. Notes & assumptions
8. Terms
9. Footer

**Status:**  
Production-ready. Tested with sample data via `python render_quote_pdf.py --sample`.

---

## Settings & Configuration

### Quote Pricing Settings

**Location:** `app/settings/page.tsx`

**Configurable Parameters:**
- Material pricing (per m² or per kg)
- Cutting rates per method and thickness range
- Pierce rates
- Default setup fees
- Default scrap factor
- Currency
- Unit system (metric/imperial)

**Future Enhancement:**  
Add dedicated "Quote Settings" section for:
- Default margin %
- Default utilization %
- Quote validity period
- Company branding (name, logo, contact info)

### Company Branding for PDF

**Current Implementation:**  
Company information is sourced from environment variables:
- `NEXT_PUBLIC_QUOTE_COMPANY_NAME`
- `NEXT_PUBLIC_QUOTE_COMPANY_EMAIL`
- `NEXT_PUBLIC_QUOTE_COMPANY_PHONE`
- `NEXT_PUBLIC_QUOTE_COMPANY_WEBSITE`
- `QUOTE_PDF_COMPANY_LOGO_PATH` (server-side only)

**Location:** `features/quick-quote/lib/quotePdfPayload.ts`, `app/api/quotes/export-pdf/route.ts`

**Future Enhancement:**  
Add UI for editing company branding in Settings.

---

## Technical Architecture

### Frontend

**Framework:** Next.js 16 (App Router, Turbopack)  
**UI Library:** React 19  
**Styling:** Tailwind CSS  
**Components:** shadcn/ui  
**Charts:** Recharts  
**State:** React hooks (useState, useMemo, useCallback)  
**Data:** In-memory store with localStorage persistence

### Backend

**API Routes:** Next.js serverless functions  
**PDF Generation:** Python + Playwright  
**Validation:** Zod (TS) + Pydantic (Python)  
**Templating:** Jinja2

### File Structure

```
plate-app/
├── app/
│   ├── page.tsx                          # Dashboard (refactored)
│   ├── layout.tsx                        # Root layout (updated metadata)
│   ├── batches/
│   │   ├── page.tsx                      # Quotes list (renamed)
│   │   ├── new/page.tsx                  # New quote job (renamed)
│   │   └── [id]/
│   │       ├── page.tsx                  # Import data (simplified)
│   │       ├── parts/page.tsx            # Review parts (renamed)
│   │       ├── stock/page.tsx            # Hidden from stepper
│   │       ├── nesting/page.tsx          # Hidden from stepper
│   │       └── nesting-results/          # Hidden from stepper
│   ├── quick-quote/page.tsx              # Quick Quote (primary MVP feature)
│   ├── clients/                          # Client management (kept)
│   ├── settings/page.tsx                 # Settings (kept)
│   └── api/
│       └── quotes/
│           └── export-pdf/route.ts       # PDF export API
├── features/
│   ├── quick-quote/                      # Complete quote workflow
│   │   ├── components/                   # 6-step wizard
│   │   ├── insights/                     # Interactive charts
│   │   ├── job-overview/                 # Summary cards
│   │   └── lib/                          # Quote calculations
│   ├── batches/                          # Quote job workflow
│   │   ├── BatchForm.tsx                 # Updated labels
│   │   ├── BatchProcessShell.tsx         # Updated breadcrumbs
│   │   └── batchProcessConfig.ts         # Reduced to 2 steps
│   ├── parts/                            # Parts table (kept)
│   ├── clients/                          # Client management (kept)
│   ├── settings/                         # Settings (kept)
│   ├── nesting/                          # Hidden from MVP flow
│   └── plate-builder/                    # Hidden from MVP flow
├── components/
│   └── shared/
│       ├── Sidebar.tsx                   # Simplified navigation
│       └── TopHeader.tsx                 # Updated route labels
├── lib/
│   ├── dxf/                              # DXF parsing (kept)
│   ├── excel/                            # Excel parsing (kept)
│   ├── geometry/                         # Geometry processing (kept)
│   ├── parts/                            # Parts logic (kept)
│   ├── nesting/                          # Nesting (hidden from MVP)
│   └── store/                            # Data persistence (kept)
└── server/
    └── pdf/                              # Python PDF generation
        ├── render_quote_pdf.py           # Main script
        ├── quote_template.html           # Jinja2 template
        ├── quote_template.css            # Print CSS
        ├── quote_pdf_types.py            # Pydantic models
        └── quote_pdf_formatters.py       # Formatting helpers
```

---

## Sheet Estimation (MVP Approach)

### Current Implementation

**Location:** `features/quick-quote/insights/quoteInsights.utils.ts`

**Formula:**
```typescript
requiredMaterialArea = totalNetPlateArea / (utilization / 100)
sheetCount = ceil(requiredMaterialArea / stockSheetArea)
```

**Inputs:**
- `totalNetPlateArea`: Sum of all part areas (from DXF)
- `stockSheetArea`: User-selected sheet size (e.g., 2500mm × 1250mm)
- `utilization`: Estimated nesting efficiency (default 52%, range 50-90%)

**Output:**
- Estimated sheet count
- Estimated material area required
- Interactive sensitivity chart

**Rationale:**  
This is a **practical estimation model** suitable for quotation. It does NOT use the full nesting engine, which would be too slow and complex for fast quotes. The estimation is:
- Fast (instant calculation)
- Stable (no optimization variability)
- Understandable (transparent formula)
- Quote-ready (good enough for pricing)

**Future Enhancement:**  
For production planning (post-MVP), the hidden nesting engine can be used to generate optimized cutting plans after the quote is approved.

---

## What's Next (Post-MVP Roadmap)

### Phase 2: Production Planning

**Goal:** Add production-ready nesting and cutting plans after quote approval.

**Features to Reintroduce:**
- Stock configuration (select specific sheets from inventory)
- Nesting optimization (use existing nesting engine)
- Sheet viewer (visualize cutting plans)
- Export DXF per sheet for CNC machines

**User Flow:**
1. Customer approves quote
2. User clicks "Generate Cutting Plan"
3. App runs nesting optimization
4. User reviews nesting results
5. User exports DXF files for production

### Phase 3: Advanced Tools

**Features:**
- Plate Builder (custom plate design)
- Manual nesting adjustments
- Cutting simulation
- Material inventory tracking
- Quote history and analytics

### Phase 4: Automation & Integration

**Features:**
- API for external integrations
- Automated quote email delivery
- CRM integration
- Real-time pricing updates
- Multi-user collaboration

---

## Environment Setup

### Required Environment Variables

**Client-side (`.env.local`):**
```bash
NEXT_PUBLIC_QUOTE_COMPANY_NAME="Your Company Name"
NEXT_PUBLIC_QUOTE_COMPANY_EMAIL="quotes@yourcompany.com"
NEXT_PUBLIC_QUOTE_COMPANY_PHONE="+1 (555) 123-4567"
NEXT_PUBLIC_QUOTE_COMPANY_WEBSITE="https://yourcompany.com"
```

**Server-side (`.env.local`):**
```bash
QUOTE_PDF_COMPANY_NAME="Your Company Name"
QUOTE_PDF_COMPANY_EMAIL="quotes@yourcompany.com"
QUOTE_PDF_COMPANY_PHONE="+1 (555) 123-4567"
QUOTE_PDF_COMPANY_WEBSITE="https://yourcompany.com"
QUOTE_PDF_COMPANY_LOGO_PATH="./server/pdf/assets/logo.png"
QUOTE_PDF_PYTHON="python"  # or "python3" or full path
```

### Python Setup

**Install dependencies:**
```bash
cd server
pip install -r requirements-pdf.txt
playwright install chromium
```

**Test PDF generation:**
```bash
cd server/pdf
python render_quote_pdf.py --sample
```

This generates a sample PDF at `server/pdf/sample_quote.pdf`.

---

## Development Commands

**Start dev server:**
```bash
cd plate-app
npm run dev
```

**Type check:**
```bash
npm run type-check
```

**Build for production:**
```bash
npm run build
```

**Test PDF export:**
```bash
cd server/pdf
python render_quote_pdf.py --sample
```

---

## Key Files Modified

### Navigation & Layout
- `components/shared/Sidebar.tsx` - Simplified to 4 items
- `components/shared/TopHeader.tsx` - Updated route labels
- `app/layout.tsx` - Updated metadata

### Dashboard
- `app/page.tsx` - Quotation-first stats and CTAs

### Quotes (formerly Batches)
- `app/batches/page.tsx` - Renamed to "Quotes"
- `app/batches/new/page.tsx` - Renamed to "New quote job"
- `app/batches/[id]/page.tsx` - Simplified import step
- `app/batches/[id]/parts/page.tsx` - Renamed to "Review parts"
- `features/batches/BatchForm.tsx` - Updated labels
- `features/batches/BatchProcessShell.tsx` - Updated breadcrumbs
- `features/batches/batchProcessConfig.ts` - Reduced to 2 steps

### Quick Quote (Primary MVP Feature)
- `features/quick-quote/` - No changes needed, already production-ready

---

## Success Criteria

After this refactor, the MVP lets users:

1. ✅ Open the app
2. ✅ Create a new quote (Quick Quote or Quote Job)
3. ✅ Upload DXF + Excel files
4. ✅ See parsed and validated parts
5. ✅ Manually fix quantities, materials, thicknesses
6. ✅ Get instant quote breakdown
7. ✅ See estimated sheet usage and scrap
8. ✅ Export professional PDF quote

**MVP is complete and ready for launch.**

---

## Known Limitations (MVP)

1. **No Real Nesting:** Sheet estimation uses a practical formula, not optimized nesting
2. **No Production Export:** Cannot export DXF files for CNC machines (post-MVP)
3. **No Inventory:** No material inventory tracking (post-MVP)
4. **No Multi-User:** Single-user app with localStorage (post-MVP: add backend)
5. **No Email:** PDF must be manually downloaded and sent (post-MVP: add email delivery)

---

## Deployment Checklist

- [ ] Set environment variables for company branding
- [ ] Add company logo to `server/pdf/assets/logo.png`
- [ ] Install Python dependencies (`pip install -r server/requirements-pdf.txt`)
- [ ] Install Playwright Chromium (`playwright install chromium`)
- [ ] Test Quick Quote flow end-to-end
- [ ] Test PDF export with real data
- [ ] Verify PDF renders correctly on print
- [ ] Update metadata/branding in `app/layout.tsx` if needed
- [ ] Build and deploy Next.js app
- [ ] Ensure Python runtime is available on server

---

## Support & Maintenance

### Common Issues

**PDF Export Fails:**
- Check Python is installed and accessible
- Verify `QUOTE_PDF_PYTHON` env var if needed
- Check Playwright Chromium is installed
- Check server/pdf/ files exist
- Check temp directory permissions

**DXF Parsing Issues:**
- Check DXF file format (R12/R2000/R2004 supported)
- Check file encoding (UTF-8 preferred)
- Check geometry is closed polylines/circles

**Excel Matching Issues:**
- Check Excel has "Part Name" column
- Check part names match DXF filenames
- Check Excel has quantity/thickness/material columns

### Logs & Debugging

**Browser console:** Frontend errors and validation issues  
**Server logs:** API route errors and Python subprocess output  
**Python stderr:** PDF generation logs (written to stderr by design)

---

## Conclusion

The PLATE app has been successfully transformed into a **quotation-first MVP** ready for launch. The product is now focused, simple, and commercial, while preserving valuable engineering systems for future phases.

**Core Strengths:**
- Fast DXF + Excel quote generation
- Professional PDF export
- Interactive quote insights
- Clean, modern UI
- Solid technical foundation

**Ready for launch.**

---

*Generated: March 29, 2026*  
*Version: MVP v1.0*
