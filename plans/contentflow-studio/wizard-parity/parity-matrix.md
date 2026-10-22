# Campaign Configuration Parity Matrix

Baseline: `9ad39ea` / v2.32.72. Kode menu asal menjadi acuan; semua kontrol dan handler dipindah utuh, bukan direkonstruksi dari mockup.

## planner

Sumber: `app/content-planner/page.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 1061 | `knowledgeDomain` | select | 8 |  |
| 1089 | `universeProfile` | select | 1 | contentWorld === 'cartoon_universe' |
| 1161 | `productSearchQuery` | text | 0 | plannerFocus === 'product_campaign' && inputMode === 'existing' |
| 1275 | `selectedBrandId` | select | 1 | plannerFocus === 'brand_editorial' |
| 1294 | `brandContext` | textarea | 0 | plannerFocus === 'brand_editorial' |
| 1298 | `contentGoal` | textarea | 0 | plannerFocus === 'brand_editorial' |
| 1303 | `pillarDraft` | text | 0 | plannerFocus === 'brand_editorial' |
| 1323 | `pillarDistributionMode` | select | 3 | plannerFocus === 'brand_editorial' |
| 1338 | `selectedBrandId` | select | 1 | plannerFocus === 'product_campaign' // plannerFocus === 'recipe_campaign' |
| 1376 | `productSearchQuery` | text | 0 | plannerFocus === 'recipe_campaign' |
| 1407 | `recipeProductIds` | checkbox | 0 | plannerFocus === 'recipe_campaign', !(existingProducts.length === 0) |
| 1527 | `promotionContext` | text | 0 | plannerFocus === 'recipe_campaign' |
| 1540 | `customInstructions` | textarea | 0 | plannerFocus === 'recipe_campaign' |
| 1574 | `title` | text | 0 |  |
| 1589 | `productName` | text | 0 | plannerFocus === 'product_campaign' |
| 1601 | `productDesc` | textarea | 0 | plannerFocus === 'product_campaign' |
| 1613 | `productUsp` | text | 0 | plannerFocus === 'product_campaign' |
| 1624 | `promotionContext` | text | 0 | plannerFocus === 'product_campaign' |
| 1635 | `customInstructions` | textarea | 0 | plannerFocus === 'product_campaign' |
| 1646 | `isNonAffiliate` | checkbox | 0 | plannerFocus === 'product_campaign' |
| 1663 | `productUrl` | text | 0 | plannerFocus === 'product_campaign', (inputMode === 'manual') |
| 1673 | `affiliateUrl` | text | 0 | plannerFocus === 'product_campaign', (inputMode === 'manual') |
| 1684 | `productPhotoUrl` | text | 0 | plannerFocus === 'product_campaign', (inputMode === 'manual') |
| 1699 | `productUrl` | text | 0 | plannerFocus === 'product_campaign', !(inputMode === 'manual') |
| 1712 | `affiliateUrl` | text | 0 | plannerFocus === 'product_campaign', !(inputMode === 'manual') |
| 1736 | `targetAudience` | select | 6 |  |
| 1750 | `customTargetAudience` | text | 0 | targetAudience === 'custom' |
| 1763 | `platform` | select | 3 |  |
| 1779 | `recipeCount` | number | 0 | (plannerFocus === 'recipe_campaign') |
| 1818 | `editorialRowsPerPillar` | select | 6 | !(plannerFocus === 'recipe_campaign') |
## pillar

Sumber: `app/components/ImportPlannerModal.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 785 | `selectedPresetKey` | select | 1 |  |
| 840 | `selectedPlannerId` | select | 1 | !initialPlannerId |
| 929 | `field_929` | checkbox | 0 | planner |
| 1000 | `field_1000` | file | 0 | planner, manifest |
| 1022 | `selectedBrandId` | select | 1 |  |
| 1049 | `campaignName` | text | 0 |  |
| 1061 | `narrativeMode` | select | 4 |  |
| 1075 | `aiDirective` | textarea | 0 |  |
| 1086 | `mandatoryOutroLine` | text | 0 |  |
| 1097 | `customInstruction` | textarea | 0 |  |
| 1109 | `voiceProvider` | select | 2 |  |
| 1121 | `targetLanguage` | select | 2 |  |
| 1133 | `targetDemographic` | select | 6 |  |
| 1146 | `targetDemographicCustom` | text | 0 | targetDemographic === 'custom' |
| 1158 | `enableAudioSegment` | select | 2 |  |
| 1172 | `sfxSetting` | select | 2 |  |
| 1184 | `enableVoAudit` | select | 2 |  |
| 1198 | `nextcloudParentFolder` | text | 0 |  |
| 1211 | `selectedBrandId` | select | 1 | brandProfiles.length > 0 |
| 1253 | `visualStyle` | select | 3 |  |
| 1273 | `visualMode` | select | 2 |  |
| 1297 | `videoModel` | select | 0 |  |
| 1317 | `clipDuration` | select | 4 |  |
| 1339 | `faceVisibility` | select | 4 |  |
| 1349 | `targetClipsCount` | number | 0 |  |
| 1362 | `wordsPerClip` | select | 0 |  |
| 1371 | `aspectRatio` | select | 3 |  |
| 1399 | `isBridgingActive` | checkbox | 0 |  |
| 1408 | `bridgeAtClip` | number | 0 | isBridgingActive |
| 1421 | `bridgeDurationClips` | select | 3 | isBridgingActive |
| 1430 | `bridgingMode` | select | 3 | isBridgingActive |
| 1468 | `isVsoActive` | checkbox | 0 |  |
| 1483 | `visualIdentity` | identity | 0 |  |
| 1519 | `enableTts` | checkbox | 0 |  |
| 1524 | `enableGlabs` | checkbox | 0 |  |
| 1529 | `enableFfmpeg` | checkbox | 0 |  |
| 1534 | `enableSocialPost` | checkbox | 0 |  |
| 1547 | `voiceProvider` | select | 2 | enableTts |
| 1558 | `voicePersona` | select | 21 | enableTts |
| 1573 | `voiceSpeed` | range | 0 | enableTts |
| 1577 | `voiceVolume` | range | 0 | enableTts |
| 1592 | `syncMode` | radio | 0 | enableFfmpeg |
| 1606 | `syncMode` | radio | 0 | enableFfmpeg |
| 1624 | `ffmpegSyncOption` | select | 4 | enableFfmpeg, syncMode === 'manual' |
| 1643 | `ffmpegVideoScale` | range | 0 | enableFfmpeg |
## re

