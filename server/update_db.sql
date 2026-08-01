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
VALUES ('حالا', 'halan', 'halan@halan.com', '$2a$10$ZmJ4fqvtoDUACHsmgBXeyuM44fZ5EJBZo1T4ycwATSWTndmGltj92', '01012345678', 'partner_owner', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حاتم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حاتم', 'hatem', 'hatem@halan.com', '$2a$10$pkIuQmF1pwfcb.YxngERWew86vgP4IP8rjBrWaQGjIhG./o/1NULy', '01122334455', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حسين
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حسين', 'hussein', 'hussein@halan.com', '$2a$10$7hIkgiG1aSUC4S3NVHOxL.Hs2p5PSkpA9lfhk96pv068pb8cGWqxC', '01277889900', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: أشرف
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('أشرف', 'ashraf', 'ashraf@halan.com', '$2a$10$OOkAiHE56LT.AAj2do5Ec.C7hhtZ6Tq8ltLBX10kmYut9ycZsKtY.', '01555667788', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: محمد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('محمد', 'mohamed', 'mohamed@halan.com', '$2a$10$g88wfXW3CnEM9mrRqQeDVeu3VRn0vI2f5nRMFuxjIme8zUkDVlJbi', '01099887766', 'partner_supervisor', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: عمر
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('عمر', 'omar', 'omar@courier.com', '$2a$10$bztAV3kGShvCYhG5pLx8Eu5t/w.mJN0OJagTYgopZuowSc5IymS1S', '01144556622', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: ياسين
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('ياسين', 'yassin', 'yassin@courier.com', '$2a$10$.nRez10gsnohLwUMRVG9JuFinCArvyWkJfOGPg7Lk0uKYqOkdRFqO', '01288990011', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: حمزة
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('حمزة', 'hamza', 'hamza@courier.com', '$2a$10$BoQrtaqC.hRavF6eZGS82ur3f/U14uYE5lM8etRH9P6yr3Cg1x7yy', '01066778899', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: زياد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('زياد', 'ziad', 'ziad@courier.com', '$2a$10$BDoGuXvYHJo5FmIANRpSee.uVH9gtnLLo4IVgj2AeaH5hoyYbhqJq', '01500112233', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: سيف
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('سيف', 'seif', 'seif@courier.com', '$2a$10$qziAaDos97LJ57j0zp1l8O1.cjRfbV4F40C.xg12jGJhvb5AS.ZOq', '01122112233', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: آدم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('آدم', 'adam', 'adam@courier.com', '$2a$10$QPY.VYP3plzKiMzQHwLoT.fHnZqwzJ/b0tuD1ZklJupg3crzAnDxK', '01233445566', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: يحيى
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('يحيى', 'yehia', 'yehia@courier.com', '$2a$10$N/1ydNvyL1kphU0Nv5/.j.H1nfZxzPXFpZHJlTXvGUDr5kG9Bkzt2', '01044332211', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: بلال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('بلال', 'belal', 'belal@courier.com', '$2a$10$OwfxT./AXVZUgRmOZHnzBuQMZ8DwvAdto6WmQ8v.nqNsL4n.PIE4K', '01555443322', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: أنس
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('أنس', 'anas', 'anas@courier.com', '$2a$10$YzegA8ro1l7MKADPFVZw0u/93h.gRvYlPKXJhcYTm7Bz6IUzz5c4q', '01199880077', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: مروان
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مروان', 'marwan', 'marwan@courier.com', '$2a$10$FgCPKkpoqY5PfnJuvRTQ6O2ZVUz4YWB.u/6BM2j6keOuk2pP1qaQC', '01200998877', 'partner_courier', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: طارق حسن
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('طارق حسن', 'tarek.food', 'tarek.food@example.com', '$2a$10$1YLDasXuX8kAWFG7kgSfpumJ4p0lis4mgLLuMnzpXss6DuIx8piBO', '01011223344', 'provider', 'الحي الأول، المجاورة الثانية، عمارة 15', 'تقديم أشهى المأكولات والمشروبات')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'طارق حسن', 'tarek.food@example.com', 'مطاعم', 'الحي الأول، المجاورة الثانية، عمارة 15', '01011223344', 'تقديم أشهى المأكولات والمشروبات', 'الحي الأول، المجاورة الثانية، عمارة 15'
FROM users WHERE email = 'tarek.food@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: مصطفى كمال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مصطفى كمال', 'mostafa.maint', 'mostafa.maint@example.com', '$2a$10$RHBRHnkUif0IK9JMa1OAYe10f3NKXD04/8HSC92C0sgGRwoqgUUX2', '01155667788', 'provider', 'الحي الثاني، المجاورة الرابعة، محل 3', 'صيانة فورية لأعطال الكهرباء والسباكة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'مصطفى كمال', 'mostafa.maint@example.com', 'صيانة', 'الحي الثاني، المجاورة الرابعة، محل 3', '01155667788', 'صيانة فورية لأعطال الكهرباء والسباكة', 'الحي الثاني، المجاورة الرابعة، محل 3'
FROM users WHERE email = 'mostafa.maint@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: د. خالد عبدالرحمن
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('د. خالد عبدالرحمن', 'khaled.pharma', 'khaled.pharma@example.com', '$2a$10$mZ1fN3iEN6KgHj4DfrBSOuiBP3ydhYwHDugkktVb.inQd3N9zNata', '01233445577', 'provider', 'الحي الثالث، المجاورة الأولى، ميدان الزهور', 'صيدلية متكاملة وخدمات طبية')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'د. خالد عبدالرحمن', 'khaled.pharma@example.com', 'طبي', 'الحي الثالث، المجاورة الأولى، ميدان الزهور', '01233445577', 'صيدلية متكاملة وخدمات طبية', 'الحي الثالث، المجاورة الأولى، ميدان الزهور'
FROM users WHERE email = 'khaled.pharma@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: محمود جمال
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('محمود جمال', 'mahmoud.cars', 'mahmoud.cars@example.com', '$2a$10$wd7oHWLhv7CZtvzff2kM6.XFWsCyYM2wCR1pu74ow3J9JmyGG8C1O', '01555668899', 'provider', 'المنطقة الصناعية، بلوك 4، ورشة 12', 'غسيل سيارات، تغيير زيوت، فحص دوري')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'محمود جمال', 'mahmoud.cars@example.com', 'سيارات', 'المنطقة الصناعية، بلوك 4، ورشة 12', '01555668899', 'غسيل سيارات، تغيير زيوت، فحص دوري', 'المنطقة الصناعية، بلوك 4، ورشة 12'
FROM users WHERE email = 'mahmoud.cars@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: إبراهيم سعيد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('إبراهيم سعيد', 'ibrahim.market', 'ibrahim.market@example.com', '$2a$10$msnXwiT.OkpFCdi0NuHaOeU0y7Oq745hEDBtVlcL68O56uWe9lX/G', '01099887755', 'provider', 'الحي الرابع، المجاورة الثالثة، السوق التجاري', 'توفير جميع السلع الغذائية والاستهلاكية')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'إبراهيم سعيد', 'ibrahim.market@example.com', 'سوبر ماركت', 'الحي الرابع، المجاورة الثالثة، السوق التجاري', '01099887755', 'توفير جميع السلع الغذائية والاستهلاكية', 'الحي الرابع، المجاورة الثالثة، السوق التجاري'
FROM users WHERE email = 'ibrahim.market@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: علي منصور
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('علي منصور', 'ali.laundry', 'ali.laundry@example.com', '$2a$10$NWtTUoqIa/F4fSccXeXXIuOP5CMBqEBgMTorstuDKqH/8UVf8aO/6', '01122334477', 'provider', 'الحي الخامس، سنتر المدينة، محل 5', 'غسيل، كي، وتنظيف سجاد')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'علي منصور', 'ali.laundry@example.com', 'مغسلة', 'الحي الخامس، سنتر المدينة، محل 5', '01122334477', 'غسيل، كي، وتنظيف سجاد', 'الحي الخامس، سنتر المدينة، محل 5'
FROM users WHERE email = 'ali.laundry@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: يوسف طارق
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('يوسف طارق', 'youssef.client', 'youssef.client@example.com', '$2a$10$7iC.IQKs9OLR7p7cNqvoseOhiJkO3Nh3p72qYuln.xq8N7CajDp0e', '01088774433', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: ندى إبراهيم
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('ندى إبراهيم', 'nada.customer', 'nada.customer@example.com', '$2a$10$M.T6wQh.EpEnkuS6Xx1gF.oeYuCUrwAMxpksONcZp91t8aAS8KVOO', '01155992211', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: مصطفى السيد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('مصطفى السيد', 'mostafa.user', 'mostafa.user@example.com', '$2a$10$XWpflp/I56mC6bNy9hljEOvOGQ8j5hiExyFApRTKFuiYqOU0YEcDW', '01222334488', 'customer', NULL, NULL)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

-- User: كابتن أحمد
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('كابتن أحمد', 'ahmed.pitch', 'ahmed.pitch@example.com', '$2a$10$0hx2Gw97OIhJJtIvKTEMT.HgOwXGeWxMGpIRcq1j3xFWQ44nDUylW', '01011223388', 'provider', 'نادي النجوم، الحي السابع', 'حجز ملاعب خماسية مجهزة على أعلى مستوى')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'كابتن أحمد', 'ahmed.pitch@example.com', 'ملاعب', 'نادي النجوم، الحي السابع', '01011223388', 'حجز ملاعب خماسية مجهزة على أعلى مستوى', 'نادي النجوم، الحي السابع'
FROM users WHERE email = 'ahmed.pitch@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: د. مصطفى
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('د. مصطفى', 'mostafa.doc', 'mostafa.doc@example.com', '$2a$10$nGEw9GQg7Le0.SFlt7Nda.ABYQlHKrA4LlBD4n.hqNi9HLVeADHvC', '01122334499', 'provider', 'عيادات الشفاء، المجاورة الثانية', 'كشوفات طبية وتمريض منزلي على مدار الساعة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'د. مصطفى', 'mostafa.doc@example.com', 'طبي', 'عيادات الشفاء، المجاورة الثانية', '01122334499', 'كشوفات طبية وتمريض منزلي على مدار الساعة', 'عيادات الشفاء، المجاورة الثانية'
FROM users WHERE email = 'mostafa.doc@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE

-- User: علي للتوصيل
INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
VALUES ('علي للتوصيل', 'ali.delivery', 'ali.delivery@example.com', '$2a$10$gBNEHZNflF4oJQBvxkwvp.g63LG6V02EjrZzEKv4epjeYZ.fj/56O', '01233445500', 'provider', 'موقف السيارات الرئيسي', 'توصيل أفراد ومشاوير خاصة بسيارات حديثة')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name, username = EXCLUDED.username, password = EXCLUDED.password, phone = EXCLUDED.phone, user_type = EXCLUDED.user_type, address = EXCLUDED.address, bio = EXCLUDED.bio;

INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
SELECT id, 'علي للتوصيل', 'ali.delivery@example.com', 'سيارات توصيل', 'موقف السيارات الرئيسي', '01233445500', 'توصيل أفراد ومشاوير خاصة بسيارات حديثة', 'موقف السيارات الرئيسي'
FROM users WHERE email = 'ali.delivery@example.com'
ON CONFLICT DO NOTHING; -- Assuming user_id unique is not guaranteed, otherwise we could use ON CONFLICT(user_id) DO UPDATE
