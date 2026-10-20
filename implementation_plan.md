# Implementation Plan: Penyelarasan Alur & Notifikasi "Generate All Start Frame" (Multiplier & Pillar Campaign)

Rencana ini merespons kebutuhan penyelarasan pengalaman pengguna (UX) pada saat memicu tombol **Generate All Start Frame** di **Multiplier Campaign** dan **Pillar Campaign**:
1. **Multiplier Campaign**: Menghapus popup dialog konfirmasi bawaan browser (`confirm(...)`), cukup notifikasi toast di pojok kanan bawah selama sekira **10 detik** (sama seperti Pillar Campaign).
2. **Multiplier Campaign**: Saat tombol diklik, status `⏸️ Fase 2 : Paused (Ready for Review)` otomatis berubah menjadi **`⚡ Fase 1 : Generate Start Frame`** dengan warna **hijau** (`var(--status-success)`).
3. **Pillar Campaign**: Saat tombol diklik, status `⏸️ Fase 2 : Paused (Ready for Review)` otomatis berubah menjadi **`⚡ Fase 1 : Generate Start Frame`** dengan warna **hijau** (`var(--status-success)`).

---

## 🎨 Mockup HTML Standalone untuk Simulasi & Review

Sesuai SOP Makna Flow, simulasi visual dan alur interaktif standalone telah dibuat agar dapat diuji langsung oleh pengguna sebelum penulisan kode di komponen React utama:
- **File Mockup:** [public/mockup_generate_start_frame_flow.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_generate_start_frame_flow.html)
- **Fitur Simulasi di Mockup:**
  - Simulasi **Multiplier Campaign**: Klik tombol "Generate T2I Start Frames" langsung berjalan tanpa popup, badge langsung berubah dari `⏸️ Fase 2 : Paused (Ready for Review)` (oranye) menjadi `⚡ Fase 1 : Generate Start Frame (1/4)` (hijau berkedip/pulse), dan toast notifikasi 10 detik muncul di pojok kanan bawah dengan progress bar countdown.
  - Simulasi **Pillar Campaign**: Klik tombol "Generate T2I Start Frames", badge langsung bertransisi menjadi `⚡ Fase 1 : Generate Start Frame` (hijau), dan toast notifikasi 10 detik muncul di pojok kanan bawah.
  - Reset simulasi dan toggle Dark/Light mode berbasis 100% semantic CSS tokens.

---

## 📋 Execution Task List

- [x] **Task 1: Perbaikan Multiplier Campaign UI (`app/multiplier-lab/[id]/page.js`)**
  - [x] Hapus `confirm(...)` pada `handleGenerateAllT2I`.
  - [x] Pasang elemen DOM toast `{toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message || toast.msg}</div>}` di JSX halaman.
  - [x] Perbarui helper `showToast` agar mendukung parameter durasi kustom (default 4000ms, kirim 10000ms untuk notifikasi start frame).
  - [x] Update `renderPhaseBadge` agar saat status `generating_t2i` atau `regenerate_start_frames_status === 'running'`, menampilkan label `⚡ Fase 1 : Generate Start Frame` dengan warna hijau (`var(--status-success)` dan `var(--status-success-soft)`).
  - [x] Berikan update optimis di `handleGenerateAllT2I` agar badge langsung berubah saat tombol diklik.

- [x] **Task 2: Penyelarasan Backend Multiplier API (`app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`)**
  - [x] Update DB saat regenerasi dimulai: set `status = 'generating_t2i'`, `regenerate_start_frames_status = 'running'`.
  - [x] Saat regenerasi seluruh start frame selesai di latar belakang: kembalikan `status = 'waiting_approval'`, `regenerate_start_frames_status = NULL`.

- [x] **Task 3: Perbaikan Pillar Campaign UI (`app/pillar-campaigns/[id]/page.js`)**
  - [x] Update `showToast` agar mendukung parameter durasi kustom (kirim 10000ms untuk regenerasi start frame).
  - [x] Update fungsi `renderItemStatus(item, campaign)` untuk menangani `workflow_status === 'start_frames_processing'`, `item.start_frame_status === 'processing'`, dan `item.regenerate_start_frames_status`: menampilkan badge `⚡ Fase 1 : Generate Start Frame` berwarna hijau (`var(--status-success)` dan `var(--status-success-soft)`).
  - [x] Berikan update optimis di `handleRegenerateAllSF` agar status item langsung berubah di UI sebelum respon server tiba.

- [x] **Task 4: Sinkronisasi Unit Tests & Pengujian Fungsional**
  - [x] Jalankan dan sesuaikan unit test pada `tests/multiplier-phase-recipe-card.test.js` atau test suite terkait.
  - [x] Verifikasi kestabilan build via linter / build check.

