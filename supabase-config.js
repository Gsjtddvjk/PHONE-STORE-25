// ============================================
// iPhone Store 25 - Supabase Config
// ============================================
const SUPABASE_URL = 'https://mjxbykfvnlqoxakxnant.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeGJ5a2Z2bmxxb3hha3huYW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzQ4ODgsImV4cCI6MjA5OTU1MDg4OH0.b1SEul1E0KjrJjucBvLXZy5jG0xM0uZ8-ZiFUGgv_jw';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeGJ5a2Z2bmxxb3hha3huYW50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk3NDg4OCwiZXhwIjoyMDk5NTUwODg4fQ.DhNa72q0zL_PbqvCqZySGHUU2SEYJODgdIhPBB8_fCY';

// Public client (for store - read only)
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Admin client (for admin - full access)
const supabaseAdmin = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;
