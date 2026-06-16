import { createClient } from '@supabase/supabase-js';

let envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

// Sanitize the URL in case the user accidentally included the /rest/v1 path or trailing slashes
if (envUrl.endsWith('/rest/v1/')) {
    envUrl = envUrl.replace('/rest/v1/', '');
} else if (envUrl.endsWith('/rest/v1')) {
    envUrl = envUrl.replace('/rest/v1', '');
}
if (envUrl.endsWith('/')) {
    envUrl = envUrl.slice(0, -1);
}

const supabaseUrl = envUrl;

let validationError = null;
if (!supabaseUrl || !supabaseAnonKey) {
  validationError = "Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables in the Settings menu.";
} else if (!supabaseUrl.startsWith("http")) {
  validationError = `VITE_SUPABASE_URL must start with http:// or https://. You provided: ${supabaseUrl}`;
} else if (supabaseUrl.includes('supabase.com/dashboard')) {
  validationError = "You provided the dashboard URL. Please go to Project Settings > API and copy the 'Project URL'.";
}

if (validationError) {
  console.error(validationError);
}

export const supabase = createClient(
  (!validationError && supabaseUrl.startsWith("http")) ? supabaseUrl : "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
export { validationError as supabaseValidationError };
