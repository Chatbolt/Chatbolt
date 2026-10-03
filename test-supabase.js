const { createClient } = require('@supabase/supabase-js')

const url = 'https://********.supabase.co'
const key = 'Your Supabase key'
const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test@chatbolt.io',
    password: 'password123',
    email_confirm: true
  })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Success:', data.user.id)
  }
}

test()