---

## 🔍 Before & After Code Snippets

### 1. `app/multiplier-lab/[id]/page.js`

#### A. Penghapusan Popup `confirm` & Toast 10 Detik
##### Code Sebelum (Current/Before):
```javascript
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerateAllT2I = async (taskId) => {
    if (!confirm('Apakah Anda yakin ingin meregenerasi semua start frame T2I untuk adegan ini di latar belakang?')) return;
    setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/regenerate-start-frames`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Proses regenerasi semua start frame telah dimulai di latar belakang.');
        fetchTasks(true);
      } else {
        showToast(data.error || 'Gagal memulai regenerasi massal.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: false }));
    }
  };
```

##### Code Sesudah (Proposed/After):
```javascript
  const toastTimeoutRef = useRef(null);
  const showToast = (message, type = 'success', duration = 4000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  };

  const handleGenerateAllT2I = async (taskId) => {
    // 1. Tanpa confirm() popup, langsung eksekusi di latar belakang
    setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: true }));
    // Optimistic UI: langsung ubah status task di state lokal menjadi Fase 1: Generate Start Frame
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      status: 'generating_t2i',
      regenerate_start_frames_status: 'running',
      regenerate_start_frames_progress: 'Memulai...'
    } : t));

    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/regenerate-start-frames`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        // Notifikasi toast di pojok kanan bawah selama 10 detik (10000ms)
        showToast('Proses regenerasi semua start frame telah dimulai di latar belakang.', 'success', 10000);
        fetchTasks(true);
      } else {
        showToast(data.error || 'Gagal memulai regenerasi massal.', 'error');
        fetchTasks(true);
      }
    } catch (err) {
      showToast(err.message, 'error');
      fetchTasks(true);
    } finally {
      setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: false }));
    }
  };
```

#### B. Perubahan Badge Status Menjadi "Fase 1 : Generate Start Frame" Warna Hijau
##### Code Sebelum (Current/Before):
```javascript
    case 'generating_t2i':
      text = '⚡ Fase 1 : Generasi T2I Start Frames';
      color = 'var(--status-info)';
      bg = 'var(--status-info-soft)';
      border = 'var(--status-info-soft)';
      isPulse = true;
      break;
    case 'waiting_approval':
      text = '⏸️ Fase 2 : Paused (Ready for Review)';
      color = 'var(--status-warning)';
      bg = 'var(--status-warning-soft)';
      border = 'var(--status-warning-soft)';
      break;
```

##### Code Sesudah (Proposed/After):
```javascript
    case 'generating_t2i':
      text = task.regenerate_start_frames_progress
        ? `⚡ Fase 1 : Generate Start Frame (${task.regenerate_start_frames_progress})`
        : '⚡ Fase 1 : Generate Start Frame';
      color = 'var(--status-success)';
      bg = 'var(--status-success-soft)';
      border = 'var(--status-success-soft)';
      isPulse = true;
      break;
    case 'waiting_approval':
      if (task.regenerate_start_frames_status === 'running' || batchRegeneratingSF[task.id]) {
        text = task.regenerate_start_frames_progress
          ? `⚡ Fase 1 : Generate Start Frame (${task.regenerate_start_frames_progress})`
          : '⚡ Fase 1 : Generate Start Frame';
        color = 'var(--status-success)';
        bg = 'var(--status-success-soft)';
        border = 'var(--status-success-soft)';
        isPulse = true;
      } else {
        text = '⏸️ Fase 2 : Paused (Ready for Review)';
        color = 'var(--status-warning)';
        bg = 'var(--status-warning-soft)';
        border = 'var(--status-warning-soft)';
      }
      break;
```

#### C. Render Elemen Toast di JSX Multiplier Lab
##### Code Sebelum (Current/Before):
```jsx
// Di return JSX app/multiplier-lab/[id]/page.js belum ada elemen toast
```

##### Code Sesudah (Proposed/After):
```jsx
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message || toast.msg}
        </div>
      )}
```

---

### 2. `app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`

#### Perubahan Status Database saat Memulai dan Selesai
##### Code Sebelum (Current/Before):
```javascript
    // Set status running and initial progress
    await dbRun(`
      UPDATE re_multiplier_tasks
      SET regenerate_start_frames_status = 'running',
          regenerate_start_frames_progress = ?
      WHERE id = ?
    `, [`0/${prompts.length}`, id]);
```

##### Code Sesudah (Proposed/After):
```javascript
    // Set status running, status = generating_t2i, and initial progress
    await dbRun(`
      UPDATE re_multiplier_tasks
      SET status = 'generating_t2i',
          regenerate_start_frames_status = 'running',
          regenerate_start_frames_progress = ?
      WHERE id = ?
    `, [`0/${prompts.length}`, id]);
```

