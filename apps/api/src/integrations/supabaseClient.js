const { createClient } = require("@supabase/supabase-js");
const { cfg } = require("../config/env");

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = {
  supabase,
};
