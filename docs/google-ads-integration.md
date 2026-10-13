# Google Ads integration

## Delivered scope

Google Ads REST v25, per-project encrypted OAuth credentials, account verification, campaign listing and explicit-period metrics for campaigns, ad groups (stored as `adset` for compatibility), and ads. Costs are converted from micros into account currency; attributed conversions retain fractional values. Missing values are omitted. Reports are reviewed before saving and never sum parent and child resources.

First creation flow: saved experiment → server validation → Google `validateOnly` → review → human confirmation → one atomic `GoogleAdsService.Mutate` → campaign, group and two responsive Search ads PAUSED → private receipt and linked external IDs → manual activation in Google Ads. Keywords are enabled under paused parents. The app never enables a campaign, changes billing, or activates ads.

Search uses Maximize Clicks (`targetSpend`) with an explicitly confirmed CPC ceiling, Google Search only (no partner/display expansion), country presence targeting, selected languages, phrase/exact keywords and two RSA variants. RSA content uses newline-separated headlines/descriptions. Google optimizes rotation; this is **not** a randomized 50/50 experiment. Native Google Experiment arms, conversion-optimized bidding and Display/App/Performance Max creation are outside this first implementation. Existing campaigns of those types can be linked and monitored. Search does not upload the experiment's private images/videos as ad assets.

## Account setup remaining

The browser confirmed **Green Hunt**, customer ID **4266261664**, under greenriot4@gmail.com. IDs in navigation URLs such as `ocid` are not customer IDs. No OAuth credentials were saved during initial inspection. A Google Cloud project must be selected, Google Ads API enabled, OAuth configured and authorized for the Ads user. New OAuth access/terms require the user's action-time approval. No billing account or paid service is needed for the API itself.

Current Google documentation says developer tokens were sunset on 2026-09-09. Access belongs to the Cloud project owning the OAuth client. Real customer accounts require Explorer or higher access; default Test access cannot query this account. This implementation deliberately omits the developer-token header and removed the obsolete developer-token field from Integrations. API approval and consent are external prerequisites, not something a Vercel deployment can grant.

Configure **Integraciones → Google Ads → project**:

- Customer ID, optional manager login customer ID only if using an MCC.
- OAuth client ID, client secret, refresh token for scope `https://www.googleapis.com/auth/adwords`.
- Use **Comprobar conexión**. This renews the short-lived token on the server and verifies the exact configured customer, currency and timezone. Tokens/errors are never echoed to the client. An OAuth app in Testing can issue refresh tokens expiring after seven days; production consent/verification requirements must be checked before external customer onboarding.

Google's Ads OAuth scope permits account management; the app's own role checks restrict configuration to owners and preparation to experiment editors. It has no endpoint to activate campaigns. A browser login alone does not authorize an independent server integration.

## Database and duplicate protection

Migration `20261012192454_google_ads_preparation.sql` adds private project/team-scoped creation receipts and narrow RPCs. Writes are reserved before the external call. Pending/uncertain writes block all further creation for that experiment; explicit Google rejections can be retried. Success and all four links are recorded together. A successful external response followed by database failure returns the IDs and forbids automatic retry. Client disconnection or server termination leaves a pending receipt requiring manual reconciliation in Google Ads. There is deliberately no automatic recovery button that might create duplicates.

Validation fingerprint binds record revision, account, connection revision and the exact Google batch. Changes invalidate approval. No privileged Supabase service-role client is used by the routes. Migrations must be applied and verified separately from code deployment.

## Verification

Tests cover OAuth transport/redaction, pagination loops, Cloud production-access errors, account/resource mismatch, fractional conversions/currency units, Search asset limits, declarations, dates, paused atomic payload, v25 date fields, foreign result IDs and ambiguous writes. Full migration-chain tests cover RLS, unauthorized users, receipt immutability, rejected retries, uncertain blocks and linked variant ownership. Live end-to-end creation remains unverified until OAuth and Google Cloud approval are configured.

## Official references

- [Current access and developer-token sunset](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
- [OAuth](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [REST authentication](https://developers.google.com/google-ads/api/rest/auth)
- [Search and pagination](https://developers.google.com/google-ads/api/rest/common/search)
- [Responsive Search requirements](https://developers.google.com/google-ads/api/docs/responsive-search-ads/create-responsive-search-ads)
- [Atomic bulk mutation](https://developers.google.com/google-ads/api/docs/mutating/bulk-mutate)
- [Validation-only requests](https://developers.google.com/google-ads/api/reference/rpc/v25/MutateGoogleAdsRequest)
- [v25 campaign dates and political declaration](https://developers.google.com/google-ads/api/reference/rpc/v25/Campaign)
- [Languages](https://developers.google.com/google-ads/api/data/codes-formats)