Dan saat background task selesai di `runTaskRegenerateStartFramesBackground`:
##### Code Sebelum (Current/Before):
```javascript
    // Reset status after completion
    await dbRun(`
      UPDATE re_multiplier_tasks
      SET regenerate_start_frames_status = NULL,
          regenerate_start_frames_progress = NULL
      WHERE id = ?
    `, [taskId]).catch(() => {});
```

##### Code Sesudah (Proposed/After):
```javascript
    // Kembalikan ke waiting_approval (Paused Ready for Review) setelah selesai
    await dbRun(`
      UPDATE re_multiplier_tasks
      SET status = 'waiting_approval',
          regenerate_start_frames_status = NULL,
          regenerate_start_frames_progress = NULL
      WHERE id = ?
    `, [taskId]).catch(() => {});
```

---

### 3. `app/pillar-campaigns/[id]/page.js`

#### A. Dukungan Durasi Toast 10 Detik
##### Code Sebelum (Current/Before):
```javascript
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }
```

##### Code Sesudah (Proposed/After):
```javascript
  const toastTimeoutRef = useRef(null);
  function showToast(msg, type = 'success', duration = 3500) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ msg, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  }
```

#### B. Handler `handleRegenerateAllSF` dengan Durasi Toast 10 Detik & Optimistic Update
##### Code Sebelum (Current/Before):
```javascript
    const handleRegenerateAllSF = async () => {
      setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/regenerate-start-frames`, {
          method: 'POST'
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Regenerasi semua start frame telah dimulai di latar belakang.");
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal memulai regenerasi start frame.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: false }));
      }
    };
```

##### Code Sesudah (Proposed/After):
```javascript
    const handleRegenerateAllSF = async () => {
      setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: true }));
      // Optimistic update agar badge langsung bertransisi menjadi Fase 1: Generate Start Frame
      setItems(prev => prev.map(it => it.id === item.id ? {
        ...it,
        workflow_status: 'start_frames_processing',
        start_frame_status: 'processing',
        regenerate_start_frames_status: 'running'
      } : it));

      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/regenerate-start-frames`, {
          method: 'POST'
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Regenerasi semua start frame telah dimulai di latar belakang.", "success", 10000);
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal memulai regenerasi start frame.', 'error');
          fetchDetail();
        }
      } catch (err) {
        showToast(err.message, 'error');
        fetchDetail();
      } finally {
        setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: false }));
      }
    };
```

#### C. Render Item Status Badge Menjadi "Fase 1 : Generate Start Frame" Warna Hijau
##### Code Sebelum (Current/Before):
```javascript
    // 3. Active processing states
    else if (item.generation_status === 'processing') {
      text = item.generation_progress ? `⚡ Fase 1 : ${item.generation_progress}` : '⚡ Fase 1 : AI Generation';
      color = 'var(--accent-light)';
      bg = 'var(--status-info-soft)';
      pulse = true;
    }
    ...
    // 3.5 Paused Review
    else if (item.workflow_status === 'ready_for_review') {
      text = '⏸️ Fase 2 : Paused (Ready for Review)';
      color = 'var(--status-warning)';
      bg = 'rgba(243, 156, 18, 0.1)';
    }
```

##### Code Sesudah (Proposed/After):
```javascript
    // Start Frame Generation (Batch / Single)
    else if (
      item.workflow_status === 'start_frames_processing' ||
      item.start_frame_status === 'processing' ||
      ['queued', 'running'].includes(item.regenerate_start_frames_status) ||
      batchRegeneratingSF[item.id]
    ) {
      text = item.regenerate_start_frames_progress
        ? `⚡ Fase 1 : Generate Start Frame (${item.regenerate_start_frames_progress})`
        : '⚡ Fase 1 : Generate Start Frame';
      color = 'var(--status-success)';
      bg = 'var(--status-success-soft)';
      pulse = true;
    }
    // 3. Active processing states
    else if (item.generation_status === 'processing') {
      text = item.generation_progress ? `⚡ Fase 1 : ${item.generation_progress}` : '⚡ Fase 1 : AI Generation';
      color = 'var(--accent-light)';
      bg = 'var(--status-info-soft)';
      pulse = true;
    }
    ...
    // 3.5 Paused Review
    else if (item.workflow_status === 'ready_for_review') {
      text = '⏸️ Fase 2 : Paused (Ready for Review)';
      color = 'var(--status-warning)';
      bg = 'rgba(243, 156, 18, 0.1)';
    }
```
