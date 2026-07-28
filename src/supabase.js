import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hmszuqqvmjrobrgbwizy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc3p1cXF2bWpyb2JyZ2J3aXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzEwMDAsImV4cCI6MjEwMDgwNzAwMH0.9ejT1eSWOb1j2IqDKG4XfKPzU_B4vcDjmNbPInJQuFM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
