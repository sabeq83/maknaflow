CREATE SEQUENCE IF NOT EXISTS re_campaign_items_id_seq;
ALTER TABLE re_campaign_items ALTER COLUMN id SET DEFAULT nextval('re_campaign_items_id_seq');
SELECT setval('re_campaign_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM re_campaign_items), 0) + 1, 1), false);

CREATE SEQUENCE IF NOT EXISTS bridge_injector_items_id_seq;
ALTER TABLE bridge_injector_items ALTER COLUMN id SET DEFAULT nextval('bridge_injector_items_id_seq');
SELECT setval('bridge_injector_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM bridge_injector_items), 0) + 1, 1), false);
