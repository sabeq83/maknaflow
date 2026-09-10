'use client';

import React from 'react';
import Image from 'next/image';

/**
 * ContentFlow Vector Icon
 */
export function ContentFlowIcon({ size = 36, className = '' }) {
  const uniqueId = React.useId().replace(/:/g, '_');
  const gradOuter = `cf_grad_outer_${uniqueId}`;
  const gradPlay = `cf_grad_play_${uniqueId}`;
  const gradStream = `cf_grad_stream_${uniqueId}`;
  const gradBox1 = `cf_grad_box1_${uniqueId}`;
  const gradBox2 = `cf_grad_box2_${uniqueId}`;
  const gradBox3 = `cf_grad_box3_${uniqueId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        {/* Outer C Gradient: Cyan -> Blue -> Purple/Violet */}
        <linearGradient id={gradOuter} x1="15%" y1="90%" x2="85%" y2="10%">
          <stop offset="0%" stopColor="#00D2FF" />
          <stop offset="35%" stopColor="#2563EB" />
          <stop offset="70%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Play Triangle Gradient */}
        <linearGradient id={gradPlay} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Stream Gradient */}
        <linearGradient id={gradStream} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0.9" />
        </linearGradient>

        {/* Floating Box Gradients */}
        <linearGradient id={gradBox1} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={gradBox2} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D2FF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={gradBox3} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {/* Stylized Outer 'C' Curve */}
      <path
        d="M62 25 C40 25 24 39 24 60 C24 81 40 95 62 95 C74 95 84 89 90 80 C87 77 82 75 76 77 C71 82 64 85 57 85 C42 85 34 74 34 60 C34 46 42 35 57 35 C64 35 70 38 74 43 C79 45 85 43 89 39 C83 30 73 25 62 25 Z"
        fill={`url(#${gradOuter})`}
      />

      {/* Sparkle Star on top right */}
      <path
        d="M86 16 C86 21 89 24 94 24 C89 24 86 27 86 32 C86 27 83 24 78 24 C83 24 86 21 86 16 Z"
        fill="#818CF8"
      />

      {/* Central Play Button Triangle */}
      <path
        d="M48 45 L68 59 L48 73 Z"
        fill={`url(#${gradPlay})`}
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 3 Flow Motion Trails */}
      {/* Top stream */}
      <path
        d="M68 53 Q80 50 90 38"
        stroke={`url(#${gradStream})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Middle stream */}
      <path
        d="M72 59 Q83 59 96 59"
        stroke={`url(#${gradStream})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bottom stream */}
      <path
        d="M68 65 Q80 68 90 80"
        stroke={`url(#${gradStream})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* 3 Floating Rounded Particle Squares */}
      {/* Top box */}
      <rect x="91" y="30" width="14" height="14" rx="3.5" fill={`url(#${gradBox1})`} />
      {/* Middle box */}
      <rect x="97" y="52" width="14" height="14" rx="3.5" fill={`url(#${gradBox2})`} />
      {/* Bottom box */}
      <rect x="91" y="74" width="14" height="14" rx="3.5" fill={`url(#${gradBox3})`} />
    </svg>
  );
}

/**
 * Main ContentFlow Logo Component
 * @param {'icon-only' | 'horizontal' | 'stacked'} variant
 * @param {'sm' | 'md' | 'lg' | 'xl'} size
 * @param {boolean} showTagline
 * @param {boolean} useImageLogo
 */
export default function ContentFlowLogo({
  variant = 'horizontal',
  size = 'md',
  showTagline = true,
  useImageLogo = false,
  className = '',
  style = {}
}) {
  const sizeMap = {
    sm: { icon: 28, titleSize: '1.1rem', tagSize: '0.62rem', gap: '8px' },
    md: { icon: 38, titleSize: '1.45rem', tagSize: '0.72rem', gap: '10px' },
    lg: { icon: 54, titleSize: '2.0rem', tagSize: '0.85rem', gap: '14px' },
    xl: { icon: 72, titleSize: '2.6rem', tagSize: '1.05rem', gap: '18px' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  if (variant === 'icon-only') {
    if (useImageLogo) {
      return (
        <div style={{ width: currentSize.icon, height: currentSize.icon, position: 'relative', ...style }} className={className}>
          <Image
            src="/images/contentflow-logo.png"
            alt="ContentFlow"
            width={currentSize.icon}
            height={currentSize.icon}
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            priority
          />
        </div>
      );
    }
    return <ContentFlowIcon size={currentSize.icon} className={className} />;
  }

  if (variant === 'stacked') {
    return (
      <div
        className={`cf-logo-stacked ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '6px',
          ...style
        }}
      >
        <div style={{ position: 'relative' }}>
          <ContentFlowIcon size={currentSize.icon} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              fontSize: currentSize.titleSize,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>content</span>
            <span
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
                fontWeight: 900
              }}
            >
              flow
            </span>
          </span>
          {showTagline && (
            <span
              style={{
                fontSize: currentSize.tagSize,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                marginTop: '4px',
                textTransform: 'uppercase',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            >
              Create More. Do Less.
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal
  return (
    <div
      className={`cf-logo-horizontal ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: currentSize.gap,
        ...style
      }}
    >
      <ContentFlowIcon size={currentSize.icon} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            fontSize: currentSize.titleSize,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          <span style={{ color: 'var(--text-primary)' }}>content</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
              fontWeight: 900
            }}
          >
            flow
          </span>
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: currentSize.tagSize,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              marginTop: '2px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            Create More. Do Less.
          </span>
        )}
      </div>
    </div>
  );
}
