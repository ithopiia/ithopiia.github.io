const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const POINTS_PER_DAY = 0
const ROOT_PATH = 'ithopiia'

function getTodayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

exports.grantDailyPoints = functions.pubsub.schedule('0 0 * * *').timeZone('Africa/Cairo').onRun(async () => {
  const rootRef = admin.database().ref(ROOT_PATH)

  const snap = await rootRef.once('value')
  if (!snap.exists()) return null

  const data = snap.val()
  if (!data.users) return null

  const todayKey = getTodayKey()

  if (!data.settings || !data.settings.campaignActive) {
    console.log('Campaign is not active, skipping')
    return null
  }

  if (data.settings.lastDayOfKaraza && todayKey > data.settings.lastDayOfKaraza) {
    console.log(`Campaign ended on ${data.settings.lastDayOfKaraza}, skipping`)
    return null
  }

  if (!data.dailyPoints) data.dailyPoints = {}
  if (!data.dailyPoints[todayKey]) data.dailyPoints[todayKey] = {}

  const todayEntries = data.dailyPoints[todayKey]
  let granted = 0

  for (const userId of Object.keys(data.users)) {
    const user = data.users[userId]
    if (user.status !== 'approved') continue
    if (user.role === 'admin') continue

    if (todayEntries[userId]) {
      console.log(`User ${userId} already has points for ${todayKey}`)
      continue
    }

    todayEntries[userId] = {
      basePoints: POINTS_PER_DAY,
      bonusPoints: 0,
      overwritten: false,
      finalScore: POINTS_PER_DAY,
      adminNotes: '',
      saved: true,
      date: new Date().toISOString(),
    }

    if (!user.cumulativePoints) user.cumulativePoints = 0
    user.cumulativePoints += POINTS_PER_DAY
    granted++
  }

  if (granted === 0) {
    console.log('No new points to grant')
    return null
  }

  const updates = {}
  updates[`${ROOT_PATH}/users`] = data.users
  updates[`${ROOT_PATH}/dailyPoints/${todayKey}`] = todayEntries
  await admin.database().ref().update(updates)

  console.log(`Granted ${POINTS_PER_DAY} points to ${granted} users for ${todayKey}`)
  return null
})
