// ============================================
// iPhone Store 25 - Supabase Config (Fast)
// ============================================
const SUPABASE_URL = 'https://mjxbykfvnlqoxakxnant.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeGJ5a2Z2bmxxb3hha3huYW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzQ4ODgsImV4cCI6MjA5OTU1MDg4OH0.b1SEul1E0KjrJjucBvLXZy5jG0xM0uZ8-ZiFUGgv_jw';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeGJ5a2Z2bmxxb3hha3huYW50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk3NDg4OCwiZXhwIjoyMDk5NTUwODg4fQ.DhNa72q0zL_PbqvCqZySGHUU2SEYJODgdIhPBB8_fCY';

var _db = { client: null, admin: null };

(function() {
    try {
        var sdk = window.supabase;
        if (sdk && typeof sdk.createClient === 'function') {
            _db.client = sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                realtime: { params: { eventsPerSecond: 10 } },
                db: { schema: 'public' },
                global: { headers: { 'x-client-info': 'ipstore25-fast' } }
            });
            _db.admin = sdk.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                global: { headers: { 'x-client-info': 'ipstore25-admin' } }
            });
            console.log('[Supabase] Fast init OK');
        } else {
            console.error('[Supabase] SDK not loaded');
        }
    } catch(e) {
        console.error('[Supabase] Init error:', e);
    }
})();