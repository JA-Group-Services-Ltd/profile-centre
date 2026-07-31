PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  object_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received
  ON stripe_webhook_events(received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
  ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

INSERT INTO app_settings (key,value,is_secret,updated_at)
VALUES ('schema_version','5',0,CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value='5',is_secret=0,updated_at=CURRENT_TIMESTAMP;
