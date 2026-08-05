import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Get all brand profiles
    const brandProfiles = await db.prepare('SELECT id, brand_name FROM brand_profiles ORDER BY brand_name ASC').all();
    
    // Get distinct account names from content_flow_items
    const cfiAccounts = await db.prepare("SELECT DISTINCT account_name FROM content_flow_items WHERE account_name IS NOT NULL AND account_name != '' AND account_name != 'Umum'").all();
    
    const accountSet = new Set([
      ...brandProfiles.map(b => b.brand_name),
      ...cfiAccounts.map(a => a.account_name)
    ]);
    
    const brandsList = Array.from(accountSet);
    
    const stats = await Promise.all(brandsList.map(async accountName => {
      const tiktokCount = (await db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE account_name = ? AND tiktok_status = 'Published'").get(accountName))?.count || 0;
      const facebookCount = (await db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE account_name = ? AND facebook_status = 'Published'").get(accountName))?.count || 0;
      const instagramCount = (await db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE account_name = ? AND instagram_status = 'Published'").get(accountName))?.count || 0;
      const availableStock = (await db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE account_name = ? AND pipeline_status = 'Completed'").get(accountName))?.count || 0;
      
      return {
        account_name: accountName,
        tiktok_posted: tiktokCount,
        facebook_posted: facebookCount,
        instagram_posted: instagramCount,
        available_stock: availableStock
      };
    }));

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[API /v2/dashboard/stats GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
