import { NextResponse } from 'next/server';
import { createRecipeCampaign, createRecipeItem, getRecipeCampaigns } from '@/lib/db';
import crypto from 'crypto';
import { generateCampaignId } from '@/lib/id-generator';

export async function GET() {
  try {
    const campaigns = await getRecipeCampaigns();
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('[API /api/recipe-labs GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      category, 
      custom_category, 
      visual_style, 
      nextcloud_parent_folder, 
      post_to_facebook, 
      enable_glabs, 
      target_recipe_count, 
      campaign_type, 
      brand_profile_id, 
      spreadsheet_id, 
      config_json,
      images_per_recipe,
      selected_layout_id,
      grid_gap_size,
      grid_border_radius,
      grid_outer_padding,
      grid_bg_color,
      source_deconstruct_asset_id
    } = body;

    if (!category) {
      return NextResponse.json({ success: false, error: 'Kategori resep wajib diisi.' }, { status: 400 });
    }

    const campaignId = generateCampaignId('recipe');
    const count = Math.max(1, Math.min(20, Number(target_recipe_count) || 1));

    // 1. Buat Kampanye Utama
    await createRecipeCampaign({
      id: campaignId,
      category,
      custom_category: category === 'Custom Input' ? custom_category : null,
      visual_style: visual_style || 'Food Porn',
      nextcloud_parent_folder: nextcloud_parent_folder ? nextcloud_parent_folder.trim() : 'MAKNA_Recipes',
      post_to_facebook: post_to_facebook !== undefined ? (post_to_facebook ? 1 : 0) : 0,
      enable_glabs: enable_glabs !== undefined ? (enable_glabs ? 1 : 0) : 1,
      target_recipe_count: count,
      images_per_recipe: images_per_recipe !== undefined ? Number(images_per_recipe) : 4,
      selected_layout_id: selected_layout_id || '4_editorial_split',
      grid_gap_size: grid_gap_size !== undefined ? Number(grid_gap_size) : 12,
      grid_border_radius: grid_border_radius !== undefined ? Number(grid_border_radius) : 16,
      grid_outer_padding: grid_outer_padding !== undefined ? Number(grid_outer_padding) : 16,
      grid_bg_color: grid_bg_color || '#0d0d12',
      status: 'processing',
      campaign_type: campaign_type || 'static',
      brand_profile_id: brand_profile_id || null,
      spreadsheet_id: spreadsheet_id || null,
      config_json: config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null,
      source_deconstruct_asset_id: source_deconstruct_asset_id || null
    });

    // 2. Buat Item Resep Individual & Enqueue Job awal (Hanya item pertama untuk eksekusi sekuensial)
    const createdItemIds = [];
    for (let i = 0; i < count; i++) {
      const itemId = `rcitem_${campaignId}_${i + 1}`;
      await createRecipeItem({
        id: itemId,
        campaign_id: campaignId,
        status: 'pending_gemini'
      });
      createdItemIds.push(itemId);
    }

    return NextResponse.json({
      success: true,
      message: 'Kampanye resep berhasil dibuat dan dimasukkan ke antrean.',
      data: {
        campaign_id: campaignId,
        total_items: count,
        item_ids: createdItemIds
      }
    });

  } catch (error) {
    console.error('[API /api/recipe-labs POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
