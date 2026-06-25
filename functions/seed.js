const admin = require('firebase-admin')

const serviceAccount = require('./service-account-key.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ithopiia-6e31c-default-rtdb.firebaseio.com',
})

const db = admin.database()
const rootRef = db.ref('ithopiia')

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
  let matched = 0
  let updated = 0

  for (const userId of userIds) {
    const user = data.users[userId]
    const name = user.fullName?.trim()
    if (!name) continue

    const target = POINTS_MAP[name]
    if (target !== undefined) {
      matched++
      const oldPoints = user.cumulativePoints || 0
      user.cumulativePoints = target
      console.log(`✅ ${name}: ${oldPoints} → ${target}`)
      updated++
    }
  }

  if (updated === 0) {
    console.log('No matching users found. Check that fullName values match exactly.')
    console.log('Existing user names:')
    for (const userId of userIds) {
      console.log(`  - "${data.users[userId].fullName}"`)
    }
    process.exit(1)
  }

  await rootRef.child('users').update(data.users)
  console.log(`\nUpdated ${updated}/${Object.keys(POINTS_MAP).length} users`)
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
