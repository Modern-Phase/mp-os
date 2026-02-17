# RAG System Breakpoints and Fixes

## Test Results Summary

**Overall: 15/16 tests passed (93.75%)**

| Category | Tests | Passed | Notes |
|----------|-------|--------|-------|
| Part Number Lookups | 3 | 3 | Found results but no exact matches via vector search |
| Misspellings | 3 | 2 | "handelbars" failed (score 0.382) |
| Vague Queries | 3 | 3 | All returned relevant results |
| Multi-part Questions | 2 | 2 | Complex queries handled well |
| Non-existent Items | 2 | 2 | Low scores indicate proper handling |
| Edge Cases | 3 | 3 | Empty, single char, special chars handled |

---

## Critical Breakpoints Found

### 1. Misspelling Handling (SEVERITY: MEDIUM)

**Issue**: Some common misspellings don't retrieve relevant results.

**Example**:
- Query: "handelbars"
- Expected: Find handlebar products
- Result: Score 0.382 (below threshold) - FAILED

**Root Cause**: OpenAI embeddings don't always handle typos well since they're trained on correctly spelled text.

**Proposed Fixes**:
1. **Pre-query spell correction**: Use a library like `typo-js` or a simple Levenshtein distance check against common product terms
2. **Synonym expansion**: Map common misspellings to correct terms before embedding
3. **Lowered threshold for fuzzy matching**: Accept lower scores (0.35+) but add a "did you mean?" suggestion

**Implementation Location**: `convex/rag.ts` - add pre-processing step before `generateEmbedding()`

---

### 2. Part Number Exact Lookup (SEVERITY: HIGH)

**Issue**: Part numbers like "0801-1147" don't trigger exact database lookup when using pure vector search. The hybrid search's `isPartNumberQuery()` pattern detection is too strict.

**Current Pattern** (`convex/rag.ts:376-384`):
```typescript
const partNumberPatterns = [
  /^[A-Z0-9]{2,}-[A-Z0-9]{2,}(-[A-Z0-9]+)?$/i,  // XX-XXXX format
  /^\d{4,5}-\d{2,4}[A-Z]?$/i,                    // XXXXX-XX format
];
```

**Missing Patterns**:
- Natural language with part number: "find part 0801-1147"
- OEM numbers: "HD part number 12345678"
- Partial numbers: "parts starting with 0801"

**Proposed Fixes**:
1. **Extract part numbers from query**: Use regex to find embedded part numbers
2. **Add partial match support**: Allow prefix/suffix matching on part numbers
3. **Always run dual search**: Run both exact lookup AND vector search, merge results

**Implementation**:
```typescript
// Extract part numbers from anywhere in the query
function extractPartNumbers(query: string): string[] {
  const patterns = [
    /\b[A-Z0-9]{2,4}-[A-Z0-9]{2,6}\b/gi,
    /\b\d{4,5}-\d{2,4}[A-Z]?\b/gi,
  ];
  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = query.match(pattern);
    if (found) matches.push(...found);
  }
  return [...new Set(matches)];
}
```

---

### 3. Score Threshold Tuning (SEVERITY: LOW)

**Issue**: Current implicit threshold accepts results with scores 0.4-0.5, which may include false positives.

**Observations**:
- Good matches: 0.55+ scores
- Borderline: 0.45-0.55 scores
- Poor/false positive: <0.45 scores

**Proposed Fix**: Add dynamic thresholds based on query type:
```typescript
const SCORE_THRESHOLDS = {
  part_number_exact: 0.7,  // Exact match should be high
  semantic_search: 0.5,    // General queries
  fuzzy_match: 0.4,        // Typos/misspellings
};
```

---

### 4. Duplicate Results Across Pages (SEVERITY: LOW)

**Issue**: Same content appears on multiple pages (e.g., page 1 and page 267), causing duplicate results.

**Example from test results**:
```
"seats" query returned:
- Page 1: "XL Seats - Part #: 0801-1147..."
- Page 267: "XL Seats - Part #: 0801-1147..." (identical)
```

**Root Cause**: PDF extraction created duplicate chunks for repeated content sections.

**Proposed Fixes**:
1. **Content deduplication during chunking**: Hash chunk content, skip if already seen
2. **Result deduplication by content similarity**: Compare content before returning

---

## Recommended Improvements Priority

### High Priority
1. Fix part number extraction to work with embedded numbers in queries
2. Add pre-query spell correction for common motorcycle terms

### Medium Priority
3. Implement dynamic score thresholds
4. Add content deduplication in chunking pipeline

### Low Priority
5. Add "did you mean?" suggestions for low-confidence results
6. Implement query expansion for synonyms (e.g., "muffler" = "exhaust")

---

## Testing Commands

```bash
# Run full edge case test suite
npx convex run ragTest:runEdgeCaseTests '{"collectionId": "kn77ebgaf13h1pfyna29ab791n80jzh4", "userId": "k574ca3tz5atvf1p9jpt7s9vjx806rjw"}'

# Test single query
npx convex run ragTest:testSingleQuery '{"query": "YOUR_QUERY", "collectionId": "kn77ebgaf13h1pfyna29ab791n80jzh4", "userId": "k574ca3tz5atvf1p9jpt7s9vjx806rjw"}'
```

---

## Files to Modify

| File | Change |
|------|--------|
| `convex/rag.ts` | Add spell correction, improve part number extraction |
| `convex/ragLarge.ts` | Add content deduplication during chunking |
| `convex/http.ts` | Add confidence scoring to chat responses |
