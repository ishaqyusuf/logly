# ADR 0007: Country-level visit map

Accepted by explicit user implementation request, 2026-09-07. This authorizes country analytics beyond ADR 0003's initial sequencing limit.

Store only a nullable validated country code supplied by the credential-authenticated product proxy. On Vercel, the product proxy reads x-vercel-ip-country and forwards x-logly-country. Never infer location from the collector request, which may identify a proxy server. The event body's country field is not accepted. Counts are browser site_visit arrivals, scoped to project and period; historical/missing/invalid countries stay unknown. No IP, GPS, city or cross-project identity is persisted. Country reflects the delivery network, not verified residence; VPNs and delayed batches affect accuracy.

Use self-hosted Natural Earth public-domain country polygons with a ranked list for small/unmapped territories and keyboard/touch access. Reuse Insights and its complete-window summary; no map service or tracking dependency.
