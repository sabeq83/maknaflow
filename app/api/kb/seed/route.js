import { NextResponse } from 'next/server';
import { createKnowledgeBase, getAllKnowledgeBases } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const seedDir = path.join(process.cwd(), 'kb');
    
    if (!fs.existsSync(seedDir)) {
      return NextResponse.json({ success: false, error: 'kb directory not found' }, { status: 404 });
    }

    const existing = await getAllKnowledgeBases();
    const existingNames = new Set(existing.map(kb => kb.name));

    const files = fs.readdirSync(seedDir).filter(f => 
      f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.json')
    );

    // Skip PRD file
    const kbFiles = files.filter(f => !f.startsWith('PRD'));
    
    let seeded = 0;
    let updated = 0;
    for (const file of kbFiles) {
      const name = file.replace(/\.(md|txt|json)$/, '');
      const content = fs.readFileSync(path.join(seedDir, file), 'utf-8');
      const fileType = file.endsWith('.json') ? 'json' : 'md';
      
      if (existingNames.has(name)) {
        // Update existing KB with new content
        const { getDb } = await import('@/lib/db');
        const db = getDb();
        await db.prepare('UPDATE knowledge_bases SET content = ?, file_size = ? WHERE name = ?')
          .run(content, content.length, name);
        updated++;
        continue;
      }

      await createKnowledgeBase({
        id: uuidv4(),
        name: name,
        content: content,
        file_type: fileType,
        file_size: content.length,
      });
      seeded++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Seeded ${seeded} new, updated ${updated} existing knowledge base(s)`,
      total: existing.length + seeded 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
