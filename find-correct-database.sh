# Run these commands on your server to find which database has your user:

echo '=== Checking supabase-db-cgkko0cscowggwk8sss44wkw ==='
docker exec -it supabase-db-cgkko0cscowggwk8sss44wkw psql -U postgres -d postgres -c "SELECT id, email FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';" 2>&1

echo ''
echo '=== Checking supabase-db-ewo444s0404gok00s8k8gkog ==='
docker exec -it supabase-db-ewo444s0404gok00s8k8gkog psql -U postgres -d postgres -c "SELECT id, email FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';" 2>&1

echo ''
echo '=== Checking supabase-db-ig8ow4o4okkogowggkog4cww ==='
docker exec -it supabase-db-ig8ow4o4okkogowggkog4cww psql -U postgres -d postgres -c "SELECT id, email FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';" 2>&1

echo ''
echo '=== Checking supabase-db-v0os0wg0gw4ko04ww80sgg08 ==='
docker exec -it supabase-db-v0os0wg0gw4ko04ww80sgg08 psql -U postgres -d postgres -c "SELECT id, email FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';" 2>&1

echo ''
echo '=== Checking supabase-db-d484so0g4swk0k0c8s0ggg88 ==='
docker exec -it supabase-db-d484so0g4swk0k0c8s0ggg88 psql -U postgres -d postgres -c "SELECT id, email FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';" 2>&1
