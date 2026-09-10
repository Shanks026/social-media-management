ALTER TABLE posts
ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);;
