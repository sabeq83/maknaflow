import assert from 'assert';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

console.log('=== TEST 1: OPC Pure Editorial (Non-Bridging) with Wa\'y Siyasi Brand Profile ===');

const mockKBs = [
  { name: 'STRATEGIC_FRAMEWORKS', content: 'Framework guidelines' },
  { name: 'PROMPT_SYSTEM', content: 'Prompt system guidelines' },
  { name: 'NARRATIVE_STRUCTURE', content: 'Narrative structure guidelines' },
  { name: 'BRAND_VOICE_GUIDE', content: 'Brand voice guidelines' },
  { name: 'PLATFORM_COPYWRITING', content: 'Copywriting guidelines' },
  { name: 'COMPLIANCE_GUIDE', content: 'Compliance guidelines' }
];

const mockWaysiyasiProfile = {
  id: '6b36bd6f-d91b-4b01-895f-620a421067a4',
  brand_name: 'waysiyasi',
  editorial_brand_context: 'Wa\'y Siyasi mengajak audiens bergerak melalui alur: FENOMENA → FAKTA → AKAR MASALAH → SISTEM → PERSPEKTIF ISLAM → SOLUSI',
  editorial_content_goal: 'Meningkatkan literasi sistem politik, ekonomi, dan sosial dalam kerangka Islam.',
  editorial_content_pillars_json: '["Fenomena Sosial","Politik & Kebijakan Publik","Ekonomi & Kehidupan Masyarakat","Memahami Sistem","Dunia & Geopolitik","Perspektif Islam","Solusi Dalam Kerangka Islam"]'
};

const mockCampaignData = {
  content_pillar: 'Fenomena Sosial',
  custom_hook: 'Pernahkah Anda bertanya, mengapa makin keras kita bekerja, rasa lelahnya justru tidak pernah benar-benar hilang?',
  visual_action_guideline: 'Tracking shot sudut rendah kereta komuter malam',
  narrative_mode: 'Storytelling',
  visual_style: 'Cinematic',
  is_bridging_active: 0,
  target_clips_count: 6,
  bridge_at_clip: 2,
  account_name: 'waysiyasi',
  target_language: 'id-ID'
};

const prompt = buildOrganicPillarPrompt(mockKBs, mockCampaignData, null, mockWaysiyasiProfile, null);

// Assertions for Pure Editorial
assert(prompt.includes('BRAND IDENTITY & EDITORIAL CONTEXT (MANDATORY)'), 'Prompt must contain Brand Identity & Editorial Context section');
assert(prompt.includes('waysiyasi'), 'Prompt must contain brand name');
assert(prompt.includes('FENOMENA → FAKTA → AKAR MASALAH → SISTEM → PERSPEKTIF ISLAM → SOLUSI'), 'Prompt must contain editorial_brand_context');
assert(prompt.includes('Meningkatkan literasi sistem politik'), 'Prompt must contain editorial_content_goal');
assert(prompt.includes('Dunia & Geopolitik'), 'Prompt must contain editorial_content_pillars');
assert(prompt.includes('none (organic editorial campaign - no product bridging)'), 'sandwich_transition_plan must indicate non-bridging');
assert(!prompt.includes('persiapan kulkas hari Minggu'), 'Prompt must not contain hardcoded refrigerator prep analogy');
assert(!prompt.includes('#TehHerbal'), 'Prompt must not contain hardcoded #TehHerbal');
assert(!prompt.includes('ATURAN PENYISIPAN PRODUK ORGANIK (SANDWICH PLACEMENT MANDATE)'), 'Non-bridging prompt must not include sandwich placement mandate');

console.log('✅ Test 1 PASSED: Brand profile context injected and non-bridging editorial prompt is clean!\n');

console.log('=== TEST 2: OPC with Product Bridging Active ===');
const mockProductCampaignData = {
  ...mockCampaignData,
  is_bridging_active: 1
};
const mockProduct = {
  product_name: 'Buku Fiqih Siyasah',
  product_description: 'Buku literasi pemikiran politik Islam',
  unique_selling_point: 'Buku komprehensif sistemik',
  packaging_type: 'Buku Fisik',
  is_in_packaging: 0
};

const bridgingPrompt = buildOrganicPillarPrompt(mockKBs, mockProductCampaignData, mockProduct, mockWaysiyasiProfile, null);
assert(bridgingPrompt.includes('ATURAN PENYISIPAN PRODUK ORGANIK (SANDWICH PLACEMENT MANDATE)'), 'Bridging prompt must include sandwich placement mandate');
assert(bridgingPrompt.includes('Buku Fiqih Siyasah'), 'Bridging prompt must include product name');
assert(bridgingPrompt.includes('Rencana transisi softsell klip 2'), 'Bridging prompt must specify softsell transition for bridge clip');

console.log('✅ Test 2 PASSED: Bridging prompt properly isolates product rules!\n');

console.log('🎉 ALL BRAND CONTEXT INJECTION TESTS PASSED SUCCESSFULLY!');
