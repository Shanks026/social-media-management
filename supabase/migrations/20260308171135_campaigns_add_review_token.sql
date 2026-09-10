
ALTER TABLE campaigns
ADD COLUMN review_token UUID DEFAULT gen_random_uuid() UNIQUE;

UPDATE campaigns SET review_token = gen_random_uuid() WHERE review_token IS NULL;
;
