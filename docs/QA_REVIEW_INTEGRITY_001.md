# WIS-REV-INTEGRITY-001 · independent QA

Date: 2026-10-23. Reviewer: qa-ops (`qa_ops_review_integrity_001`). Result: PASS for the local code candidate, not production readiness or deployment approval.

Owner and independent reviewer each ran `rtk npm test` from `command-center`: 27/27 PASS. `rtk npm run check` and `rtk git diff --check` also passed. Tests use synthetic records and simulated network calls; no real delivery, Sheet mutation or credentials are needed. This is the candidate's targeted suite, not a claim that the older checkout's broader suite ran against this layout.

The reviewer independently compared nine normalization variants with the pre-existing `wis.review-evidence.v1` contract: preimages and SHA-256 digests matched. Camel/snake field names, strict booleans, count strings, trim and Unicode are covered. Invalid terminal evidence is rejected before contacting Sheets. Docker's explicit COPY includes the runtime module and Node provides `node:crypto`; a container image was not built.

Initial QA found a pre-existing selection defect: lexicographic timestamps could retain VERIFIED evidence ahead of a later PENDING record with a different timezone, and equal timestamps retained the earlier physical row. The owner fixed chronological comparison and later-row tie breaking. Re-QA reproduced both cases and confirmed selection of PENDING with `verified=false` and `supportsProblemAnalysis=false`. Unparseable dates conservatively block until resolved.

No open findings remain in the reviewed diff. The digest only verifies metadata consistency. It does not authenticate a reviewer or prove review text, visit or semantic analysis. The 36 quarantined historical records remain PENDING with original hashes/counts retained. Investigation and independent QA are required before restoring any of them. This candidate does not authorize rewriting historical hashes, deploying, enabling outbound or sending seeds.
