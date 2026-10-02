# Product direction and open customer questions

Source review: 3 October 2026. This is an internal product hypothesis, not a competitive superiority or customer adoption claim.

## What exists

- [OpenSpace Track](https://www.openspace.ai/products/progress-tracking/) describes image-based progress tracking with AI and human review, schedule integration and reporting. Its own page explicitly says BIM is optional. “No BIM required” alone is therefore not a defensible differentiation claim.
- [Buildots](https://buildots.com/) describes construction intelligence spanning plan comparison, progress reporting, payment applications and portfolio context. Those are vendor descriptions, not independently validated performance results. We do not reproduce its savings claims or claim it lacks document workflows.
- [iVISION research](https://www.iaarc.org/publications/csce_crc_2025/elevating_construction_progress_monitoring-a_comprehensive_uav_based_system_for_long_term_outdoor_construction_site_mapping.html) and [ChronoFuseGS/NWM](https://researchdata.tuwien.at/records/bphp1-hbb20) provide research evidence for longitudinal site records and temporal reconstruction. A research dataset is not evidence of an operational billing product.

SiteCommit's current, testable emphasis is a small evidence-to-paperwork loop: manual stage review; transparent plan dates; source-linked quantity inputs; before-covering retrieval; editable diary, QA and M-book-style drafts; portable offline evidence packages. This build implements local browser persistence and static export, not automated classification, live schedule integration or multi-user approval. Usefulness and willingness to pay still need customer validation.

## India-specific questions to validate with engineers and customers

1. Which BOQ item structure, measurement convention, rounding, deductions and M-book format does each customer actually use? What varies by contract, authority and state? Do not bake an assumed measurement rule into a bill.
2. Who enters, checks and signs each measurement? What source drawing revision and site verification evidence are accepted? What makes an electronic draft admissible in their existing process?
3. Can before-covering records reduce a real retrieval task? What location vocabulary (floor/grid/room/chainage/element) do engineers already use?
4. Which work stages can a remote reviewer reliably distinguish in local lighting, clutter and occlusion? How much repeated capture and manual review effort is acceptable?
5. What does “98–99% confidence” mean for a consequential quantity: tolerance, unit, coverage, false acceptance rate, confidence interval, or approval threshold? Establish a ground-truth protocol and independent checks before quoting a figure.
6. Are English and the present units sufficient? Which languages, drawing sizes, intermittent connectivity and phone hardware matter in actual use?
7. Which CSV/report handoff is accepted today, and who would pay for it? Is time saved in documentation, certification preparation or dispute retrieval measurable against a baseline?
8. What consent, retention, access and worker privacy rules apply to captures? Never identify workers or infer individual performance from imagery.

## Extensible acquisition path

The evidence catalog separates project ID, dated source asset, attribution, dimensions and interpretation limits. A future phone/360/drone/TLS or CCTV-frame adapter can emit that same record shape, preserving timestamps and explicit gaps. A continuous feed would additionally need validated clocking, coverage, retention and permissions. None is connected here; Montijo is a static public frame collection. Resource costs are explicit entered values, not inferred workforce counts or contractor productivity.

Production priorities after a field trial: authenticated shared storage, revision/audit history, drawing revisions, review permissions, explicit approval identities, robust offline synchronization, backup limits, capture calibration and per-item measurement validation. Local editable author fields are not secure signatures.
