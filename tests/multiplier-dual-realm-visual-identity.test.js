import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';

test('1. Multiplier Prompt Builder injects Dual-Realm Orchestration for Dapur Botani (Apothecary + 3D Bio-Cellular)', () => {
  const originalStoryboard = [
    { scene: 1, visual_description: 'Turmeric prep', narration_transcript: 'Rambut uban makin parah?' }
  ];
  const productDNA = {
    is_pure_storytelling: true,
    product_name: '',
    product_description: 'Resep kunyit hitam penghitam uban alami'
  };
  const aesthetics = {
    aspectRatio: '9:16',
    clipDuration: 4
  };
  const bridging = {
    campaign_type: 'pure_storytelling',
    isBridgingActive: false,
    visualMode: 'hybrid_lock',
    targetClipsCount: 8
  };
  const audio = {
    targetLanguage: 'id-ID'
  };

  const vsoDapurBotani = {
    isVsoActive: true,
    characterConcept: 'faceless',
    subjectDemographic: 'custom',
    subjectDemographicCustom: 'Faceless natural hands handling roots and botanicals, 100% focus on ingredients, slate stone, and 3D organ CGI, zero visible face or body.',
    wardrobeStyle: 'custom',
    wardrobeStyleCustom: 'Earthy unbleached raw linen rolled sleeves, soft-blurred in creamy bokeh background',
    lightingStyle: 'custom',
    lightingStyleCustom: 'Moody organic directional golden morning window light (3500K)',
    environmentPrompt: 'Artisanal apothecary studio, rough black slate stone workstation with glistening natural dew droplets, rustic granite mortar and pestle',
    negativePrompt: 'human face, syari dress, messy kitchen, white marble veining',
    visualSignature: 'Tactile macro botanical extraction on rough black slate stone with vintage amber dropper bottles and rustic granite mortar. Directional 3500K golden window chiaroscuro daylight. High-end 3D bio-cellular CGI simulations of soft organ tissue healing during pathology mechanisms. 100% faceless object-first cinematography.',
    structured: {
      mode_routing: {
        hook: 'culinary_cinematic',
        context: 'culinary_cinematic',
        mechanism: 'symbolic_surrealism',
        conclusion: 'culinary_cinematic'
      },
      style: {
        custom_description: 'Tactile macro botanical extraction combined with cinematic 3D medical CGI organ healing simulations when pathologies are discussed'
      }
    }
  };

  const prompt = buildMultiplierPhase2Prompt(
    originalStoryboard,
    productDNA,
    aesthetics,
    bridging,
    vsoDapurBotani,
    audio,
    0
  );

  // Verifikasi Dual-Realm Mandate
  assert.ok(prompt.includes('DUAL-REALM NARRATIVE ORCHESTRATION MANDATE:'), 'Dual-realm mandate header wajib ada');
  assert.ok(prompt.includes('REALM 1: PHYSICAL WORKSPACE & PREPARATION'), 'Realm 1 physical workspace wajib terdaftar');
  assert.ok(prompt.includes('REALM 2: SCIENTIFIC / 3D BIO-CELLULAR SIMULATION'), 'Realm 2 3D bio-cellular wajib terdaftar');
  assert.ok(prompt.includes('rough black slate stone workstation'), 'Setting slate stone Realm 1 wajib ada');
  assert.ok(prompt.includes('High-end 3D bio-cellular CGI simulations'), 'Simulasi 3D bio-cellular Realm 2 wajib ada');

  // Verifikasi aturan kontinuitas cerdas
  assert.ok(prompt.includes('Cinematic cutaways between Realm 1 and Realm 2 are explicitly permitted'), 'Cutaway diperbolehkan');
  assert.ok(!prompt.includes('Do not switch locations abruptly between clips (e.g., stay within the same studio tabletop theme across all scenes).'), 'Larangan kaku lokasi tunggal DILARANG ada pada dual-realm');

  // Verifikasi template prompt polimorfik
  assert.ok(prompt.includes('UNTUK ADEGAN FISIK/MEJA PERACIKAN (REALM 1):'), 'Template Realm 1 wajib ada');
  assert.ok(prompt.includes('UNTUK ADEGAN SIMULASI 3D BIO-CELLULAR / PROBLEM / PATOLOGY (REALM 2):'), 'Template Realm 2 wajib ada');
  assert.ok(prompt.includes('[LAYER 2: 3D BIO-CELLULAR & ANATOMICAL TRUTH]'), 'Layer 3D cellular truth wajib ada di template');
});

