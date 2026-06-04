const SUPABASE_URL = "https://npazyphvuzuxgxmmfdby.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WdQ6NE6n7M6KGVmsy_zwFg_yzVyraY1";

window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);