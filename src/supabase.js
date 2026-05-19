import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jkxctayecvpnninhhw.supabase.co'
const supabaseKey = 'sb_publishable_gf2JHWSBiKJtgVU0MTP4rQ_fK0uMmsX'

export const supabase = createClient(supabaseUrl, supabaseKey)
