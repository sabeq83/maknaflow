import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createGlabsCampaign, listGlabsCampaigns } from '../../../../lib/db';

export async function GET() {
  try {
    const campaigns = await listGlabsCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { source_spreadsheet_id, target_drive_folder_id } = body;

    if (!source_spreadsheet_id?.trim()) {
      return NextResponse.json({ error: 'source_spreadsheet_id is required' }, { status: 400 });
    }
    if (!target_drive_folder_id?.trim()) {
      return NextResponse.json({ error: 'target_drive_folder_id is required' }, { status: 400 });
    }

    // Accept full URL or bare ID
    const sheetId = extractId(source_spreadsheet_id.trim());
    const folderId = extractId(target_drive_folder_id.trim());

    const id = uuidv4();
    await createGlabsCampaign({ id, source_spreadsheet_id: sheetId, target_drive_folder_id: folderId });

    return NextResponse.json({ campaign: { id, source_spreadsheet_id: sheetId, target_drive_folder_id: folderId, status: 'active' } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function extractId(input) {
  // Extract spreadsheet ID from URL like https://docs.google.com/spreadsheets/d/ID/edit
  const sheetMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) return sheetMatch[1];
  // Extract folder ID from URL like https://drive.google.com/drive/folders/ID
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  return input;
}
