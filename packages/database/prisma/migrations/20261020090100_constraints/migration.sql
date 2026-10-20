ALTER TABLE licensing."Product" ADD CONSTRAINT positive_price CHECK (price >= 0);
ALTER TABLE licensing."Order" ADD CONSTRAINT positive_total CHECK (total >= 0);
ALTER TABLE licensing."OrderItem" ADD CONSTRAINT valid_quantity CHECK (quantity BETWEEN 1 AND 10);
ALTER TABLE licensing."OrderItem" ADD CONSTRAINT valid_item_price CHECK (price >= 0);
ALTER TABLE licensing."ConfigVersion" ADD CONSTRAINT valid_segments CHECK ("segmentCount" BETWEEN 1 AND 8 AND "segmentLength" BETWEEN 1 AND 16);
ALTER TABLE licensing."ConfigVersion" ADD CONSTRAINT valid_validity CHECK ("validityDays" IS NULL OR "validityDays" > 0);
CREATE FUNCTION licensing.reject_version_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Configuration versions are immutable'; END;
$$;
CREATE TRIGGER immutable_version BEFORE UPDATE ON licensing."ConfigVersion" FOR EACH ROW EXECUTE FUNCTION licensing.reject_version_update();
