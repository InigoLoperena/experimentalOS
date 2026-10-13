# Smartlead integration

## Supported flow

Select Smartlead as the principal channel. Prepare exactly two variants, with subject in `headline`, body in `body` and equal allocation of 50/50. The AI proposes the first email, using the project's existing context and asking for missing audience, offer, language and call to action. Save the experiment before reviewing the external draft.

Integrations stores the existing API key encrypted for the selected team/project; only the team administrator can change it. Checking the connection lists accessible campaigns, without loading recipient lists or mailbox credentials.

Review checks authentication and local configuration, not deliverability. On explicit confirmation, creation reserves a durable receipt, creates a DRAFTED campaign and immediately saves its ID/link before adding one sequence with A/B variants. A subsequent read checks the draft status and both saved subjects/bodies. No activation endpoint, recipient upload, sender assignment, deletion or email sending is exposed. Complete those steps manually in Smartlead.

If the provider's response is uncertain, retries are blocked. A confirmed campaign ID remains visible even if sequence preparation fails. Inspect that draft instead of creating a duplicate. A later recovery feature can reconcile pending receipts; no blind retries are implemented.

Existing campaigns can be listed, linked to an experiment and queried by date. Results are imported only after review through the existing scoped monitoring flow. The initial report is campaign-level, not variant-level: never attribute combined results to A/B variants individually. Variant analytics, follow-ups, schedules and automatic synchronization are later extensions.

## API contracts checked on 2026-10-12

- [Authentication and full reference](https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation): API access depends on the subscription; key is a query parameter, kept server-side and never logged.
- [Create](https://api.smartlead.ai/api-reference/campaigns/create): POST `/campaigns/create`, direct `ok`, `id`; initial DRAFTED status.
- [Update sequences](https://api.smartlead.ai/api-reference/campaigns/update-sequences): POST `/campaigns/{id}/sequences`. The current reference and help center show conflicting payloads; the A/B-specific help-center contract uses a direct array with `variants` and `variant_distribution_type:MANUALLY_EQUAL`.
- [A/B sequence concept](https://api.smartlead.ai/core/sequences): The conceptual guide uses different names from the full A/B reference. We use `variant_label`, subject and safely escaped HTML body, with equal distribution, and require read-back verification; a successful HTTP response alone is insufficient.
- [Read sequences](https://api.smartlead.ai/api-reference/campaigns/get-sequences): `data` array, `sequence_variants` with subjects and bodies.
- [Campaign performance](https://api.smartlead.ai/api-reference/analytics/campaign-performance): `/analytics/campaign/overall-stats`, explicit dates, campaign filter and UTC timezone; `data.campaign_wise_performance`. Report sent, opened, replied, bounced and distinct leads/opens only when present. Attribution is to emails sent within the inclusive period. Unique counts cannot be added across periods. No fabricated missing zeros or rates.

Use V1 only, fixed provider origin, no redirects, request deadlines and sanitized errors. No retry of writes. On 429, the UI asks the user to wait. No paid upgrade is performed.

## Verification

Transport, authentication redaction, scoped response rejection, missing metrics, uncertain writes and read-back checks have automated tests. The migration-chain test checks RLS, outsider rejection, duplicate protection, immutable confirmed campaign IDs and checkpoint/finalization idempotency. A successful live connection and actual draft must be verified separately; tests with simulated provider responses do not establish live API compatibility.
