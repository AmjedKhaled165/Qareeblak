-- Create courier_supervisors table for many-to-many relationship
CREATE TABLE IF NOT EXISTS courier_supervisors (
    courier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (courier_id, supervisor_id)
);

-- Migrate existing data
INSERT INTO courier_supervisors (courier_id, supervisor_id)
SELECT id, supervisor_id
FROM users
WHERE supervisor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_courier_supervisors_courier ON courier_supervisors(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_supervisors_supervisor ON courier_supervisors(supervisor_id);
