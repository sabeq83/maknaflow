# Instruksi AI Agent — Affiliate Studio Fase 2 Brand Product Portfolio

## Mandat

Implementasikan hanya Fase 2 berdasarkan:

1. `AGENTS.md`
2. `sot/menus/affiliate-studio-roadmap.md`
3. Fase 0 implementation plan dan implementasi aktual
4. Fase 1 implementation plan dan implementasi aktual
5. `sot/menus/affiliate-studio/phase-02-product-portfolio-implementation-plan.md`

Targetnya adalah Products view read-only berdasarkan Brand Profile aktif. Jangan membuat database produk kedua dan jangan mengambil alih mutation Product Database.

## Prerequisite

Sebelum mengedit:

- verifikasi release Fase 0 dan Fase 1 pada changelog, commit, tag, branch, dan remote;
- jalankan Fase 0/Fase 1 regression tests;
- audit actual Fase 1 code karena actual code adalah authority untuk integration points;
- audit working tree dan catat semua perubahan user/pre-existing.

Jika prerequisite gagal, hentikan. Jangan memperbaiki atau mengimplementasikan ulang fase sebelumnya secara diam-diam.

## Additive-Only Rules

- Tambahkan adapter, readiness helper, API route, component, dan tests baru.
- Hanya extend empat file Fase 1 yang diizinkan plan.
- Jangan refactor Workspace/Shell/CSS Fase 1.
- Jangan menyentuh Product Database, Brand Product repository, affiliate resolver, campaign binding, database schema, workers, schedulers, prompts, atau Sidebar.
- Jangan membuat POST/PUT/PATCH/DELETE Affiliate Studio Product API.
- Jangan mengubah data saat user membuka atau memfilter Portfolio.
- Jangan memasukkan unrelated dirty files ke stage/release.

## Source-of-Truth Rules

- `product_extractions` owns product data.
- `brand_products` owns association and overrides.
- `resolveAffiliateLink` owns affiliate precedence.
- Product Database owns mutations.
- Fase 2 owns only projection and pure readiness state.

Do not copy resolver precedence into a second resolver. Every displayed resolved link must be derived through the existing resolver.

## Authorization Rules

- Use `withAffiliateStudioAccess('read')`.
- Tenant ID comes only from authenticated user context.
- Authorize Brand through `getAuthorizedAffiliateBrand` before catalog query.
- Admin sees tenant catalog for an authorized tenant Brand.
- Regular user sees catalog only inside assigned Brand context.
- Cross-tenant/unassigned Brand returns 404 without name leakage.

## Readiness Rules

Readiness must be pure and deterministic:

```text
productTruth
image
affiliateLink
association
overall
```

- brand-specific valid link → ready;
- legacy product fallback → needs_review;
- missing/invalid link → incomplete;
- active association → ready;
- inactive → needs_review;
- candidate/unlinked → incomplete;
- any incomplete dimension makes overall incomplete.

Do not label a product ready because it merely exists in Product Database.

## UI Rules

- Preserve `/affiliate-studio?brand=<id>` as Overview.
- Products uses `view=products`.
- Search/filter/cursor are URL-backed and allowlisted.
- Changing Brand preserves active supported view.
- Missing affiliate link is never clickable.
- Show affiliate source explicitly.
- Show Product ID and generic `/products` link only.
- Do not invent an unsupported Product detail URL/query/hash.
- No create/edit/link/unlink/regenerate/scrape/upload controls.
- Append CSS classes using semantic theme tokens; do not rewrite existing Fase 1 CSS or `app/theme.css`.

## Working-Tree Warning

At plan creation time, `tests/affiliate-studio-brand-projection.test.js` was already modified and uncommitted. Treat it as user-owned unless the user explicitly transfers ownership. Do not overwrite, stage, commit, or release it as part of Fase 2.

Always re-check current status because the working tree may have changed since this instruction was written.

## Execution Order

1. Verify prerequisites and working tree ownership.
2. Read local Next.js docs and actual Product/Brand/Affiliate contracts.
3. Update the first checklist item only after evidence exists.
4. Implement backward-compatible view/filter URL helpers.
5. Implement pure readiness/image helpers with tests.
6. Implement server-only read adapter with authorization, bounded queries, stable pagination, and resolver calls.
7. Implement GET-only API route.
8. Minimally enable Products in Shell and Workspace.
9. Implement read-only Portfolio UI and append CSS.
10. Add integration and boundary tests.
11. Run Fase 2 focused tests, Fase 0/1 regressions, existing product/affiliate tests, diff check, and build.
12. Audit Explicit No-Change paths and git diff.
13. Perform Dev-only smoke if required.
14. Update checklist in real time.
15. Run release SOP only after every gate passes.

## Plan Control

- Change `- [ ]` to `- [x]` immediately after each verified task.
- Do not mark partially completed tasks done.
- Before editing an unlisted file, add its Before/After section to the implementation plan.
- If the file is frozen, stop and report the blocker instead of editing it.

## Verification Minimum

```bash
node --test tests/affiliate-studio-product-readiness.test.js tests/affiliate-studio-product-portfolio.test.js tests/affiliate-studio-phase-02-boundary.test.js
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js tests/affiliate-studio-brand-shell.test.js tests/affiliate-studio-brand-projection.test.js tests/affiliate-studio-phase-01-boundary.test.js
node scripts/test-product-catalog-contract.mjs
node scripts/test-campaign-product-binding.mjs
node scripts/test-auth-rbac.js
git diff --check
npm run build
```

Also prove:

1. Existing Overview still works.
2. Cross-tenant/unassigned Brand is not found.
3. Linked/unlinked/inactive rows are not duplicated.
4. Displayed affiliate resolution matches resolver.
5. Legacy fallback is needs-review.
6. Missing truth/image/link is incomplete.
7. Pagination is stable.
8. Absolute filesystem paths are not exposed.
9. API is GET-only and UI has no mutation action.
10. Explicit No-Change paths and pre-existing dirty files were preserved.

## Deployment

Only if Dev smoke is needed:

```bash
npm run deploy:macmini-dev
```

- UI port 5020; API port 7020.
- Never deploy Staging or Production in this phase.
- Never poll SSH repeatedly during remote build; follow the two-minute timer SOP.

## Release

Use the release command in the implementation plan only after all tests and audits pass. Verify version, changelog, commit, tag, branch, and remote push. Do not include unrelated dirty files.

## Final Agent Report

Report:

- prerequisite evidence;
- files changed;
- URL/navigation extension;
- association and readiness semantics;
- affiliate resolver parity evidence;
- tenant/assigned-brand isolation evidence;
- focused and regression test/build results;
- Explicit No-Change and dirty-file preservation;
- Dev smoke result if run;
- release version, commit, tag, and push;
- deferred Product Database mutation/detail-link work and Fase 3 handoff.

