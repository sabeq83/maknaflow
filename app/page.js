'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ContentFlowLogo from './components/ContentFlowLogo';
import ThemeToggle from './components/ThemeToggle';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('youtube');
  const [faqOpen, setFaqOpen] = useState({ 0: true });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});
  }, []);

  const toggleFaq = (index) => {
    setFaqOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const previewTabs = [
    {
      id: 'youtube',
      label: 'YouTube Studio',
      icon: '▶️',
      title: 'Cinematic Dual-Speaker Script & Voice Engine',
      desc: 'Orkestrasi naskah dialog multi-karakter dengan pemisahan narasi, panduan visual scene-by-scene, cue SFX, dan kloning suara ElevenLabs/EdgeTTS.'
    },
    {
      id: 'strategic',
      label: 'Single-Pass Engine',
      icon: '⚡',
      title: '1-Call Multi-Asset AI Generation',
      desc: 'Hasilkan Storyboard, Naskah Voice-Over, 10 Parameter Video DNA, Caption, Hashtags, dan CTA dalam 1x panggilan API Gemini AI berkecepatan tinggi.'
    },
    {
      id: 'multiplier',
      label: 'Multiplier Lab',
      icon: '🔬',
      title: 'Viral Hook Deconstruct & Multiplier',
      desc: 'Bedah pola video viral kompetitor, ekstrak formula psikologis, lalu kalikan menjadi 10+ variasi sudut pandang konten unik dalam hitungan detik.'
    },
    {
      id: 'autopilot',
      label: 'Autopilot & Multi-Node',
      icon: '🤖',
      title: 'Automated Rendering & Social Ingest',
      desc: 'Koneksi mulus Google Sheets ke pipeline rendering multi-node (Mac Mini + Windows GPU) dan publish otomatis ke TikTok, Facebook, & Instagram.'
    }
  ];

  const faqs = [
    {
      q: 'Apakah Web App ContentFlow terbuka untuk pendaftaran publik?',
      a: 'Tidak. ContentFlow saat ini beroperasi secara eksklusif sebagai sistem internal perusahaan (Internal Enterprise Platform) untuk mendukung operasional divisi kreatif, media, dan unit bisnis terverifikasi. Belum tersedia opsi registrasi mandiri untuk publik.'
    },
    {
      q: 'Apa itu Single-Pass Engine (1-Call Architecture) pada ContentFlow?',
      a: 'Single-Pass Engine adalah arsitektur pembuatan konten di mana seluruh elemen produksi (Storyboard, Naskah VO, 10 Parameter Visual DNA, Caption, Hashtags, dan CTA) di-generate sekaligus dalam 1x panggilan API AI berkecepatan tinggi, menghilangkan jeda antar-langkah dan menghemat kuota API hingga 70%.'
    },
    {
      q: 'Bagaimana arsitektur 3-Node Topology ContentFlow bekerja?',
      a: 'ContentFlow berjalan di atas kluster 3-Node: Node 1 (Mac Mini Staging/Dev sebagai API gateway & UI web), Node 2 (Windows Dedicated GPU Worker untuk rendering video & webhook), dan Node 3 (PostgreSQL Database Pusat terisolasi dengan koneksi pool aman).'
    },
    {
      q: 'Bagaimana keamanan dan kerahasiaan data konten internal perusahaan?',
      a: 'Seluruh materi, naskah, dan prompt diproses di bawah kebijakan ketat Zero Public AI Training (data tidak digunakan untuk melatih LLM publik) dan disimpan dalam schema database PostgreSQL terenkripsi dengan kontrol hak akses berbasis peran (RBAC).'
    },
    {
      q: 'Bagaimana cara staf atau tim internal mendapatkan akses ke ContentFlow?',
      a: 'Akses akun dibuatkan langsung oleh Superadministrator IT internal perusahaan. Staf yang berwenang dapat langsung masuk melalui tombol "Masuk ke Portal Internal" menggunakan kredensial yang telah diterbitkan.'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflowX: 'hidden' }}>

      {/* TOP FLOATING INTERNAL NOTICE BANNER */}
      <div
        style={{
          background: 'linear-gradient(90deg, #1e1b4b 0%, #0f172a 50%, #1e1b4b 100%)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#c7d2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          position: 'relative',
          zIndex: 100
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, color: '#e0e7ff', fontSize: '0.72rem', border: '1px solid rgba(129, 140, 248, 0.4)' }}>
          🔒 INTERNAL ENTERPRISE PLATFORM
        </span>
        <span>Aplikasi ini beroperasi khusus untuk penggunaan internal perusahaan &amp; staf terverifikasi. Belum terbuka untuk umum.</span>
        <Link href="/privacy" style={{ color: 'var(--link)', textDecoration: 'underline', fontWeight: 600, marginLeft: '4px' }}>
          Kebijakan Privasi
        </Link>
      </div>

      {/* STICKY GLASSMORPHIC NAVBAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          background: 'color-mix(in srgb, var(--canvas) 85%, transparent)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 28px'
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <ContentFlowLogo variant="horizontal" size="md" showTagline={true} />
          </Link>

          {/* Nav Links (Desktop) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>
              Fitur AI
            </a>
            <a href="#workflow" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>
              Alur Kerja
            </a>
            <a href="#architecture" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>
              Arsitektur 3-Node
            </a>
            <a href="#security" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>
              Keamanan Data
            </a>
            <a href="#faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '130px' }}>
              <ThemeToggle />
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ◈ Buka Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔑 Masuk ke Portal
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section
        style={{
          position: 'relative',
          padding: '80px 24px 70px 24px',
          background: 'radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.12) 0%, rgba(124, 58, 237, 0.08) 40%, transparent 80%)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '30px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: 'var(--link)',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '24px'
            }}
          >
            <span>⚡</span>
            <span>Next-Gen Enterprise AI Content Orchestration Engine</span>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
              margin: '0 0 20px 0',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            Create More. Do Less.{' '}
            <span
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, #00D2FF 0%, #3B82F6 40%, #A855F7 85%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '6px'
              }}
            >
              Powering Enterprise Video Production
            </span>
          </h1>

          {/* Subhead */}
          <p
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: '820px',
              margin: '0 auto 36px auto'
            }}
          >
            Platform orkestrasi konten AI internal berbasis <strong>Single-Pass Engine</strong> untuk naskah sinematik multi-speaker, sintesis audio ElevenLabs, video composition multi-node, dan penerbitan multi-kanal otomatis.
          </p>

          {/* CTA Group */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <Link
              href="/login"
              style={{
                padding: '14px 32px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s'
              }}
            >
              🚀 Masuk ke Portal Internal
            </Link>

            <a
              href="#features"
              style={{
                padding: '14px 26px',
                borderRadius: '12px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: '1.0rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔍 Jelajahi Fitur Engine
            </a>
          </div>

          {/* Key Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: '16px',
              background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(12px)',
              boxShadow: 'var(--shadow-card)',
              maxWidth: '900px',
              margin: '0 auto'
            }}
          >
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38BDF8' }}>10x</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Kecepatan Produksi</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#A855F7' }}>1-Call</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Single-Pass AI Engine</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4ADE80' }}>3-Node</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>High-Availability Cluster</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B' }}>100%</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tenant Data Isolation</div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE SHOWCASE SECTION */}
      <section style={{ padding: '60px 24px 80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--link)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ENGINE SHOWCASE
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', letterSpacing: '-0.03em' }}>
            Lihat Bagaimana ContentFlow Bekerja
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto' }}>
            Eksplorasi modul AI canggih yang dirancang untuk mengotomasi siklus hidup pembuatan konten video dari konsep hingga publikasi.
          </p>
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}
        >
          {previewTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(124, 58, 237, 0.25))' : 'var(--surface-raised)',
                border: activeTab === tab.id ? '1px solid #60A5FA' : '1px solid var(--border-subtle)',
                color: activeTab === tab.id ? '#93C5FD' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Showcase Box */}
        {previewTabs.map((tab) => {
          if (tab.id !== activeTab) return null;
          return (
            <div
              key={tab.id}
              style={{
                borderRadius: '20px',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                padding: '36px',
                boxShadow: 'var(--shadow-modal)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
                gap: '32px',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#93C5FD', fontSize: '0.78rem', fontWeight: 700, marginBottom: '12px' }}>
                  {tab.icon} {tab.label} Module
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  {tab.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
                  {tab.desc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--status-success)', fontWeight: 800 }}>✓</span>
                    <span>100% Parameter AI Terintegrasi Tanpa Copy-Paste Manual</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--status-success)', fontWeight: 800 }}>✓</span>
                    <span>Visual Identity Token & Persona Brand Terisolasi</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--status-success)', }}>
                    <span style={{ color: 'var(--status-success)', fontWeight: 800 }}>✓</span>
                    <span>Multi-Node Rendering Pipeline dengan Failover Otomatis</span>
                  </div>
                </div>

                <div style={{ marginTop: '28px' }}>
                  <Link
                    href="/login"
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      textDecoration: 'none',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Buka Modul Ini di Portal ➔
                  </Link>
                </div>
              </div>

              {/* Mockup Card */}
              <div
                style={{
                  background: 'var(--canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>engine://{tab.id}/pipeline</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', fontWeight: 700, background: 'var(--status-success-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                    ● LIVE CLUSTER
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  <div style={{ background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: '8px', color: '#93C5FD' }}>
                    &gt; INIT SINGLE_PASS_GENERATOR [Brand: Internal_Unit_01]
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: '8px', color: '#6EE7B7' }}>
                    &gt; AI PROMPT GENERATED: 10 Scene Visual Prompts + Multi-Speaker VO Script
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: '8px', color: '#C084FC' }}>
                    &gt; SYNTHESIS AUDIO: ElevenLabs Ultra-Realistic Model (Speed: 1.05x)
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: '8px', color: '#FDE047' }}>
                    &gt; RENDER DISPATCH: Node 2 (Windows Worker 100.117.59.92:8765)
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* CORE FEATURES GRID */}
      <section id="features" style={{ padding: '80px 24px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--link)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              CAPABILITIES
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', letterSpacing: '-0.03em' }}>
              Fitur Unggulan ContentFlow Engine
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '680px', margin: '0 auto' }}>
              Rangkaian alat lengkap untuk memproduksi konten bervolume tinggi dengan konsistensi DNA merek tanpa mengorbankan kualitas.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Feature 1 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🎬</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>Strategic &amp; Instant Campaigns</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Eksekusi naskah, visual prompts, dan social media metadata dalam 1x call AI tanpa pipeline bertingkat yang rentan error.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>▶️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>YouTube Studio &amp; Narrative</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Generator naskah sinematik multi-speaker, penandaan efek suara (SFX cues), dan penyesuaian durasi naskah per channel profile.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🔬</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>Deconstruct &amp; Multiplier Labs</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Analisis mendalam hook konten viral, ekstraksi pola psikologis audiens, dan multiplikasi variasi sudut pandang.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🤖</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>Sheets Autopilot &amp; Ingestion</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Impor massal dari Google Sheets, validasi otomatis, dan penjadwalan langsung ke pipeline rendering multi-node.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🏰</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>Universe &amp; Visual Identity</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Kelola persona brand, karakter universe visual, dan pedoman gaya agar video konsisten di seluruh portofolio produk.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '28px', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🖥️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0' }}>3-Node Distributed Cluster</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                Topologi server terdistribusi dengan Mac Mini UI Gateway, Windows GPU Render Worker, dan PostgreSQL Database Cluster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW SECTION */}
      <section id="workflow" style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--link)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ALUR KERJA
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', letterSpacing: '-0.03em' }}>
            Dari Ide Menjadi Konten Siap Tayang dalam 4 Langkah
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto' }}>
            Alur otomatisasi yang dirancang untuk efisiensi tim kreator dan penghematan waktu hingga 90%.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {/* Step 1 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.15)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '12px' }}>
              LANGKAH 01
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0' }}>Grounding DNA Brand</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Pilih brand, universe karakter, dan profil persona audiens dari repositori terpusat.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#A855F7', background: 'rgba(168, 85, 247, 0.15)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '12px' }}>
              LANGKAH 02
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0' }}>AI Single-Pass Synthesis</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              AI memproses naskah narasi, visual prompt scene-by-scene, dan suara voice-over multi-speaker.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4ADE80', background: 'rgba(74, 222, 128, 0.15)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '12px' }}>
              LANGKAH 03
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0' }}>Multi-Node Video Render</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Tugas render dikirim ke GPU Worker Node untuk komposisi audio-visual dan subtitle otomatis.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px', position: 'relative' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '12px' }}>
              LANGKAH 04
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0' }}>Publish &amp; Track</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
              Konten siap tayang disalurkan ke pipeline TikTok, FB, IG dengan pelacakan status real-time.
            </p>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE & SECURITY SECTION */}
      <section id="architecture" style={{ padding: '80px 24px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '40px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--link)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              INFRASTRUKTUR &amp; KEAMANAN
            </span>
            <h2 style={{ fontSize: '2.0rem', fontWeight: 800, margin: '8px 0 16px 0', letterSpacing: '-0.03em' }}>
              Keamanan Data Kelas Enterprise &amp; Isolasi Multi-Tenant
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '20px' }}>
              ContentFlow dibangun dengan standar ketat untuk menjamin kerahasiaan materi kreatif perusahaan:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700 }}>Zero Public AI Training</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Seluruh prompt dan aset video internal tidak digunakan untuk melatih LLM publik pihak ketiga.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700 }}>Isolated Database Schemas</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pemisahan data tingkat tenant dalam PostgreSQL terenkripsi (Staging, Dev, &amp; Production terisolasi).</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', color: '#C084FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700 }}>Role-Based Access Control (RBAC)</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Izin akses modular granular per divisi, operator, admin, dan superadmin.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Node Topology Diagram Card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🖥️ 3-NODE CLUSTER TOPOLOGY</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', fontWeight: 700 }}>HEALTHY (3/3 ONLINE)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Node 1: Mac Mini Gateway</span>
                  <span style={{ fontSize: '0.7rem', color: '#93C5FD', background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>Port 5010 / 7010</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Next.js UI &amp; Express API Gateway with PM2 Orchestration</div>
              </div>

              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Node 2: Windows GPU Worker</span>
                  <span style={{ fontSize: '0.7rem', color: '#6EE7B7', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>Port 8765</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dedicated Video Composition &amp; Webhook Processor</div>
              </div>

              <div style={{ background: 'var(--canvas)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Node 3: PostgreSQL Database</span>
                  <span style={{ fontSize: '0.7rem', color: '#C084FC', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>Port 5432</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Central Encrypted Multi-Tenant DB Storage with Connection Pool</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" style={{ padding: '80px 24px', maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--link)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 style={{ fontSize: '2.0rem', fontWeight: 800, margin: '8px 0 10px 0', letterSpacing: '-0.03em' }}>
            Pertanyaan Umum Seputar ContentFlow
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Informasi mengenai akses internal, teknologi, dan kepatuhan sistem.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                borderRadius: '14px',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}
            >
              <button
                onClick={() => toggleFaq(i)}
                style={{
                  width: '100%',
                  padding: '18px 22px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '0.98rem',
                  fontWeight: 700
                }}
              >
                <span>{faq.q}</span>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', transform: faqOpen[i] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  ▾
                </span>
              </button>

              {faqOpen[i] && (
                <div style={{ padding: '0 22px 20px 22px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section
        style={{
          padding: '70px 24px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93C5FD', fontSize: '0.78rem', fontWeight: 700, marginBottom: '16px' }}>
            🔒 Internal Access Only
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0 0 14px 0', letterSpacing: '-0.03em' }}>
            Create More. Do Less.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 28px 0' }}>
            Akselerasi pipeline konten internal perusahaan Anda dengan kecerdasan buatan terpadu.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                padding: '14px 32px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '1.0rem',
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)'
              }}
            >
              🔑 Masuk ke Portal Internal
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: 'var(--canvas)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '40px 24px 30px 24px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', marginBottom: '28px' }}>
            <div>
              <ContentFlowLogo variant="horizontal" size="sm" showTagline={true} />
              <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Internal Enterprise AI Content Orchestration Engine • URL: <a href="https://contentflow-stg.ast402.my.id" style={{ color: 'var(--link)', textDecoration: 'none' }}>contentflow-stg.ast402.my.id</a>
              </p>
            </div>

            {/* Quick Links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <Link href="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
                Terms of Service
              </Link>
              <Link href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
                Privacy Policy
              </Link>
              <Link href="/system-health" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
                System Health
              </Link>
              <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
                Internal Login
              </Link>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem' }}>
            <div>
              © 2026 ContentFlow Platform. Proprietary Internal System. All rights reserved.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
              <span>All Systems Operational (Staging Cluster)</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
