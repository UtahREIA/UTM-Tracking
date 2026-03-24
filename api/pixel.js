module.exports = async (req, res) => {

  // Allow the pixel to be called from any educator domain
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = require('../lib/supabase')

  const {
    event,
    educator_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    order_value,
    order_id,
    product_id,
    coupon_code,
    page_url,
    referrer
  } = req.body

  // Only process events from REIA traffic
  if (utm_source !== 'utahreia') {
    return res.status(200).json({ received: true, skipped: true })
  }

  // Store pixel event
  const { error } = await supabase
    .from('pixel_events')
    .insert({
      event:       event       || 'page_view',
      educator_id: educator_id || 'unknown',
      utm_source:  utm_source,
      utm_medium:  utm_medium,
      utm_campaign:utm_campaign,
      utm_content: utm_content,
      order_value: order_value || null,
      order_id:    order_id    || null,
      product_id:  product_id  || null,
      coupon_code: coupon_code || null,
      page_url:    page_url    || null,
      referrer:    referrer    || null,
      received_at: new Date().toISOString()
    })

  if (error) {
    console.error('Pixel insert failed:', error)
    return res.status(500).json({ error: 'Storage failed' })
  }

  return res.status(200).json({ received: true })
}