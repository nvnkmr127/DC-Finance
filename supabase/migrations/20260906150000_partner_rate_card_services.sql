-- Seed the DigiCloudify Sales Partner rate card into the services catalog.
--
-- The services table has one numeric `price`, so we store the range's starting
-- figure (the card calls these "indicative starting points") and put the full
-- range + unit + scope in `description`. All prices are partner-facing and
-- GST-exclusive (18% GST is added on top; ad spend, hosting, licenses and other
-- pass-through costs are always billed separately). Scoped/quote-per-requirement
-- items are seeded at 0 with the scope noted. Idempotent via the name unique key.

insert into public.services (name, price, description) values
  -- Part A/1 · SEO & Search
  ('Technical SEO Audit',            6000,  'One-time · ₹6,000–10,000 · Full crawl, speed, indexing, fixes report'),
  ('On-page SEO',                    7000,  'Per month · Meta, headings, internal links, content optimization'),
  ('Off-page / Link Building',       8000,  'Per month · Outreach, guest posts, citations (backlink budget excluded)'),
  ('Local SEO / GBP',                7000,  'Per month · Profile optimization, citations, reviews, map-pack'),
  ('E-commerce SEO',                 14000, 'Per month · Category + product optimization, schema'),
  ('AI / GEO Search',                9000,  'Per month · AI Overviews, ChatGPT, Perplexity optimization'),
  ('Full SEO Retainer',              16000, 'Per month · Technical + on-page + off-page + 4 blogs/mo + reporting'),
  ('Keyword Research',               4000,  'One-time · Full keyword map, intent, competitors'),
  ('Schema Markup',                  3000,  'One-time · ₹3,000–6,000 · Structured data implementation'),
  -- Part A/2 · Social Media
  ('Social — Lite',                  6000,  'Per month · 1 platform, 12 posts, scheduling + captions'),
  ('Social — Standard',              12000, 'Per month · 2 platforms, creatives + captions + scheduling, 15 posts'),
  ('Social — Premium',               20000, 'Per month · 3+ platforms, creatives + reels + captions + community'),
  ('Community Management',           6000,  'Per month · Comment + DM response, engagement'),
  ('Influencer Marketing',           10000, 'Per month + influencer fees · Sourcing, outreach, coordination, reporting'),
  ('LinkedIn Management',            9000,  'Per month · Personal / company page content + growth'),
  -- Part A/3 · Paid Advertising (ad spend always excluded)
  ('Meta Ads — Management',          9000,  'Per month · Setup, targeting, optimization, report (creatives given)'),
  ('Meta Ads — Management + Creatives', 13000, 'Per month · Management + ad creatives (ad spend excluded)'),
  ('Google Ads — Search / PMax',     10000, 'Per month · Setup, keywords, optimization, report (ad spend excluded)'),
  ('Google Ads — Full Managed',      16000, 'Per month · Search + Display + YouTube + Shopping (ad spend excluded)'),
  ('LinkedIn Ads',                   11000, 'Per month · Setup + management + report (ad spend excluded)'),
  ('YouTube Ads',                    9000,  'Per month · Setup + management (ad spend excluded)'),
  -- Part A/4 · Performance Marketing & CRO
  ('Full-Funnel Performance',        15000, 'Per month · ≤₹1L spend=₹15k, ₹1–5L=₹28k, ₹5L+=10–12% · Meta+Google, retargeting, tracking, dashboard'),
  ('Funnel / Landing-Page Setup',    18000, 'One-time · ₹18,000–35,000 · Landing page + pixel + tracking + campaign setup'),
  ('Conversion Tracking Setup',      8000,  'One-time · ₹8,000–12,000 · Pixel, GTM, events, GA4'),
  ('CRO / A-B Testing',              12000, 'Per month · Hypotheses, test setup, analysis'),
  -- Part A/5 · Email, SMS & WhatsApp
  ('Email Marketing',                7000,  'Per month · Campaign design + send + report (up to 4/mo)'),
  ('Email Automation Setup',         12000, 'One-time · ₹12,000–22,000 · Welcome / drip / cart-recovery flows'),
  ('SMS Marketing',                  5000,  'Per month + gateway cost · Campaign setup + send + report'),
  ('WhatsApp Marketing',             6000,  'Per month + API cost · Broadcasts, chatbot flows, catalogue (via Watxio)'),
  ('Chatbot Setup',                  10000, 'One-time · ₹10,000–18,000 · Flow design + deployment, WhatsApp or web'),
  -- Part A/6 · Online Reputation (ORM)
  ('Review Management',              7000,  'Per month · Monitoring + response + review-generation strategy'),
  ('Reputation Monitoring',          6000,  'Per month · Brand-mention tracking + monthly report'),
  ('Negative-Content Suppression',   0,     'Scoped — quoted per requirement · SEO push-down strategy'),
  -- Part A/7 · Strategy, Analytics & Consulting
  ('Marketing Strategy / Consulting', 15000, 'Per month · Audit + roadmap + monthly review'),
  ('Growth Audit',                   8000,  'One-time · Website + social + SEO + ads audit + report'),
  ('Competitor Analysis',            6000,  'One-time · 3–5 competitors, positioning, gaps'),
  ('Analytics Setup',                7000,  'One-time · GA4 + GTM + dashboards'),
  -- Part B/8 · Content Writing (per piece)
  ('Blog — Write Only',              800,   'Per 1,000 words · On given topic (images, publishing excluded)'),
  ('Blog — Research + SEO',          1500,  'Per 1,000 words · Research, writing, SEO format, 1 image'),
  ('Website Copywriting',            1000,  'Per page · Up to 400 words'),
  ('Ad Copy',                        700,   'Per set · 5 variations'),
  ('Product Descriptions',           100,   'Per product · ₹100–250 · SEO-formatted'),
  ('Email Copy',                     600,   'Per email'),
  ('Scriptwriting',                  800,   'Per script · ₹800–2,000 · Video / reel'),
  -- Part B/9 · Graphic Design & Branding
  ('Social Creative — Static',       300,   'Each · ₹300–500 · 1 designed post'),
  ('Social Creative — Animated',     900,   'Each · 1 animated post'),
  ('Poster / Brochure',              600,   'Each · ₹600–1,200 · Print-ready design (printing excluded)'),
  ('Logo Only',                      6000,  'One-time · 3 concepts, 2 revisions, final files'),
  ('Full Brand Identity',            15000, 'One-time · Logo + guidelines + basic collateral'),
  ('Packaging Design',               6000,  'Per SKU · from ₹6,000 (dielines / printing excluded)'),
  ('Pitch / Presentation Deck',      6000,  'One-time · ₹6,000–12,000 · Up to 15 slides'),
  ('Infographic',                    1200,  'Each · ₹1,200–2,500 · Custom designed'),
  -- Part B/10 · Video — Shoots (day-rate; travel & stay extra)
  ('Product / Studio Shoot',         6000,  'Per day · ₹6,000–15,000 · Jewellery, e-commerce, products'),
  ('Interior / Walkthrough Shoot',   10000, 'Per day · ₹10,000–20,000 · Interior design, real estate'),
  ('Corporate / Interview Shoot',    8000,  'Per day · ₹8,000–16,000 · B2B, education'),
  ('Event Coverage Shoot',           12000, 'Per day · ₹12,000–25,000 · Launches, conferences'),
  ('Food Shoot',                     8000,  'Per day · ₹8,000–16,000 · Hospitality, restaurants'),
  ('Model / Fashion Shoot',          15000, 'Per day + talent · from ₹15,000 · Jewellery, apparel'),
  ('Ad Film / Commercial',           40000, 'Per project · from ₹40,000 · Premium brand ads'),
  ('Short-Form / Reel Shoot',        5000,  'Per session · ₹5,000–10,000 · Social content'),
  -- Part B/11 · Video — Editing & Animation
  ('Reel / Short Edit',              800,   'Per reel · ₹800–1,800 · Cut, captions, music, 1 revision'),
  ('Long-Form Edit',                 2500,  'Per video · ₹2,500–6,000 · ~10 min, cuts, basic graphics'),
  ('Color Grading',                  1200,  'Per video · from ₹1,200 · Professional grade'),
  ('Motion Graphics',                1500,  'Per minute · from ₹1,500 · Animated segments, explainers'),
  ('2D / 3D Animation',              6000,  'Per minute · from ₹6,000 (scoped) · Custom animated video'),
  ('Explainer Video',                12000, 'from ₹12,000 · Script + animation + VO, up to 60s'),
  ('Subtitles / Captions',           400,   'Per video · Timed captions, 1 language'),
  ('Podcast Episode Edit',           2000,  'Per episode · from ₹2,000 · Multi-cam sync, cuts, short clips'),
  -- Part B/12 · Photography
  ('Product Photography',            250,   'Per product · ₹250–500 · Studio'),
  ('Corporate / Headshots',          6000,  'Per half-day'),
  ('Event Photography',              10000, 'Per day · ₹10,000–18,000'),
  ('Real Estate / Interior Photography', 5000, 'Per property · ₹5,000–10,000'),
  ('Photo Retouching',               80,    'Per image · ₹80–250'),
  -- Part B/13 · AI-Generated Content
  ('AI Product Images',              120,   'Per image · ₹120–350 · E-commerce / jewellery visuals'),
  ('AI Product Photography',         150,   'Per image · ₹150–400 · Background / model swap per SKU'),
  ('AI Ad Creatives',                250,   'Each · ₹250–500 · Static ad visuals'),
  ('AI UGC / Avatar Video',          1200,  'Per video · ₹1,200–3,000 · Faceless or avatar short video'),
  ('AI Product Video',               1500,  'Per video · from ₹1,500 · Animated product showcase'),
  ('AI Voiceover',                   250,   'Per minute · ₹250–500 · Natural voice'),
  ('AI Content / Copy',              400,   'Per piece · ₹400–1,000 · Blogs, product descriptions, ad copy'),
  -- Part C/14 · Websites & Landing Pages
  ('Landing Page',                   8000,  'One-time · Single page, responsive, lead form'),
  ('Website — Build Only',           15000, 'One-time · Up to 8 pages, 2 revisions (supplied content)'),
  ('Website — Full',                 25000, 'One-time · Build + copywriting + stock images'),
  ('E-commerce Site',                45000, 'from ₹45,000 · Store up to 50 products, payment + shipping'),
  ('Website Redesign',               0,     'Scoped — quoted per requirement · Rebuild of existing site'),
  ('Website Maintenance',            4000,  'Per month · Updates, backups, security, uptime'),
  ('Speed / SEO Optimization',       6000,  'One-time · ₹6,000–12,000 · Core Web Vitals + on-page tech'),
  -- Part C/15 · Software Development (always scoped per requirement)
  ('Mobile App Development',         0,     'Scoped — quoted per requirement · iOS / Android / cross-platform'),
  ('ERP Development',                0,     'Scoped — quoted per requirement · Inventory, HR/payroll, accounting, procurement, reporting'),
  ('CRM Development',                0,     'Scoped — quoted per requirement · Perfex-based or custom'),
  ('Web App / SaaS / Portal',        0,     'Scoped — quoted per requirement · Auth, billing, admin, dashboards, roles'),
  ('Integrations / APIs',            0,     'Scoped — quoted per requirement · Third-party integrations, custom APIs, webhooks'),
  ('Software Maintenance & Support (AMC)', 0, 'Scoped · AMC bug fixes, minor updates, uptime; or feature retainer per dev-day / sprint'),
  -- Part C/16 · Products & Platforms
  ('Watxio (WhatsApp Business)',     0,     'Subscription (confirm) + WhatsApp API cost · Setup, broadcasts, chatbot, catalogue'),
  ('CRM Product (Perfex-based)',     0,     'Setup + license (confirm) · Ready CRM, setup, license, training')
on conflict (name) do nothing;
