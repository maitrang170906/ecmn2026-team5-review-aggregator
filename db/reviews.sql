-- ============================================================================
-- Team 5 — reviews table (standalone script)
-- ============================================================================
-- Use this when your database already exists (Docker volume already created,
-- or XAMPP/phpMyAdmin) and you do not want to wipe it:
--   docker compose exec -T mysql mysql -uappuser -papppassword minimal_app_db < db/reviews.sql
--   or: phpMyAdmin > minimal_app_db > Import > db/reviews.sql
-- Safe to run several times.

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  source VARCHAR(32) NOT NULL,
  review_id VARCHAR(64) NOT NULL,
  author VARCHAR(100) NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  body TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (product_id, source, review_id),
  INDEX idx_reviews_product_created (product_id, created_at),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
