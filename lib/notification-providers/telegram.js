export class TelegramProviderError extends Error {
  constructor(message,{status=0,permanent=false}={}) {
    super(message); this.status=status; this.permanent=permanent; this.code='TELEGRAM_PROVIDER_ERROR';
  }
}

export async function sendTelegramNotification({botToken,chatId,title,message,actionUrl,baseUrl}) {
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(String(botToken||''))) throw new TelegramProviderError('Format Telegram bot token tidak valid.',{status:400,permanent:true});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const url=`https://api.telegram.org/bot${botToken}/sendMessage`;
    const text=[`<b>${escapeHtml(title)}</b>`,escapeHtml(message),actionUrl?`<a href="${escapeHtml(new URL(actionUrl,baseUrl).toString())}">Buka MAKNA</a>`:''].filter(Boolean).join('\n\n');
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true}),signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body.ok) throw new TelegramProviderError(body.description||`Telegram HTTP ${response.status}`,{status:response.status,permanent:[400,401,403,404].includes(response.status)});
    return {provider_message_id:String(body.result?.message_id||'')};
  } catch(error) {
    if(error instanceof TelegramProviderError) throw error;
    if(error.name==='AbortError') throw new TelegramProviderError('Telegram request timeout');
    throw new TelegramProviderError(error.message);
  } finally { clearTimeout(timer); }
}

function escapeHtml(value){return String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