test('2. Multiplier Prompt Builder injects Dual-Realm Orchestration for Siasat Sehat (Clinical Lab + 3D Biomedical)', () => {
  const originalStoryboard = [{ scene: 1, visual_description: 'Biohack test', narration_transcript: 'Mitokondria lelah?' }];
  const productDNA = { is_pure_storytelling: true };
  const aesthetics = { aspectRatio: '9:16' };
  const bridging = { visualMode: 'hybrid_lock', targetClipsCount: 6 };
  const audio = {};

  const vsoSiasatSehat = {
    isVsoActive: true,
    environmentPrompt: 'Clinical biohacking bench on matte charcoal micro-cement surface with borosilicate laboratory beakers',
    visualSignature: 'Clinical biohacking and evidence-based functional health cinematography. High-tech 3D biomedical CGI simulations of cellular ATP energy, neural synapses, and insulin receptors.',
    structured: {
      mode_routing: {
        hook: 'cinematic_realistic',
        mechanism: 'symbolic_surrealism'
      }
    }
  };

  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vsoSiasatSehat, audio, 0);

  assert.ok(prompt.includes('DUAL-REALM NARRATIVE ORCHESTRATION MANDATE:'), 'Siasat Sehat wajib menerima dual-realm');
  assert.ok(prompt.includes('REALM 1: PHYSICAL WORKSPACE'), 'Realm 1 lab bench wajib ada');
  assert.ok(prompt.includes('REALM 2: SCIENTIFIC / 3D BIO-CELLULAR SIMULATION'), 'Realm 2 3D biomedical wajib ada');
  assert.ok(prompt.includes('High-tech 3D biomedical CGI simulations of cellular ATP energy'), 'Deskripsi 3D Siasat Sehat wajib masuk');
});

test('3. Multiplier Prompt Builder maintains Single-Realm Tabletop for Nutribake (No 3D Contamination)', () => {
  const originalStoryboard = [{ scene: 1, visual_description: 'Baking prep', narration_transcript: 'Ngidam manis?' }];
  const productDNA = { is_pure_storytelling: true };
  const aesthetics = { aspectRatio: '9:16' };
  const bridging = { visualMode: 'hybrid_lock', targetClipsCount: 4 };
  const audio = {};

  const vsoNutribake = {
    isVsoActive: true,
    environmentPrompt: 'Pristine modern kitchen island with seamless flat matte warm-grey quartz countertop, strictly zero marble veining',
    visualSignature: 'Sensory ASMR pastry craft and sugar-free baking cinematography anchored strictly on seamless flat matte warm-grey quartz countertop. 100% faceless hands-only movement.',
    structured: {
      mode_routing: {
        hook: 'culinary_cinematic',
        mechanism: 'culinary_cinematic'
      }
    }
  };

  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vsoNutribake, audio, 0);

  // Verifikasi Nutribake TIDAK terkontaminasi dual-realm 3D
  assert.ok(!prompt.includes('DUAL-REALM NARRATIVE ORCHESTRATION MANDATE:'), 'Nutribake DILARANG memicu dual-realm');
  assert.ok(!prompt.includes('REALM 2: SCIENTIFIC / 3D BIO-CELLULAR SIMULATION'), 'Nutribake DILARANG memiliki Realm 2');
  assert.ok(prompt.includes('LOCATION CONSISTENCY: The background setting (Environment/Location) must be uniform across all visual prompts'), 'Nutribake wajib konsisten 1 lokasi meja');
  assert.ok(prompt.includes('seamless flat matte warm-grey quartz countertop'), 'Meja quartz wajib ada');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
