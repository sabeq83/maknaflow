import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, AlertTriangle, XCircle, Activity, 
  FileText, Type, Loader2, Copy, RefreshCw, Check
} from 'lucide-react';

const SYSTEM_PROMPT = `
Anda adalah "Herbal-Compliance", QC compliance checker khusus untuk konten TikTok Shop niche herbal/kesehatan.
Tugas Anda adalah memeriksa input script video, caption, dll, dan memberikan analisis berdasarkan 4 lapis pemeriksaan:
1. Vocabulary Check: Deteksi kata terlarang (klaim sembuh, garansi, nama penyakit).
2. Format Check: Cocokkan dengan 5 format aman (storytelling, edukasi-sejarah, mitos-fakta, resep-DIY, review-kurasi).
3. Disclaimer Check: Pastikan ada disclaimer hasil bisa berbeda.
4. Product Risk Check: Evaluasi risiko produk tier 1-3.

Aturan Skoring (Risk Score 1-10):
- Kata BLOCKER (klaim sembuh/garansi/penyakit) = +2
- Kata WARNING (superlatif/ambigu) = +1
- Disclaimer hilang di caption = +2
- Disclaimer hilang di overlay = +1
- Product tier 3 = +3, tier 2 = +1
- Format mismatch = +2

Verdict:
- PASS: 0 BLOCKER, <=1 WARNING, disclaimer lengkap (Skor 1-3)
- REVISE: Ada BLOCKER atau >=2 WARNING yg bisa diperbaiki (Skor 4-8)
- REJECT: Pelanggaran fundamental (Skor 9-10)

Hook Retention Engine (WAJIB jika ada hook bermasalah):
Identifikasi mekanisme hook 3 detik pertama (T1: Curiosity, T2: Pain Point, T3: Contrast, T4: FOMO, T5: Pattern Interrupt).
Berikan 3 opsi hook baru yang aman, tandai 1 sebagai rekomendasi.

ATURAN OUTPUT REVISI (SANGAT PENTING):
Untuk "revised_script", pecah teks revisi menjadi baris per baris (Array of strings) yang strukturnya SAMA PERSIS dengan input aslinya. Jika input memiliki baris kosong, berikan string kosong ("") pada posisi tersebut. Jangan pernah menggabungkan baris menjadi satu paragraf panjang.

Keluarkan hasil analisis HANYA dalam format JSON yang valid sesuai schema yang diminta.
`;

