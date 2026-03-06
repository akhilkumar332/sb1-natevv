import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serviceAccountPath = path.resolve(rootDir, 'secrets', 'firebase-admin-sdk.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Missing service account file at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const posts = [
  {
    slug: 'first-time-blood-donation-guide-india',
    title: 'First-Time Blood Donation in India: What to Expect Step by Step',
    excerpt: 'A practical, anxiety-free guide for first-time donors: eligibility, screening, donation day, and aftercare.',
    coverImageUrl: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'donor-guide',
    featured: true,
    blocks: [
      'Donating blood for the first time can feel overwhelming, but the actual process is straightforward and safe. Most donation centers follow a standard sequence: registration, a short medical screening, the donation itself, and a brief recovery period.',
      'Before you go, sleep well, eat a light meal, and drink water. Carry a valid ID. If you are unsure about your eligibility because of medication, a recent illness, or travel, call the blood bank in advance to avoid a wasted trip.',
      'At the center, a healthcare professional checks basics like hemoglobin, blood pressure, and recent health history. These checks protect both the donor and the recipient, and they are normal for everyone.',
      'The donation usually takes only a few minutes. Afterward, rest for 10 to 15 minutes, have fluids, and avoid heavy lifting for the rest of the day. Most donors return to normal activity quickly.',
      'If this is your first donation, focus on completing one safe donation rather than trying to optimize everything. A calm, prepared first experience is what builds long-term donor consistency.',
    ],
  },
  {
    slug: 'how-often-can-you-donate-blood-safely',
    title: 'How Often Can You Donate Blood Safely?',
    excerpt: 'Donation frequency explained in plain language, including practical recovery habits between donations.',
    coverImageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'donor-health',
    featured: false,
    blocks: [
      'A common question is: “How often should I donate?” The answer depends on donation type and your health. For whole blood, many centers follow a gap of roughly 8 to 12 weeks, based on local policy and your recovery markers.',
      'Your body replaces plasma quickly, but red blood cell restoration takes longer. That is why interval rules exist, and why hemoglobin checks matter before each donation.',
      'Between donations, prioritize iron-rich meals, hydration, and sleep. If you feel unusual fatigue after a donation, delay your next appointment and consult a medical professional.',
      'The right mindset is consistency over frequency. A donor who follows safe intervals and stays healthy contributes more over time than someone who donates aggressively and then burns out.',
      'Track your last donation date and plan your next slot in advance. Treat blood donation like a long-term community commitment, not a one-time event.',
    ],
  },
  {
    slug: 'blood-donation-myths-vs-facts',
    title: 'Blood Donation Myths vs Facts: What Donors Still Get Wrong',
    excerpt: 'Clearing persistent myths around weakness, weight loss, and safety so more eligible people can donate confidently.',
    coverImageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'awareness',
    featured: true,
    blocks: [
      'Myth: “You become permanently weak after donation.” Fact: healthy donors usually recover quickly, especially with hydration and nutrition.',
      'Myth: “Blood donation causes major weight changes.” Fact: donation is not a weight-loss method and does not create lasting body composition changes.',
      'Myth: “Needles and equipment may be reused.” Fact: reputable centers use sterile, single-use collection kits and strict protocols.',
      'Myth: “Only rare blood groups are useful.” Fact: every compatible blood group is needed, because demand patterns vary by region and emergency load.',
      'When donor confidence is based on facts instead of hearsay, participation improves. If you are unsure, ask the medical team directly at the center instead of relying on social media myths.',
    ],
  },
  {
    slug: 'nutrition-before-and-after-blood-donation',
    title: 'What to Eat Before and After Blood Donation',
    excerpt: 'Simple meal ideas to reduce dizziness, support recovery, and keep your next donation on schedule.',
    coverImageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'donor-health',
    featured: false,
    blocks: [
      'Food and hydration make a major difference in donor comfort. Before donation, eat a balanced meal with carbohydrates, protein, and fluids. Avoid donating on an empty stomach.',
      'After donation, continue fluids through the day and include iron-supportive foods in upcoming meals. Pair plant-based iron sources with vitamin C to improve absorption.',
      'If you are prone to light-headedness, avoid standing suddenly after donation and skip intense workouts for the day.',
      'A practical routine works best: hydrate in the morning, eat a normal meal before your slot, and keep a recovery snack ready for later.',
      'Good donor nutrition is less about expensive supplements and more about consistent basics done well.',
    ],
  },
  {
    slug: 'urgent-blood-request-how-donors-can-respond-fast',
    title: 'Urgent Blood Request: How Donors Can Respond Fast and Safely',
    excerpt: 'A response checklist for urgent requests: verify details, confirm eligibility, and coordinate quickly without panic.',
    coverImageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'emergency-response',
    featured: true,
    blocks: [
      'Urgent requests are emotionally intense, but an organized response saves more time than panic. Start by confirming the blood group, location, hospital name, and contact person.',
      'Next, check your own eligibility: recent donation date, current health, medication, and travel factors. If you are not eligible, help by forwarding the request responsibly to verified donor groups.',
      'Avoid posting incomplete or unverified messages. Clear, accurate request details improve matching speed significantly.',
      'If you can donate, inform the request coordinator before traveling so the receiving team can prepare and reduce waiting time.',
      'In emergencies, disciplined communication is as important as donor availability. Speed with verification is the best combination.',
    ],
  },
  {
    slug: 'rare-blood-groups-and-why-regular-donors-matter',
    title: 'Rare Blood Groups: Why Regular Donors Matter More Than Viral Appeals',
    excerpt: 'Rare blood support depends on prepared donor networks, not last-minute forwarding alone.',
    coverImageUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1600&q=80',
    categorySlug: 'awareness',
    featured: false,
    blocks: [
      'Rare blood group needs often become visible only during crises, but the real solution is ongoing donor readiness. One-time viral forwards help, but structured donor pools help more.',
      'Donors with uncommon groups should keep contact details updated and stay connected to reliable blood bank or community channels.',
      'Hospitals and NGOs benefit from maintaining verified, locality-tagged donor lists. Good data quality shortens response time during critical cases.',
      'For the public, the best contribution is to donate regularly when eligible and encourage matching donors in your network to register properly.',
      'Prepared communities reduce emergency chaos. Rare group support is strongest when systems are built before the emergency begins.',
    ],
  },
];

const toContentJson = (blocks) => JSON.stringify({
  blocks: blocks.map((text, index) => ({
    id: `b${index + 1}`,
    type: 'paragraph',
    text,
  })),
}, null, 2);

const run = async () => {
  const collection = db.collection('cmsBlogPosts');
  const batch = db.batch();

  posts.forEach((post) => {
    const ref = collection.doc(`post_${post.slug}`);
    batch.set(ref, {
      title: post.title,
      slug: post.slug,
      status: 'published',
      excerpt: post.excerpt,
      contentJson: toContentJson(post.blocks),
      categorySlug: post.categorySlug,
      tags: ['blood donation', 'health', 'awareness'],
      coverImageUrl: post.coverImageUrl,
      featured: post.featured,
      seoTitle: post.title.slice(0, 70),
      seoDescription: post.excerpt.slice(0, 180),
      authorName: 'BloodHub Editorial Team',
      publishedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  });

  await batch.commit();

  const verification = await collection
    .where('slug', 'in', posts.map((post) => post.slug).slice(0, 10))
    .get();

  console.log(`Seeded/updated ${posts.length} blog posts.`);
  verification.docs.forEach((docSnap) => {
    const data = docSnap.data();
    console.log(`- ${data.slug} [status=${data.status}]`);
  });
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed blog posts:', error);
    process.exit(1);
  });
