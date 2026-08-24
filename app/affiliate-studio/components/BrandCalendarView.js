'use client';

import styles from './AffiliateStudio.module.css';

export function BrandCalendarView({ events = [], loading }) {
  return (
    <div className={styles.plannerConnectionWrapper}>
      <div className={styles.calendarSection} style={{ marginTop: 0 }}>
        <div className={styles.blockHeader}>
          <h3>Brand-Wide Editorial Calendar</h3>
          {loading && <span className={styles.smallLoading}>Loading calendar...</span>}
        </div>
        
        {!loading && events.length === 0 ? (
          <div className={styles.emptyStateLight}>
            <p>Belum ada jadwal tayang konten terdaftar untuk brand profile ini. Hubungkan planner dan jadwalkan tanggal tayang di menu detail Kampanye.</p>
          </div>
        ) : (
          <div className={styles.calendarGridList}>
            {events.map(ev => (
              <div key={ev.id} className={styles.calendarEventCard}>
                <div className={styles.eventCardHeader}>
                  <span className={styles.eventDate}>{new Date(ev.date).toLocaleDateString()}</span>
                  <span className={`${styles.eventFunnelBadge} ${styles['funnel_' + ev.funnelStage]}`}>
                    {ev.funnelStage}
                  </span>
                </div>
                <div className={styles.eventTitle} style={{ fontWeight: 'bold', margin: '4px 0' }}>{ev.title}</div>
                <div className={styles.eventCategory}>
                  Pillar: <strong>{ev.pillar}</strong> | Category: {ev.category}
                </div>
                <div className={styles.eventProduct}>
                  Product Focus: <strong>{ev.product}</strong>
                </div>
                <div className={styles.eventPlatformBadge}>
                  Platform: <span className={styles.engineBadge}>{ev.platform?.toUpperCase()}</span>
                </div>
                {ev.context && (
                  <div className={styles.mutedText} style={{ fontStyle: 'italic', fontSize: '12px', marginTop: '6px' }}>
                    "{ev.context}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
