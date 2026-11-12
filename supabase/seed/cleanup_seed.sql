-- Removes every seed user and, via ON DELETE CASCADE, all their profiles, preferences, photos,
-- prompts, listings, swipes, matches, messages, reports/blocks and push tokens.
-- Real users (without raw_app_meta_data.seed = true) are never touched.
delete from auth.users u where u.raw_app_meta_data ->> 'seed' = 'true';
