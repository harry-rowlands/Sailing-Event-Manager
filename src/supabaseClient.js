import { createClient } from '@supabase/supabase-js'

// replace with your project URL + anon key from Supabase dashboard
const supabaseUrl = "https://mpxhpqadktqhrqyjcuvy.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1weGhwcWFka3RxaHJxeWpjdXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTMzMDcsImV4cCI6MjA5NjA4OTMwN30.8FqMVd9xIP7tTpJinMvwzLyVXpI9JMD4t3W9W71l7UE"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)