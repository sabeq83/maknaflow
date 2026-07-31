import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Run git log in the working directory to get the last 15 commits formatted with tab separators
    const { stdout } = await execAsync(
      'git log -n 15 --pretty=format:"%h%x09%an%x09%ad%x09%s" --date=short'
    );
    
    if (!stdout.trim()) {
      return NextResponse.json({ success: true, commits: [] });
    }

    const commits = stdout.split('\n').map(line => {
      const [hash, author, date, message] = line.split('\t');
      return { hash, author, date, message };
    });

    return NextResponse.json({ success: true, commits });
  } catch (error) {
    console.warn('[Git History API Warning]: Unable to fetch git log:', error.message);
    return NextResponse.json({ 
      success: true, 
      commits: [], 
      warning: 'Gagal mengambil riwayat Git secara dinamis.' 
    });
  }
}
