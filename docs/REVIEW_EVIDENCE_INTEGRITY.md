# Review evidence integrity

The runtime in `command-center/review-evidence.mjs` reproduces SHA-256 rather than accepting a token because it looks like a hash. The UTF-8 preimage is:

```json
["wis.review-evidence.v1","prospect_key","maps_url",true,true,true,12,12,"checked_at","reviewer"]
```

Fields are ordered exactly as shown. Required strings are trimmed; counts are nonnegative integers; traversal flags accept booleans or Sheets TRUE/FALSE strings. Snake-case Sheet fields and camelCase API fields map to the same representation. Only 64-character hexadecimal SHA-256 is accepted (case-insensitive). Missing identity, malformed input or a mismatch fail closed.

A matching hash proves only consistency of these metadata fields. It is not a signature, does not authenticate the reviewer, does not hash the text of reviews, and does not prove that the visit or semantic analysis was correct. Company name, source row, status, blocker and message copy are not part of this v1 preimage. Direct Maps evidence and independent QA remain separate requirements.

The read path surfaces `hashVerified` and blocks `verified` / `supportsProblemAnalysis` on a mismatch. Records are compared chronologically with timezone offsets respected, and the later physical Sheet row wins equal-time ties. An unparseable timestamp blocks that prospect until the ambiguous record is resolved, regardless of physical order; it is not discarded to revive a VERIFIED record. A newer bad record does not fall back to an older successful record. PENDING records never support problem copy. VERIFIED_NO_LOW_REVIEWS requires a valid traversal and its own digest, but cannot support problem-based copy.

The write path validates terminal records before contacting Sheets, creating a tab, or changing formatting. Pending records may still be persisted to document a blocked investigation.

## Incident and rollout

On 2026-10-23, 135 live metadata records were compared with the contract: 99 matched and 36 did not. The latter were changed to PENDING with their original hashes and counts retained. This does not establish that their reviews were false; historical serialization and source provenance must be investigated. Never replace an old digest merely to make a verifier pass. Record the cause, preserve the original and obtain independent QA before restoring VERIFIED.

This candidate does not deploy, change outbound flags, send messages, modify credentials or repair production hashes. Deployment requires a separate exact approval. Run `rtk npm test` and `rtk npm run check` from `command-center`; all tests use synthetic inputs and stubbed network calls.
