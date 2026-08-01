-- ====================================================
-- Qareeblak Database Schema Update and Data Insertion
-- ====================================================

-- 1. Alter Schema to add flexible columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);

-- 2. Insert Users Data

-- User: حالا
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حالا', 'halan', 'halan@halan.com', '$2a$10$emXZr.aUV5BYK1BfNlgLHeCkYcbm3tW24O671fyx9sBuQWiDtMhrG', '01012345678', 'partner_owner', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حاتم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حاتم', 'hatem', 'hatem@halan.com', '$2a$10$OH.5DP/fI5i13rPvYjyL8.cYn4XtMdSK27LQbC3hbAgDHhlAQ/Eea', '01122334455', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حسين
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حسين', 'hussein', 'hussein@halan.com', '$2a$10$kjhBFoBc5D8RTMnVVWT4Lez0bVx26Wj1SrY/u0vuZULU3sM03hhIS', '01277889900', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: أشرف
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('أشرف', 'ashraf', 'ashraf@halan.com', '$2a$10$XjUmIFJvRonXd53wacbsx.3OHmCJOjKjHEJB.gyPAs6yNNeEP0QIq', '01555667788', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: محمد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('محمد', 'mohamed', 'mohamed@halan.com', '$2a$10$XQEGpC1Yd3KHIx4ecxWIS.lrgo50FSMAIzHkTzz9uhXXsU6nWgsvu', '01099887766', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: عمر
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('عمر', 'omar', 'omar@courier.com', '$2a$10$L4NppCh5Wc0dDcvGuxJB0OVfqt3SjcTnCuGSBBSnQdpivku1PyC6u', '01144556622', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: ياسين
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('ياسين', 'yassin', 'yassin@courier.com', '$2a$10$I3YF6M0Z7f6WWqTBe.rBcOB22y79/DvPxuKmbBVKqiQt6dnauqbGu', '01288990011', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حمزة
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حمزة', 'hamza', 'hamza@courier.com', '$2a$10$oZDYCF8.995FZTlUJXJhXeTB.1GX0xQtMrBzFBztqsTcl9zFIlILS', '01066778899', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: زياد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('زياد', 'ziad', 'ziad@courier.com', '$2a$10$wsHqJqKPkpKuTZcjw2az9Ov1P5A4FSA6y5pH.i5K0INVY2/49a8Ly', '01500112233', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: سيف
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('سيف', 'seif', 'seif@courier.com', '$2a$10$coD/4kz0iKE421BXlUtX6.G1sdllcY3wAJvdGFE4HBgmDFM54mj/i', '01122112233', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: آدم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('آدم', 'adam', 'adam@courier.com', '$2a$10$H3jE8A9dp.GFZecmnGg22uYgIflYHspkF5lFqRDlgcbllXbJE9AJy', '01233445566', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: يحيى
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('يحيى', 'yehia', 'yehia@courier.com', '$2a$10$mGfO9NxTPYYouW8HvrAiZeeb.f7Aq7PpMWDMdzm4EIspSYiXv97BS', '01044332211', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: بلال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('بلال', 'belal', 'belal@courier.com', '$2a$10$10kEm9nHRztFyilIc5OsTejqfaI6bwqNxsx44ExX0lHGFGBVkWKsC', '01555443322', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: أنس
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('أنس', 'anas', 'anas@courier.com', '$2a$10$14RyJiyqpbSZ4H2Rrh.xv.gPEYQQjdLVRU24mblza6kpnFGADFyGW', '01199880077', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: مروان
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مروان', 'marwan', 'marwan@courier.com', '$2a$10$aJZbgTiV5h8q7yl2MYbQIusKpcMQ3fw/YqB1dSVW21J8NEKAN06HW', '01200998877', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: طارق حسن
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('طارق حسن', 'tarek.food', 'tarek.food@example.com', '$2a$10$874ePjv3OQpuZN1Nb130vennjthYQ5WhVRoPn5n8XC4n0RAk.JcVK', '01011223344', 'provider', 'الحي الأول، المجاورة الثانية، عمارة 15', 'تقديم أشهى المأكولات والمشروبات')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'طارق حسن', 'tarek.food@example.com', 'مطاعم وكافيهات', 'الحي الأول، المجاورة الثانية، عمارة 15', '01011223344', 'تقديم أشهى المأكولات والمشروبات', 'الحي الأول، المجاورة الثانية، عمارة 15'
FROM users WHERE email = 'tarek.food@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: مصطفى كمال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مصطفى كمال', 'mostafa.maint', 'mostafa.maint@example.com', '$2a$10$1NSyThupE5R35IiIJsuyt.Km7vyHi1SwSnWH0yvTGqWKeVBoVUNhq', '01155667788', 'provider', 'الحي الثاني، المجاورة الرابعة، محل 3', 'صيانة فورية لأعطال الكهرباء والسباكة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'مصطفى كمال', 'mostafa.maint@example.com', 'صيانة وسباكة', 'الحي الثاني، المجاورة الرابعة، محل 3', '01155667788', 'صيانة فورية لأعطال الكهرباء والسباكة', 'الحي الثاني، المجاورة الرابعة، محل 3'
FROM users WHERE email = 'mostafa.maint@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: د. خالد عبدالرحمن
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('د. خالد عبدالرحمن', 'khaled.pharma', 'khaled.pharma@example.com', '$2a$10$RplgoCc6M74HcZe.rfNYFe8y4YzasG3.Uh2mNJ8GiAbSmfjCLp3uC', '01233445577', 'provider', 'الحي الثالث، المجاورة الأولى، ميدان الزهور', 'صيدلية متكاملة وخدمات طبية')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'د. خالد عبدالرحمن', 'khaled.pharma@example.com', 'صيدليات', 'الحي الثالث، المجاورة الأولى، ميدان الزهور', '01233445577', 'صيدلية متكاملة وخدمات طبية', 'الحي الثالث، المجاورة الأولى، ميدان الزهور'
FROM users WHERE email = 'khaled.pharma@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: محمود جمال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('محمود جمال', 'mahmoud.cars', 'mahmoud.cars@example.com', '$2a$10$iFQwlW1L0TAHW2Pa1.bvcu2h5Qrw3BAGhOPCwdxue5/DiHHWUTSJa', '01555668899', 'provider', 'المنطقة الصناعية، بلوك 4، ورشة 12', 'غسيل سيارات، تغيير زيوت، فحص دوري')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'محمود جمال', 'mahmoud.cars@example.com', 'خدمات سيارات', 'المنطقة الصناعية، بلوك 4، ورشة 12', '01555668899', 'غسيل سيارات، تغيير زيوت، فحص دوري', 'المنطقة الصناعية، بلوك 4، ورشة 12'
FROM users WHERE email = 'mahmoud.cars@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: إبراهيم سعيد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('إبراهيم سعيد', 'ibrahim.market', 'ibrahim.market@example.com', '$2a$10$6m1LeIDEMeY5goVydmVA7.sR7Ok7i7OumIouS70viSq1EZB1R95o.', '01099887755', 'provider', 'الحي الرابع، المجاورة الثالثة، السوق التجاري', 'توفير جميع السلع الغذائية والاستهلاكية')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'إبراهيم سعيد', 'ibrahim.market@example.com', 'سوبر ماركت', 'الحي الرابع، المجاورة الثالثة، السوق التجاري', '01099887755', 'توفير جميع السلع الغذائية والاستهلاكية', 'الحي الرابع، المجاورة الثالثة، السوق التجاري'
FROM users WHERE email = 'ibrahim.market@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: علي منصور
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('علي منصور', 'ali.laundry', 'ali.laundry@example.com', '$2a$10$kFuCd/dt1lXYYJEYgcYSSu1ghDDFBYlpzJmzmcj3lJJd3JGasrFTC', '01122334477', 'provider', 'الحي الخامس، سنتر المدينة، محل 5', 'غسيل، كي، وتنظيف سجاد')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'علي منصور', 'ali.laundry@example.com', 'مغسلة', 'الحي الخامس، سنتر المدينة، محل 5', '01122334477', 'غسيل، كي، وتنظيف سجاد', 'الحي الخامس، سنتر المدينة، محل 5'
FROM users WHERE email = 'ali.laundry@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: يوسف طارق
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('يوسف طارق', 'youssef.client', 'youssef.client@example.com', '$2a$10$bhdQAdoMFqY2YRXfqX.aceDpo5Nx.hzEkZ.uhREHPeqAtuIK0AhTO', '01088774433', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: ندى إبراهيم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('ندى إبراهيم', 'nada.customer', 'nada.customer@example.com', '$2a$10$id.onQwHZcKj2DMn1XzGQ.imvo1UOxIDkQ2ImCjurMqHKB7GMwT9G', '01155992211', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: مصطفى السيد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مصطفى السيد', 'mostafa.user', 'mostafa.user@example.com', '$2a$10$FBQdwUmFbGKEeiZKrtAQo.a7DH9f6MBtaTPEWgFe/31vAD4GiOGNy', '01222334488', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: كابتن أحمد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('كابتن أحمد', 'ahmed.pitch', 'ahmed.pitch@example.com', '$2a$10$wGFR2emmyGRiSOubFbBkY.rQMntyn.2xSXw21UsLQ/.iuUt5vvF0y', '01011223388', 'provider', 'نادي النجوم، الحي السابع', 'حجز ملاعب خماسية مجهزة على أعلى مستوى')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'كابتن أحمد', 'ahmed.pitch@example.com', 'ملاعب', 'نادي النجوم، الحي السابع', '01011223388', 'حجز ملاعب خماسية مجهزة على أعلى مستوى', 'نادي النجوم، الحي السابع'
FROM users WHERE email = 'ahmed.pitch@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: د. مصطفى
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('د. مصطفى', 'mostafa.doc', 'mostafa.doc@example.com', '$2a$10$FZy64N0BbOxBtqSnBkWQbO.9Xq/mKbJZkWNze3iGQXU3209Fn4vMq', '01122334499', 'provider', 'عيادات الشفاء، المجاورة الثانية', 'كشوفات طبية وتمريض منزلي على مدار الساعة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'د. مصطفى', 'mostafa.doc@example.com', 'دكتور وممرض', 'عيادات الشفاء، المجاورة الثانية', '01122334499', 'كشوفات طبية وتمريض منزلي على مدار الساعة', 'عيادات الشفاء، المجاورة الثانية'
FROM users WHERE email = 'mostafa.doc@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: علي للتوصيل
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('علي للتوصيل', 'ali.delivery', 'ali.delivery@example.com', '$2a$10$mdi..UGtHeV8aaliwNjkV.ixNUIwYCYQgorPQpmn01E1RsdyRX9xK', '01233445500', 'provider', 'موقف السيارات الرئيسي', 'توصيل أفراد ومشاوير خاصة بسيارات حديثة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'علي للتوصيل', 'ali.delivery@example.com', 'سيارات توصيل', 'موقف السيارات الرئيسي', '01233445500', 'توصيل أفراد ومشاوير خاصة بسيارات حديثة', 'موقف السيارات الرئيسي'
FROM users WHERE email = 'ali.delivery@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- Update existing categories to perfectly match frontend tabs
UPDATE providers SET category = 'صيانة وسباكة' WHERE category = 'صيانة';
UPDATE providers SET category = 'مطاعم وكافيهات' WHERE category = 'مطاعم';
UPDATE providers SET category = 'صيدليات' WHERE category = 'طبي' AND email = 'khaled.pharma@example.com';
UPDATE providers SET category = 'دكتور وممرض' WHERE category = 'طبي' AND email = 'mostafa.doc@example.com';
UPDATE providers SET category = 'خدمات سيارات' WHERE category = 'سيارات';