Sumber: `app/re-campaigns/page.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 1166 | `selectedPresetKey` | select | 1 |  |
| 1212 | `accountName` | select | 1 |  |
| 1239 | `campaignName` | text | 0 |  |
| 1249 | `nextcloudParentFolder` | text | 0 |  |
| 1259 | `targetLanguage` | select | 2 |  |
| 1270 | `targetDemographic` | select | 6 |  |
| 1283 | `targetDemographicCustom` | text | 0 | targetDemographic === 'custom' |
| 1295 | `enableAudioSegment` | select | 2 |  |
| 1311 | `voiceProvider` | select | 2 | enableAudioSegment |
| 1338 | `sfxSetting` | select | 2 |  |
| 1349 | `enableVoAudit` | select | 2 |  |
| 1362 | `urlsText` | textarea | 0 | (productionMode === 'single') |
| 1414 | `field_1414` | file | 0 | !(productionMode === 'single') |
| 1463 | `generateRecipe` | checkbox | 0 |  |
| 1480 | `aiDirective` | textarea | 0 |  |
| 1490 | `mandatoryOutroLine` | text | 0 |  |
| 1500 | `customInstruction` | textarea | 0 |  |
| 1525 | `angleMultiplier` | select | 4 |  |
| 1538 | `narrativeMode` | select | 3 |  |
| 1550 | `aspectRatio` | select | 3 |  |
| 1562 | `targetAi` | select | 4 |  |
| 1575 | `videoModel` | select | 0 |  |
| 1594 | `clipDuration` | select | 4 |  |
| 1613 | `faceVisibility` | select | 4 |  |
| 1626 | `targetClipsCount` | number | 0 |  |
| 1645 | `wordsPerClip` | select | 0 |  |
| 1657 | `visualStyle` | select | 3 |  |
| 1676 | `visualMode` | select | 2 |  |
| 1709 | `isBridgingActive` | checkbox | 0 |  |
| 1729 | `bridgeAtClip` | number | 0 | isBridgingActive |
| 1753 | `bridgeDurationClips` | select | 6 | isBridgingActive |
| 1771 | `promotionStyle` | select | 3 | isBridgingActive |
| 1788 | `bridgingMode` | radio | 0 | isBridgingActive |
| 1798 | `bridgingMode` | radio | 0 | isBridgingActive |
| 1808 | `bridgingMode` | radio | 0 | isBridgingActive |
| 1823 | `targetProductId` | select | 1 | isBridgingActive, bridgingMode === 'select_existing' |
| 1872 | `manualProductName` | text | 0 | isBridgingActive, bridgingMode === 'manual_input' |
| 1883 | `manualProductDesc` | textarea | 0 | isBridgingActive, bridgingMode === 'manual_input' |
| 1894 | `manualProductUsp` | text | 0 | isBridgingActive, bridgingMode === 'manual_input' |
| 1908 | `productUrl` | url | 0 | isBridgingActive, bridgingMode === 'url_extract' |
| 1930 | `productRefImage` | file | 0 | isBridgingActive, isBridgingActive && visualMode === 'hybrid_lock', !(bridgingMode === 'url_extract') |
| 1941 | `productFilenameDeclare` | text | 0 | isBridgingActive, isBridgingActive && visualMode === 'hybrid_lock', !(bridgingMode === 'url_extract') |
| 1979 | `isVsoActive` | checkbox | 0 |  |
| 1995 | `visualIdentity` | identity | 0 |  |
| 2030 | `enableTts` | checkbox | 0 |  |
| 2035 | `enableGlabs` | checkbox | 0 |  |
| 2040 | `enableFfmpeg` | checkbox | 0 |  |
| 2045 | `enableSocialPost` | checkbox | 0 |  |
| 2058 | `voiceProvider` | select | 2 | enableTts |
| 2065 | `voicePersona` | select | 21 | enableTts |
| 2080 | `voiceSpeed` | range | 0 | enableTts |
| 2084 | `voiceVolume` | range | 0 | enableTts |
| 2099 | `syncMode` | radio | 0 | enableFfmpeg |
| 2113 | `syncMode` | radio | 0 | enableFfmpeg |
| 2131 | `ffmpegSyncOption` | select | 4 | enableFfmpeg, syncMode === 'manual' |
| 2146 | `ffmpegVideoScale` | range | 0 | enableFfmpeg |
## multiplier

Sumber: `app/multiplier-lab/page.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 1214 | `assetSearchQuery` | text | 0 | showConfigForm |
| 1222 | `nicheFilter` | select | 1 | showConfigForm |
| 1376 | `campaignType` | radio | 0 | showConfigForm |
| 1408 | `campaignType` | radio | 0 | showConfigForm |
| 1450 | `selectedNicheKb` | select | 7 | showConfigForm, campaignType === 'editorial' |
| 1477 | `angleCount` | select | 7 | showConfigForm, campaignType === 'editorial', workflowMode !== 'multi_blueprint_one_angle' |
| 1527 | `customAngleTheme` | text | 0 | showConfigForm, campaignType === 'editorial' |
| 1666 | `selectedAngleIds` | checkbox | 0 | showConfigForm, campaignType === 'editorial', generatedAngles.length > 0 |
| 1742 | `editorialOutro` | text | 0 | showConfigForm, campaignType === 'editorial' |
| 1767 | `bridgingMode` | radio | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product') |
| 1771 | `bridgingMode` | radio | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product') |
| 1775 | `bridgingMode` | radio | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product') |
| 1783 | `productSearchQuery` | text | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'select_existing' |
| 1815 | `isSelected` | radio | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'select_existing' |
| 1840 | `productUrl` | url | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'url_extract' |
| 1844 | `affiliateUrl` | url | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'url_extract' |
| 1853 | `manualProductName` | text | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'manual_input' |
| 1858 | `manualProductDesc` | textarea | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'manual_input' |
| 1862 | `manualProductUsp` | text | 0 | showConfigForm, campaignType === 'product', (workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'manual_input' |
| 1872 | `bridgingMode` | radio | 0 | showConfigForm, campaignType === 'product', !(workflowMode === 'multi_blueprint_one_product') |
| 1876 | `bridgingMode` | radio | 0 | showConfigForm, campaignType === 'product', !(workflowMode === 'multi_blueprint_one_product') |
| 1884 | `productSearchQuery` | text | 0 | showConfigForm, campaignType === 'product', !(workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'select_existing' |
| 1918 | `isSelected` | checkbox | 0 | showConfigForm, campaignType === 'product', !(workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'select_existing' |
| 1942 | `massUrlsText` | textarea | 0 | showConfigForm, campaignType === 'product', !(workflowMode === 'multi_blueprint_one_product'), bridgingMode === 'url_extract' |
| 2008 | `selectedPresetKey` | select | 1 | showConfigForm |
| 2052 | `selectedBrandId` | select | 1 | showConfigForm |
| 2074 | `campaignName` | text | 0 | showConfigForm |
| 2085 | `nextcloudParentFolder` | text | 0 | showConfigForm |
| 2096 | `targetLanguage` | select | 2 | showConfigForm |
| 2104 | `targetDemographic` | select | 6 | showConfigForm |
| 2113 | `targetDemographicCustom` | text | 0 | showConfigForm, targetDemographic === 'custom' |
| 2126 | `enableAudioSegment` | select | 2 | showConfigForm |
| 2134 | `sfxSetting` | select | 2 | showConfigForm |
| 2142 | `enableVoAudit` | select | 2 | showConfigForm |
| 2152 | `generateRecipe` | checkbox | 0 | showConfigForm |
| 2170 | `aiDirective` | textarea | 0 | showConfigForm |
| 2181 | `mandatoryOutroLine` | text | 0 | showConfigForm |
| 2192 | `customInstruction` | textarea | 0 | showConfigForm |
| 2217 | `narrativeMode` | select | 4 | showConfigForm |
| 2227 | `aspectRatio` | select | 3 | showConfigForm |
| 2236 | `targetAi` | select | 1 | showConfigForm |
| 2243 | `videoModel` | select | 0 | showConfigForm |
| 2263 | `clipDuration` | select | 4 | showConfigForm |
| 2283 | `faceVisibility` | select | 4 | showConfigForm |
| 2293 | `targetClipsCount` | number | 0 | showConfigForm |
| 2305 | `wordsPerClip` | select | 0 | showConfigForm |
| 2314 | `visualStyle` | select | 3 | showConfigForm |
| 2323 | `visualMode` | select | 2 | showConfigForm |
| 2344 | `isBridgingActive` | checkbox | 0 | showConfigForm |
| 2357 | `bridgeAtClip` | number | 0 | showConfigForm, isBridgingActive |
| 2369 | `bridgeDurationClips` | select | 5 | showConfigForm, isBridgingActive |
| 2380 | `promotionStyle` | select | 3 | showConfigForm, isBridgingActive |
| 2404 | `field_2404` | file | 0 | showConfigForm, isBridgingActive, visualMode === 'hybrid_lock', !(dbPhotoUrl) |
| 2437 | `isVsoActive` | checkbox | 0 | showConfigForm |
| 2450 | `visualIdentity` | identity | 0 |  |
## recipeStatic

Sumber: `app/recipe-labs/page.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 1043 | `deconstructSearchQuery` | text | 0 | showConfigForm |
| 1080 | `sourceDeconstructAssetId` | select | 1 | showConfigForm |
| 1139 | `category` | select | 6 | showConfigForm |
| 1153 | `customCategory` | text | 0 | showConfigForm, category === 'Custom Input' |
| 1165 | `visualStyle` | select | 4 | showConfigForm |
| 1178 | `nextcloudParentFolder` | text | 0 | showConfigForm |
| 1189 | `targetCount` | number | 0 | showConfigForm |
| 1221 | `enableGlabs` | checkbox | 0 | showConfigForm |
| 1378 | `selectedLayoutId` | select | 3 | showConfigForm, enableGlabs |
| 1411 | `gridGapSize` | range | 0 | showConfigForm, enableGlabs |
| 1427 | `gridBorderRadius` | range | 0 | showConfigForm, enableGlabs |
| 1445 | `gridOuterPadding` | range | 0 | showConfigForm, enableGlabs |
| 1459 | `gridBgColor` | color | 0 | showConfigForm, enableGlabs |
| 1473 | `gridBgColor` | text | 0 | showConfigForm, enableGlabs |
| 1591 | `targetDemographic` | select | 6 | showConfigForm |
| 1600 | `targetDemographicCustom` | text | 0 | showConfigForm, targetDemographic === 'custom' |
| 1624 | `brandProfileId` | select | 1 | showConfigForm |
## recipeVideo

Sumber: `app/recipe-labs/page.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 1677 | `deconstructSearchQuery` | text | 0 | showConfigForm |
| 1714 | `sourceDeconstructAssetId` | select | 1 | showConfigForm |
| 1773 | `accountName` | select | 3 | showConfigForm |
| 1797 | `campaignName` | text | 0 | showConfigForm |
| 1807 | `spreadsheetId` | text | 0 | showConfigForm |
| 1816 | `targetLanguage` | select | 2 | showConfigForm |
| 1829 | `contentPillar` | textarea | 0 | showConfigForm |
| 1841 | `customHook` | text | 0 | showConfigForm |
| 1850 | `brandProfileId` | select | 1 | showConfigForm |
| 1865 | `visualActionGuideline` | text | 0 | showConfigForm |
| 1875 | `customInstruction` | text | 0 | showConfigForm |
| 1885 | `nextcloudParentFolder` | text | 0 | showConfigForm |
| 1914 | `narrativeMode` | select | 3 | showConfigForm |
| 1922 | `visualStyleVideo` | select | 3 | showConfigForm |
| 1930 | `targetAi` | select | 2 | showConfigForm |
| 1940 | `videoModel` | select | 0 | showConfigForm |
| 1948 | `aspectRatio` | select | 2 | showConfigForm |
| 1955 | `faceVisibility` | select | 3 | showConfigForm |
| 1965 | `wordsPerClip` | text | 0 | showConfigForm |
| 1996 | `isBridgingActive` | checkbox | 0 | showConfigForm |
| 2008 | `targetClipsCount` | number | 0 | showConfigForm, isBridgingActive |
| 2012 | `bridgeAtClip` | number | 0 | showConfigForm, isBridgingActive |
| 2016 | `promotionStyle` | select | 2 | showConfigForm, isBridgingActive |
| 2026 | `bridgingMode` | select | 2 | showConfigForm, isBridgingActive |
| 2033 | `visualMode` | select | 2 | showConfigForm, isBridgingActive |
| 2043 | `targetProductId` | select | 1 | showConfigForm, isBridgingActive, (bridgingMode === 'select_existing') |
| 2054 | `manualProductName` | text | 0 | showConfigForm, isBridgingActive, !(bridgingMode === 'select_existing') |
| 2058 | `manualProductDesc` | textarea | 0 | showConfigForm, isBridgingActive, !(bridgingMode === 'select_existing') |
| 2062 | `manualProductUsp` | text | 0 | showConfigForm, isBridgingActive, !(bridgingMode === 'select_existing') |
| 2066 | `productUrl` | text | 0 | showConfigForm, isBridgingActive, !(bridgingMode === 'select_existing') |
| 2103 | `isVsoActive` | checkbox | 0 | showConfigForm |
| 2112 | `characterConcept` | select | 4 | showConfigForm, isVsoActive |
| 2122 | `subjectDemographic` | select | 5 | showConfigForm, isVsoActive |
| 2146 | `wardrobeStyle` | select | 36 | showConfigForm, isVsoActive |
| 2209 | `wardrobeStyleCustom` | text | 0 | showConfigForm, isVsoActive, wardrobeStyle === 'custom' |
| 2228 | `lightingStyle` | select | 6 | showConfigForm, isVsoActive |
| 2237 | `lightingStyleCustom` | text | 0 | showConfigForm, isVsoActive, lightingStyle === 'custom' |
| 2283 | `enableTts` | checkbox | 0 | showConfigForm |
| 2294 | `voiceProvider` | select | 2 | showConfigForm, enableTts |
| 2301 | `voicePersona` | select | 21 | showConfigForm, enableTts |
| 2310 | `voiceSpeed` | range | 0 | showConfigForm, enableTts |
| 2314 | `voiceVolume` | range | 0 | showConfigForm, enableTts |
| 2319 | `ttsModelQuality` | select | 2 | showConfigForm, enableTts, voiceProvider === 'minimax' |
| 2335 | `enableGlabsVideo` | checkbox | 0 | showConfigForm |
| 2357 | `enableFfmpeg` | checkbox | 0 | showConfigForm |
| 2378 | `syncMode` | radio | 0 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo |
| 2392 | `syncMode` | radio | 0 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo |
| 2410 | `ffmpegSyncOption` | select | 4 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo, syncMode === 'manual' |
| 2426 | `ffmpegVideoScale` | range | 0 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo |
| 2446 | `ffmpegSfxVolume` | range | 0 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo |
| 2463 | `ffmpegBgmVolume` | range | 0 | showConfigForm, enableFfmpeg && enableTts && enableGlabsVideo |
| 2486 | `enableSocialPost` | checkbox | 0 | showConfigForm |
| 2504 | `facebookPageId` | select | 0 | showConfigForm, enableSocialPost, !(facebookPages.length === 0) |
| 2519 | `facebookServerUrl` | text | 0 | showConfigForm, enableSocialPost |
## identity

Sumber: `app/components/VisualIdentitySelector.js`. Default, validasi dan serializer mengikuti handler sumber yang direlokasi bersama JSX.

| Baris asal | State | Tipe | Pilihan statis | Kondisi |
|---|---|---|---|---|
| 242 | `field_242` | select | 0 | customizingMode === 'preset' |
| 292 | `field_292` | select | 5 | customizingMode === 'legacy' && value.visual_overrides_json |
| 307 | `field_307` | select | 13 | customizingMode === 'legacy' && value.visual_overrides_json |
| 325 | `field_325` | text | 0 | customizingMode === 'legacy' && value.visual_overrides_json, value.visual_overrides_json.wardrobe_style === 'custom' |

## Invocation dan output

- Pillar: satu row menghasilkan satu item/video; konsumsi Planner ditransaksikan pada batch.
- RE Single/Mass: source URL menghasilkan satu parent item; `processItemMultiAngle` menyimpan 3/4/5 child di `re_item_angle_variants`. Parent tidak memiliki video final untuk mode angle. Child memiliki ffmpeg_output_path/drive_link dan upload_status; slot angle harus berbagi invocation parent. Bulk endpoint asli memetakan `url_source` dan `link_product` per baris.
- Multiplier: setiap combinationRows menghasilkan satu task. Empat workflow berbeda hanya pada pemilihan sumber dan pembentukan rows; non-produk memakai pure_storytelling.
- Recipe: Static count menghasilkan N recipe_items; video menghasilkan satu storyboard. Text-only static tidak memiliki gambar final, sehingga perlu needs_review.

## Aset

RE membawa File melalui multipart product_media; Multiplier mengunggah ke endpoint produk lalu menyimpan path; Pillar row image memakai endpoint produk dan row payload. Tetap pakai endpoint/serializer sumber asli. Batch RE melakukan staging File ke shared public/uploads/studio sebelum worker. File yang telah diunggah menu lain harus divalidasi server sebelum disimpan sebagai referensi.
