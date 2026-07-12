-- Check RLS on users table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public';

-- List all RLS policies on users table
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public';

-- Also fix the email while we're at it
UPDATE public.users
SET email = 'pearsonperformance@gmail.com'
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';
