const crypto = require('crypto')
const supabase = require('../lib/supabase')

function verifySignature(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return signature === 'sha256=' + expected
}

async function forwardToGHL(event) {
  try {
    await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.GHL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        tags: ['reia-referral', event.event, event.educator_id],
        customField: {
          last_reia_event:   event.event,
          last_educator:     event.educator_id,
          last_order_value:  event.order_value,
          last_utm_campaign: event.utm_campaign,
          last_utm_content:  event.utm_content,
          last_coupon_code:  event.coupon_code || ''
        }
      })
    })
  } catch (err) {
    console.error('GHL forward failed:', err)
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = JSON.stringify(req.body)
  const signature = req.headers['x-reia-signature']
  const timestamp = req.headers['x-reia-timestamp']

  const now = Math.floor(Date.now() / 1000)
  if (!timestamp || Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(400).json({ error: 'Request expired' })
  }

  const educatorId = req.body.educator_id
  const secretKey = process.env[
    'SECRET_' + educatorId?.toUpperCase().replace(/-/g, '_')
  ]

  if (!secretKey) {
    return res.status(401).json({ error: 'Unknown educator' })
  }

  if (!verifySignature(rawBody, signature, secretKey)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = req.body

  const { data: existing } = await supabase
    .from('referral_events')
    .select('id')
    .eq('event_id', event.event_id)
    .single()

  if (existing) {
    return res.status(200).json({ received: true, duplicate: true })
  }

  const { error } = await supabase
    .from('referral_events')
    .insert({
      event_id:      event.event_id,
      event:         event.event,
      educator_id:   event.educator_id,
      referral_id:   event.referral_id,
      user_id_hash:  event.user_id_hash,
      utm_source:    event.utm_source,
      utm_medium:    event.utm_medium,
      utm_campaign:  event.utm_campaign,
      utm_content:   event.utm_content,
      order_id:      event.order_id,
      product_id:    event.product_id,
      order_value:   event.order_value,
      currency:      event.currency,
      coupon_code:   event.coupon_code,
      timestamp_utc: event.timestamp_utc,
      raw_payload:   event
    })

  if (error) {
    console.error('DB insert failed:', error)
    return res.status(500).json({ error: 'Storage failed' })
  }

  forwardToGHL(event)

  return res.status(200).json({ received: true })
}