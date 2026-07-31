import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const changelogPath = path.join(process.cwd(), 'sot/global/changelog.md');
    let content = 'Belum ada log perubahan.';
    if (fs.existsSync(changelogPath)) {
      content = fs.readFileSync(changelogPath, 'utf8');
    }

    const packagePath = path.join(process.cwd(), 'package.json');
    let version = '0.1.0';
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      version = packageJson.version || '0.1.0';
    }

    return NextResponse.json({ success: true, content, version });
  } catch (error) {
    console.error('[Changelog API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
