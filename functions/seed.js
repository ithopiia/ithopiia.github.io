const admin = require('firebase-admin')

const serviceAccount = require('./service-account-key.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ithopiia-6e31c-default-rtdb.firebaseio.com',
})

const db = admin.database()
const rootRef = db.ref('ithopiia')

const SEED_DATE = '2026-06-21'
const CAMPAIGN_START = '2026-06-22'
const TODAY = '2026-06-25'

const POINTS_MAP = {
  'بيشوي شوقي نصيف ايوب': 40,
  'Haidi Nasr Wanas Wanes': 40,
  'جيرمين ايليا فاروق صليب': 40,
  'نانسي مجدي جيد روفائيل': 40,
  'Tomas Talaat': 40,
  'ندى ايهاب جبره داود': 40,
  'Nervana Effat': 40,
  'باسم عاطف نان عزيز': 40,
  'سيسيل انيس سيدهم انور': 40,
  'اوليفيا اسحق ابراهيم زكي': 40,
  'فارس جورج فارس سامى': 40,
  'ساره سعيد رسن': 40,
  'جينا يوحنا فوزي العبد': 40,
  'شهاب ايهاب وهيب وهبه': 40,
  'كيرمينا نصير اسحق نصير': 40,
  'كيرلس نان': 40,
  'ڤيولا خيري صبحي بخيت': 40,
  'كيرلس هدرا جابر ميخائيل': 40,
  'فيرينا ملاك عبده فرج': 40,
  'يوستينا ايمن جندي وهيب': 40,
  'مريانا سامح رمزي نبيه': 40,
  'مريم جرجس فايز زكي': 40,
  'Felopater Adel': 30,
}

async function seed() {
  const snap = await rootRef.once('value')
  if (!snap.exists()) {
    console.log('No data found at ithopiia path')
    process.exit(1)
  }

  const data = snap.val()
  if (!data.users) {
    console.log('No users found in database')
    process.exit(1)
  }

  const userIds = Object.keys(data.users)
  const updates = {}
  let matched = 0
  let skipped = 0

  for (const userId of userIds) {
    const user = data.users[userId]
    const name = user.fullName?.trim()
    if (!name) continue

    const seedPoints = POINTS_MAP[name]
    if (seedPoints === undefined) continue

    matched++

    // Strict skip check: if user already has ANY recorded data, preserve it
    const existingSeed = data.dailyPoints?.[SEED_DATE]?.[userId]
    const hasCampaignEntry = data.dailyPoints && Object.keys(data.dailyPoints).some(
      dateKey => dateKey >= CAMPAIGN_START && dateKey <= TODAY && data.dailyPoints[dateKey]?.[userId]
    )
    const hasCustomPoints = user.cumulativePoints != null && user.cumulativePoints !== 0

    if (existingSeed || hasCampaignEntry || hasCustomPoints) {
      const reasons = []
      if (existingSeed) reasons.push('seed entry exists')
      if (hasCampaignEntry) reasons.push('has campaign data')
      if (hasCustomPoints) reasons.push(`cumulativePoints=${user.cumulativePoints}`)
      console.log(`⏭️ ${name}: skipping (${reasons.join(', ')})`)
      skipped++
      continue
    }

    // User is clean — no seed, no campaign entries, no custom points.
    // Create baseline dailyPoints entry and set cumulativePoints.
    const seedEntry = {
      basePoints: seedPoints,
      bonusPoints: 0,
      finalScore: seedPoints,
      overwritten: false,
      adminNotes: 'قاعدة أولية',
      saved: true,
      date: new Date().toISOString(),
    }

    console.log(`✅ ${name}: seed=${seedPoints}`)

    updates[`dailyPoints/${SEED_DATE}/${userId}`] = seedEntry
    updates[`users/${userId}/cumulativePoints`] = seedPoints
  }

  if (matched === 0) {
    console.log('No matching users found. Check that fullName values match exactly.')
    console.log('Existing user names:')
    for (const userId of userIds) {
      console.log(`  - "${data.users[userId].fullName}"`)
    }
    process.exit(1)
  }

  if (Object.keys(updates).length === 0) {
    console.log(`All ${matched} matched users already have seed entries. Nothing to update.`)
    process.exit(0)
  }

  await rootRef.update(updates)
  console.log(`\nDone. Matched ${matched}, skipped ${skipped}, updated ${Object.keys(updates).length / 2} users.`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