export default function App() {
  // Form States
  const [script, setScript] = useState('');
  const [caption, setCaption] = useState('');

  // App States
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fillDemoData = () => {
    setScript("Bocoran rahasia!\n\nKalau hasil lab kamu merah semua dan gula darah tinggi, ini obat alami yang lebih ampuh dari kimia.\n\nMadu ini dijamin menyembuhkan diabetes dalam 7 hari.\n\nYuk buruan beli sekarang sebelum kehabisan!");
    setCaption("Obat diabetes paling ampuh! Beli sekarang di keranjang kuning. #obatherbal #diabetessembuh");
  };

  const handleCopyCsv = () => {
    if (result?.csv_log) {
      navigator.clipboard.writeText(result.csv_log);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const analyzeContent = async () => {
    if (!script && !caption) {
      setError('Script Video atau Caption minimal harus diisi salah satu.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const apiKey = ""; // Disuntikkan oleh environment Canvas
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const userPrompt = `
      Tolong analisis draft konten ini:
      SCRIPT VIDEO: ${script || '-'}
      CAPTION: ${caption || '-'}
    `;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            verdict: { type: "STRING", enum: ["PASS", "REVISE", "REJECT"] },
            risk_score: { type: "INTEGER" },
            issues: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING", enum: ["BLOCKER", "WARNING"] },
                  text: { type: "STRING" }
                }
              }
            },
            hook_analysis: {
              type: "OBJECT",
              properties: {
                needs_revision: { type: "BOOLEAN" },
                original_hook: { type: "STRING" },
                original_mechanism: { type: "STRING" },
                options: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      mechanism: { type: "STRING" },
                      text: { type: "STRING" },
                      is_recommended: { type: "BOOLEAN" },
                      reason: { type: "STRING" }
                    }
                  }
                }
              }
            },
            revised_script: { 
              type: "ARRAY", 
              items: { type: "STRING" } 
            },
            revised_caption: { type: "STRING" },
            csv_log: { type: "STRING" }
          },
          required: ["verdict", "risk_score", "issues", "revised_script", "revised_caption", "csv_log"]
        }
      }
    };

    try {
      // Exponential backoff logic
      let attempt = 0;
      const maxRetries = 5;
      const delays = [1000, 2000, 4000, 8000, 16000];
      let response;

      while (attempt < maxRetries) {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) break;
        
        if (attempt < maxRetries - 1) {
          await new Promise(res => setTimeout(res, delays[attempt]));
          attempt++;
        } else {
          throw new Error(`API Error: ${response.status}`);
        }
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textOutput) {
        setResult(JSON.parse(textOutput));
      } else {
        throw new Error('Respons kosong dari AI.');
      }

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat menghubungi API.');
    } finally {
      setLoading(false);
    }
  };

  // UI Helpers
  const getVerdictColors = (verdict) => {
    switch(verdict) {
      case 'PASS': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REVISE': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REJECT': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getVerdictIcon = (verdict) => {
    switch(verdict) {
      case 'PASS': return <CheckCircle className="w-8 h-8 text-emerald-600" />;
      case 'REVISE': return <AlertTriangle className="w-8 h-8 text-amber-600" />;
      case 'REJECT': return <XCircle className="w-8 h-8 text-rose-600" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600" />
              Herbal Compliance Checker
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Validasi keamanan naskah konten TikTok Shop sesuai kebijakan medis.</p>
          </div>
          <button 
            onClick={fillDemoData}
            className="mt-4 md:mt-0 text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Isi Data Demo
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                Input Konten
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    Script Video (Voiceover) <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    value={script} onChange={(e) => setScript(e.target.value)}
                    className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                    placeholder="Masukkan teks dialog atau voiceover di sini..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    Caption TikTok <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    value={caption} onChange={(e) => setCaption(e.target.value)}
                    className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                    placeholder="Masukkan teks caption dan hashtag..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">
                    {error}
                  </div>
                )}

                <button
                  onClick={analyzeContent}
                  disabled={loading}
                  className="w-full bg-slate-900 text-white font-medium py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                  {loading ? 'Menganalisis Konten...' : 'Jalankan Compliance Check'}
                </button>

              </div>
            </div>
          </div>

          {/* Right Column: Dashboard Results */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="h-full min-h-[400px] bg-slate-200/50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-400" />
                <p>AI sedang memeriksa 4 lapis kepatuhan...</p>
              </div>
            ) : result ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Scoreboard Card */}
                <div className={`p-6 rounded-2xl border-2 flex items-center justify-between ${getVerdictColors(result.verdict)}`}>
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-full shadow-sm">
                      {getVerdictIcon(result.verdict)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Status Konten</p>
                      <h2 className="text-3xl font-black">{result.verdict}</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Risk Score</p>
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-4xl font-black">{result.risk_score}</span>
                      <span className="text-lg opacity-70">/10</span>
                    </div>
                  </div>
                </div>

                {/* Issues List */}
                {result.issues && result.issues.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Temuan Isu ({result.issues.length})
                    </h3>
                    <ul className="space-y-2">
                      {result.issues.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold mt-0.5 shrink-0 ${
                            issue.type === 'BLOCKER' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {issue.type}
                          </span>
                          <span className="text-slate-700 leading-relaxed">{issue.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hook Retention Engine */}
                {result.hook_analysis?.needs_revision && result.hook_analysis?.options && (
                  <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-indigo-900">Hook Retention Engine</h3>
                    </div>
                    
                    <div className="mb-4 text-sm text-indigo-800 bg-white/60 p-3 rounded-xl border border-indigo-100">
                      <span className="font-semibold block mb-1 text-indigo-900">Hook Asli ({result.hook_analysis.original_mechanism}):</span>
                      "{result.hook_analysis.original_hook}"
                    </div>

                    <div className="space-y-3">
                      {result.hook_analysis.options.map((opt, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${
                          opt.is_recommended ? 'bg-white border-indigo-400 shadow-sm relative' : 'bg-white/50 border-transparent hover:border-indigo-200'
                        }`}>
                          {opt.is_recommended && (
                            <span className="absolute -top-3 -right-2 bg-amber-400 text-amber-950 text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                              ⭐ REKOMENDASI
                            </span>
                          )}
                          <p className="text-sm text-slate-800 mb-2">
                            <span className="font-bold text-indigo-600 mr-2">[{opt.mechanism}]</span>
                            {opt.text}
                          </p>
                          {opt.is_recommended && opt.reason && (
                            <p className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">
                              <span className="font-semibold text-slate-600">Alasan:</span> {opt.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-Revision Panel */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Type className="w-4 h-4 text-emerald-500" />
                    Versi Aman (Compliance-Safe)
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Script Revisi</h4>
                      <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 leading-relaxed border border-slate-100">
                        {Array.isArray(result.revised_script) ? (
                          result.revised_script.map((line, idx) => (
                            <div key={idx} className="min-h-[1.25rem]">
                              {line}
                            </div>
                          ))
                        ) : (
                          <div className="whitespace-pre-wrap">{result.revised_script}</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Caption & Disclaimer Revisi</h4>
                      <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap">
                        {result.revised_caption}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Log & Export */}
                <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
                  <div className="text-sm">
                    <span className="opacity-70 mr-2">Approval Log CSV siap.</span>
                  </div>
                  <button 
                    onClick={handleCopyCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Tersalin!' : 'Copy Baris CSV'}
                  </button>
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center p-8">
                <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Belum Ada Analisis</h3>
                <p className="text-sm max-w-sm">Masukkan naskah video dan caption Anda di panel kiri, lalu klik tombol "Jalankan Compliance Check" untuk melihat hasil QC.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon helper for empty state
function ShieldCheck(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.5 0 4.5 1 7 2a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  );
}