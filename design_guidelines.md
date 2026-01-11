# Sports Betting Analytics Platform - Design Guidelines

## Design Approach

**System**: Material Design + Modern Analytics Dashboard Patterns (Linear, Notion-style)  
**Rationale**: Information-dense application requiring clarity, efficiency, and professional data presentation. Utility and performance are paramount over aesthetic flourish.

**Core Principles**:
- Data clarity above all - every element serves the analysis workflow
- Scannable information hierarchy for rapid opportunity identification  
- Consistent patterns for quick learning and efficient daily use
- Dense but breathable layouts - maximize information without overwhelming

---

## Typography System

**Font Stack**: 
- Primary: Inter or IBM Plex Sans (CDN)
- Monospace (for numbers/data): JetBrains Mono or Roboto Mono

**Hierarchy**:
- **Page Headers**: 2xl/3xl, semibold - sport/section identifiers
- **Section Headers**: xl, semibold - "Today's Opportunities", "Backtesting Results"
- **Subsection/Card Headers**: lg, medium - team matchups, algorithm names
- **Body/Labels**: base, regular - descriptive text, field labels
- **Data Values**: base/lg, medium/semibold with monospace - all numerical data (percentages, odds, projections)
- **Small Data/Metadata**: sm, regular - timestamps, data source notes

**Key Pattern**: All numerical values use monospace for alignment and scannability. Labels use sans-serif.

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8** for consistency
- Component padding: p-4 or p-6
- Section spacing: my-8 or my-6
- Card gaps: gap-4 or gap-6
- Dense data rows: py-2

**Grid Structure**:
- **Main Layout**: Sidebar navigation (fixed width ~240px) + Main content area (fluid)
- **Content Grid**: 12-column CSS Grid for dashboard widgets
- **Responsive**: Single column mobile, 2-col tablet, 3-4 col desktop for opportunity cards

**Container Strategy**:
- Max-width: max-w-screen-2xl for main content (analytics need breathing room)
- Full-width tables with horizontal scroll on mobile
- Sticky headers for data tables and filter bars

---

## Component Library

### Navigation
- **Sidebar**: Fixed left navigation with sport icons, data source toggles, settings
- **Top Bar**: Current sport selector, date/time range picker, refresh status indicator
- **Breadcrumbs**: For deep navigation (Sport > Game > Detailed Analysis)

### Data Display

**Opportunity Cards**:
- Card layout with header (matchup, time), body (key metrics in 2-3 column grid), footer (play recommendation)
- Use table-like alignment for metric labels and values
- Confidence indicator (High/Medium/Lean) prominently displayed
- Edge percentage and volatility score (V-score) badges

**Data Tables**:
- Striped rows for scannability
- Sortable columns (all numerical columns)
- Fixed header on scroll
- Compact row height (py-2) with adequate cell padding (px-4)
- Monospace alignment for all numbers
- Right-align numerical columns

**Projection Tables** (per Jobu algorithms):
- Two-column comparison layout (Away vs Home)
- Metric name in left column, values in subsequent columns
- Highlight rows for key differentials
- Summary section below with derived metrics

**Charts**:
- Line charts for line movement over time
- Bar charts for percentage comparisons (ticket % vs money %)
- Sparklines in table cells for historical trends
- Use Recharts with minimal styling - focus on data clarity

### Forms & Inputs

**File Upload**:
- Dropzone area with drag-and-drop
- Clear file type indicators (Excel icons)
- Upload status with progress bars

**Filters**:
- Horizontal filter bar with chip/tag-style selections
- Date range picker
- Multi-select dropdowns for sports, data sources
- "Apply Filters" and "Clear All" actions

**Algorithm Configuration**:
- Organized in collapsible sections by sport
- Input fields with labels above
- Inline validation and format hints
- "Save" and "Reset to Defaults" buttons

### Status & Feedback

**Loading States**:
- Skeleton screens for data tables and cards during refresh
- Spinner for page-level loading
- Inline spinners for individual card refreshes

**Data Freshness Indicators**:
- Timestamp badges showing "Updated 2m ago" or "Refreshing..."
- Visual indicator when data is stale (>30 minutes old)

**Alert Banners**:
- Prominent banner at top for login status, scraping errors, or critical messages
- Dismissible with clear action buttons

---

## Page Layouts

### Dashboard (Main View)
- **Top**: Sport selector tabs + filter bar
- **Main**: 3-4 column grid of opportunity cards
- **Sidebar**: Quick stats summary, recent activity log
- **Bottom**: No pagination - infinite scroll or "Load More" for older games

### Game Detail View
- **Header**: Matchup details, current odds from multiple books
- **Body**: Two-panel layout
  - Left: Projection table (comprehensive team stats comparison)
  - Right: Line movement chart, RLM indicators, handle analysis
- **Footer**: Play recommendation card with confidence breakdown and drivers

### Backtesting View
- **Top**: Filter controls (date range, sport, RLM thresholds)
- **Main**: Results table showing historical signals and outcomes
- **Summary**: Aggregate performance metrics in card grid above table

### Data Sources Management
- **Cards Layout**: One card per source (Action Network, TeamRankings, KenPom)
- **Card Content**: Login status, last refresh time, "Refresh Now" button, error logs
- **Upload Section**: Excel file upload interface with preview of parsed data

---

## Spacing & Density

**Dashboard Philosophy**: Dense but organized - users want maximum information per screen without scroll fatigue

**Vertical Rhythm**:
- Page sections: mb-8
- Card grids: gap-6
- Within cards: p-6 with internal spacing of space-y-4
- Table rows: py-2 (compact for data density)

**Horizontal Spacing**:
- Sidebar to content: gap-6
- Between adjacent data columns: gap-4
- Table cell padding: px-4

---

## Responsive Behavior

**Breakpoints**:
- Mobile (<768px): Single column, collapsible sidebar, simplified tables
- Tablet (768-1024px): 2-column grids, partial sidebar visibility
- Desktop (>1024px): Full 3-4 column layout, persistent sidebar

**Mobile Adaptations**:
- Horizontal scroll for wide data tables
- Collapsible metric sections in opportunity cards
- Bottom navigation bar for sport switching
- Simplified projection tables (show top 5 metrics only, "View Full" expansion)

---

## Animations

**Minimal Use**:
- Smooth transitions on data refresh (fade-in new values)
- Subtle hover states on interactive elements
- No scroll-triggered or decorative animations
- Page transitions: simple fade, no complex motion

---

## Images

**No Hero Images**: This is a functional dashboard, not a marketing site  
**Icon Usage**: Heroicons (via CDN) for UI elements, sport icons, and status indicators  
**Charts Only**: All visual content is data-driven charts and graphs