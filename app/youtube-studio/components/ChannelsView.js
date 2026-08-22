import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';

export function ChannelsView({
  channels,
  newChannelName,
  setNewChannelName,
  newChannelLocale,
  setNewChannelLocale,
  onCreateChannel,
  onOpenChannel
}) {
  return (
    <div className={styles.channelsView}>
      <section className={styles.viewSection}>
        <div className={styles.sectionHeader}>
          <h2>YouTube Channels</h2>
          <p className={styles.sectionDesc}>Select a channel profile to manage strategy, content series, and production.</p>
        </div>

        {channels.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📺</span>
            <h3>No Channels Yet</h3>
            <p>Create a channel profile on the right to start building your AI channel strategy.</p>
          </div>
        ) : (
          <div className={styles.channelsGrid}>
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={styles.channelCard}
                onClick={() => onOpenChannel(channel)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.channelCardHeader}>
                  <span className={styles.channelIcon}>📺</span>
                  <span className={styles.channelLocale}>{normalizeLocale(channel.primary_locale)}</span>
                </div>
                <h3 className={styles.channelName}>{channel.name}</h3>
                <div className={styles.channelCardFooter}>
                  <span className={styles.viewDetailsLink}>Open Workspace →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.createChannelPanel}>
        <div className={styles.panelHeader}>
          <h3>Create Channel Profile</h3>
        </div>
        <div className={styles.panelForm}>
          <div className={styles.formGroup}>
            <label htmlFor="channel-name">Channel Name</label>
            <input
              id="channel-name"
              className={styles.input}
              type="text"
              placeholder="e.g. Makna Tech Insights"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="channel-locale">Locale</label>
            <input
              id="channel-locale"
              className={styles.input}
              type="text"
              placeholder="e.g. id-ID"
              value={newChannelLocale}
              onChange={(e) => setNewChannelLocale(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!newChannelName}
            onClick={onCreateChannel}
          >
            Create Channel
          </button>
        </div>
      </section>
    </div>
  );
}
