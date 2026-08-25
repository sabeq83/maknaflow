import { getPgPool, pgQuery } from './lib/db-pg.js';
import { loadDbCaches } from './lib/db.js';

async function run() {
  const pool = getPgPool();
  const channelId = 'ytc_w2jhxg1q';
  const strategyId = 'yts_lun6fbvz';

  try {
    await loadDbCaches();

    console.log('1. Updating youtube_channels primary_locale to en-US...');
    await pgQuery(`
      UPDATE youtube_channels 
      SET primary_locale = 'en-US', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [channelId]);

    console.log('2. Defining new localized English strategy JSONs...');
    const brief_json = {
      niche: "Pet",
      audience: "Children aged 6-12",
      geography: "United States",
      objective: "AdSense",
      universe_id: "87d0c0ec-32f7-45fd-a1df-93f9d2a8ce2d",
      forbidden_claims: null,
      brand_constraints: null,
      visual_identity_preset_id: null,
      default_target_duration_seconds: 300
    };

    const config_json = {
      positioning: "A cheerful, kids-friendly, and safe pet entertainment and education channel for children in the United States.",
      cta_strategy: "Invite children to press the Subscribe and Bell button with cheerful avatar characters, and ask them to answer quiz questions in the comments section with the help of parents.",
      video_format: {
        cadence: "weekly",
        default_target_duration_seconds: 300
      },
      editorial_tone: "Cheerful, kids-friendly, family-friendly, educational, enthusiastic, and safe.",
      content_pillars: [
        {
          name: "Adventure & Pet Stories",
          purpose: "Entertaining young viewers with exciting and funny stories of pets' daily lives.",
          example_angles: [
            "A Day in the Life of a Super Mischievous Orange Cat",
            "The White Rabbit's Adventure to Find the Magic Carrot in the Garden"
          ]
        },
        {
          name: "Edu-care for Young Pets",
          purpose: "Teaching concepts of responsibility and affection towards pets with easy-to-understand language.",
          example_angles: [
            "Easy Ways to Bathe a Cat Without Fear of Scratching",
            "5 Healthy and Safe Foods for Your Beloved Dog"
          ]
        },
        {
          name: "Animal Quizzes & Fun Facts",
          purpose: "Increasing engagement and curiosity in children through interactive guesses.",
          example_angles: [
            "Guess the Pet Sound: How Many Can You Answer?",
            "Unique Facts About Why Cats Love to Sleep in Boxes"
          ]
        }
      ],
      risk_guardrails: [
        "Must comply with COPPA regulations and YouTube's kids-friendly/family-friendly content guidelines.",
        "Forbidden to show acts of violence, neglect, or danger to animals.",
        "Do not display high-risk actions that can be imitated by children without adult supervision.",
        "Avoid giving professional veterinary medical advice without a clear disclaimer."
      ],
      audience_persona: {
        who: "Elementary school children aged 6-12 in the United States who love pets like cats, dogs, rabbits, and hamsters.",
        need: "Fun visual entertainment as well as simple lessons on how to love and care for pets safely.",
        geography: "United States"
      },
      monetization_path: [
        "adsense"
      ]
    };

    console.log('3. Updating youtube_channel_strategies in database...');
    await pgQuery(`
      UPDATE youtube_channel_strategies 
      SET brief_json = $1, config_json = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
    `, [JSON.stringify(brief_json), JSON.stringify(config_json), strategyId]);

    console.log('Successfully localized Channel PawVille Story and its Strategy in the dev database!');

  } catch (e) {
    console.error('Localization update failed:', e);
  } finally {
    await new Promise(r => setTimeout(r, 1000));
    await pool.end();
  }
}

run();
