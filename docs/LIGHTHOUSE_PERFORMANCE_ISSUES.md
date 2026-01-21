# Lighthouse Performance Issues - January 2026

## Executive Summary

Bundle analysis revealed several critical performance issues affecting initial page load time. The total JavaScript bundle size before optimization is approximately **2.5MB** (gzipped: ~750KB).

## Critical Issues Identified

### 1. Schema Bundle Too Large (CRITICAL)

- **File**: `schema-n6xRbEN_.js`
- **Size**: 467.83 KB (gzipped: 91.17 KB)
- **Issue**: The entire database schema (`shared/schema.ts` - 8,595 lines) is being bundled for client use
- **Root Cause**: Client components import from `@shared/schema` for type validation, but this pulls in the entire Drizzle ORM database definitions
- **Impact**: ~470KB of unnecessary JavaScript loaded on every page
- **Fix**: Create lightweight client-side validation schemas separate from database schemas

### 2. Main Index Bundle Too Large (HIGH)

- **File**: `index-CK6_A_i1.js`
- **Size**: 425.10 KB (gzipped: 109.49 KB)
- **Issue**: Main entry point contains too much code that should be lazy-loaded
- **Root Cause**: Static imports of components that should be dynamically imported
- **Impact**: Blocks initial render while loading unnecessary code
- **Fix**: Move more imports to dynamic imports, split shared components

### 3. Charts Vendor Bundle (MEDIUM)

- **File**: `vendor-charts-Bhtc7R76.js`
- **Size**: 433.71 KB (gzipped: 114.61 KB)
- **Issue**: Recharts library is loaded entirely
- **Root Cause**: Recharts doesn't support tree-shaking well
- **Impact**: Large download for pages that don't use charts
- **Fix**: Charts are already lazy-loaded per page; consider lighter alternatives for simple charts

### 4. MobileFieldService Page Too Large (HIGH)

- **File**: `MobileFieldService-rtB1dg1m.js`
- **Size**: 240.61 KB (gzipped: 76.03 KB)
- **Issue**: Single page component is extremely large
- **Root Cause**: Page likely imports large dependencies or has embedded components
- **Impact**: Slow load time for mobile field service users
- **Fix**: Code-split the page into smaller lazy-loaded sections

### 5. Static Import Warning (LOW)

- **File**: `client/src/App.tsx`
- **Line**: 5
- **Issue**: `LogoExport` is both statically and dynamically imported
- **Warning**: "LogoExport.tsx is dynamically imported by App.tsx but also statically imported by App.tsx"
- **Fix**: Remove the static import, keep only the lazy import

### 6. Animation Library (MEDIUM)

- **File**: `vendor-animation-C0tzNsfL.js`
- **Size**: 119.37 KB (gzipped: 39.65 KB)
- **Issue**: Framer Motion is a large animation library
- **Root Cause**: Full library bundled even for simple animations
- **Fix**: Consider using CSS animations where possible, or lazy-load framer-motion

### 7. Customer Portal Schema (MEDIUM)

- **File**: `customer-portal-schema-zn67R9RJ.js`
- **Size**: 66.97 KB (gzipped: 17.68 KB)
- **Issue**: Separate schema bundle for customer portal
- **Fix**: Should be merged with optimized validation schemas

## Performance Metrics Estimates

### Before Optimization

- Total JS: ~2.5MB (uncompressed), ~750KB (gzipped)
- First Contentful Paint: Estimated 3-5 seconds on 3G
- Time to Interactive: Estimated 5-8 seconds on 3G

### Target After Optimization

- Reduce initial bundle by ~500KB (removing schema from client)
- First Contentful Paint: Target < 2 seconds on 3G
- Time to Interactive: Target < 4 seconds on 3G

## Fixes Implemented

### Phase 1: Quick Wins (COMPLETED)

- [x] Remove static LogoExport import (App.tsx line 5)
- [x] Convert LogoExport to lazy-loaded component
- [x] Remove unused `lazy` import from React imports
- [x] Analyze schema usage in client code (37+ files import from @shared/schema)
- [x] Document MobileFieldService large bundle root cause (Uppy file upload library)

**Result**: Index bundle reduced from 425.10 KB to 424.02 KB. Build warning eliminated.

### Phase 2: Schema Optimization (FUTURE - High Impact)

The schema bundle (467.83 KB) is the largest single bundle. Root cause:

- 37+ client files import types and Zod schemas from `@shared/schema`
- This pulls in the entire 8,595-line database schema file
- Solution requires creating lightweight client-side validation schemas

Steps required:

- [ ] Create `shared/client-validation-schemas.ts` with only Zod schemas needed by client
- [ ] Export only type definitions (not table definitions) for client use
- [ ] Update 37+ client imports to use lightweight validation file
- [ ] Keep database schemas server-side only

Estimated reduction: ~400KB from client bundles

### Phase 3: Code Splitting Improvements (FUTURE - Medium Impact)

- [ ] Lazy-load ObjectUploader in MobileFieldService (reduces Uppy bundle load)
- [ ] Split large pages (CustomerDetail, LeadDetail) into lazy-loaded tabs
- [ ] Consider lighter chart alternatives for simple visualizations
- [ ] Implement route-based prefetching for critical paths

### Phase 4: Vendor Optimization (FUTURE - Low-Medium Impact)

- [ ] Evaluate Framer Motion usage - consider CSS animations for simple cases
- [ ] Consider partial Recharts imports if tree-shaking improves
- [ ] Review react-icons usage - may be including unused icon sets

## Files Modified

| File                 | Change                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `client/src/App.tsx` | Removed static LogoExport import, added lazy-loaded version, removed unused `lazy` import |

## Bundle Size Comparison

| Bundle         | Before    | After     | Change                         |
| -------------- | --------- | --------- | ------------------------------ |
| index.js       | 425.10 KB | 424.02 KB | -1.08 KB                       |
| schema.js      | 467.83 KB | 467.83 KB | (unchanged - requires Phase 2) |
| Total warnings | 1         | 0         | -1                             |

## Verification Steps

1. Run `npm run build` and check bundle sizes ✅
2. Verify no build warnings ✅
3. Compare before/after bundle analysis ✅
4. Test on simulated 3G connection (manual test recommended)
5. Verify no functionality regressions (manual test recommended)

## Priority Recommendations

1. **Phase 2 (Schema Optimization)** - Highest impact, reduces ~400KB
2. **Phase 3 (ObjectUploader lazy-load)** - Medium impact for mobile users
3. **Phase 4 (Vendor optimization)** - Lower priority, diminishing returns
