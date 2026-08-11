import fs from 'fs';
import path from 'path';
import { generateImage, getTaskStatus, getFileUrl } from '../lib/webhook-client.js';

async function main() {
  console.log('🏁 Starting nano_banana_pro image generation test...');
  
  const rawPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw_product.jpg');
  if (!fs.existsSync(rawPath)) {
    console.error(`❌ Raw product photo not found at: ${rawPath}`);
    process.exit(1);
  }
  
  const base64 = fs.readFileSync(rawPath).toString('base64');
  
  console.log('Sending request to G-Labs (model: nano_banana_pro)...');
  const prompt = 'edit foto ini menjadi foto profesional dengan latar warna putih';
  const result = await generateImage({
    prompt: prompt,
    model: 'nano_banana_pro',
    aspect_ratio: '1:1',
    reference_images: [base64]
  });
  
  console.log('Task submitted, task_id:', result.task_id);
  
  if (!result.task_id) {
    console.error('❌ Failed to get task_id');
    process.exit(1);
  }
  
  console.log('Polling status...');
  let completed = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusRes = await getTaskStatus(result.task_id);
    console.log(`Poll #${i+1}: Status = ${statusRes?.status}`);
    
    if (statusRes?.status === 'completed') {
      const files = statusRes.results || statusRes.files || [];
      let filename = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
      if (filename && (filename.startsWith('http://') || filename.startsWith('https://'))) {
        filename = filename.split('/').pop();
      }
      
      if (filename) {
        const downloadUrl = getFileUrl(filename, result.task_id);
        console.log('✅ Completed! Download URL:', downloadUrl);
        
        const response = await fetch(downloadUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const outPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'clean', 'nano_banana_output.jpg');
        fs.writeFileSync(outPath, buffer);
        console.log('💾 Result saved to:', outPath);
        completed = true;
        break;
      }
    } else if (statusRes?.status === 'failed') {
      console.error('❌ Task failed:', statusRes.error || statusRes.message);
      break;
    }
  }
  
  if (!completed) {
    console.error('❌ Task timed out or failed to complete.');
  }
}

main().catch(console.error);
