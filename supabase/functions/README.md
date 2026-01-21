# Supabase Edge Functions

This directory contains Supabase Edge Functions for the Printyx platform.

## Structure

```
functions/
├── _shared/              # Shared utilities (not exposed as endpoints)
│   ├── supabase.ts      # Supabase client helpers
│   └── cors.ts          # CORS utilities
├── hello/               # Sample function
│   └── index.ts
└── [your-functions]/    # Add your functions here
    └── index.ts
```

## Quick Start

### 1. Create a New Function

```bash
mkdir supabase/functions/my-function
touch supabase/functions/my-function/index.ts
```

### 2. Function Template

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    const body = await req.json();

    // Get authenticated Supabase client
    const supabase = createSupabaseClient(req);

    // Your logic here
    const result = {
      success: true,
      data: body,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
```

### 3. Test Locally

```bash
deno run --allow-all --watch supabase/functions/my-function/index.ts
```

### 4. Deploy

Push to GitHub - Coolify will automatically build and deploy:

```bash
git add supabase/functions/my-function/
git commit -m "Add my-function"
git push
```

## Common Patterns

### Database Queries

```typescript
// Select data
const { data, error } = await supabase.from('your_table').select('*').eq('tenant_id', tenantId);

// Insert data
const { data, error } = await supabase.from('your_table').insert({ column: 'value' });

// Update data
const { data, error } = await supabase
  .from('your_table')
  .update({ column: 'new_value' })
  .eq('id', id);

// Delete data
const { data, error } = await supabase.from('your_table').delete().eq('id', id);
```

### Authentication

```typescript
// Get user from JWT token
const supabase = createSupabaseClient(req);
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: corsHeaders,
  });
}

// Use service role for admin operations
const adminClient = createSupabaseServiceClient();
```

### File Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload('path/to/file.pdf', fileBuffer);

// Get public URL
const { data } = supabase.storage.from('bucket-name').getPublicUrl('path/to/file.pdf');
```

### External API Calls

```typescript
const response = await fetch('https://api.external.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${Deno.env.get('EXTERNAL_API_KEY')}`,
  },
  body: JSON.stringify({ data: 'value' }),
});

const result = await response.json();
```

## Environment Variables

Access environment variables in functions:

```typescript
const apiKey = Deno.env.get('MY_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
```

Set them in Coolify under your Edge Functions service.

## Error Handling

Always wrap your code in try-catch:

```typescript
try {
  // Your code
} catch (error) {
  console.error('Function error:', error);
  return new Response(
    JSON.stringify({
      error: error.message,
      details: error.stack,
    }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
```

## Available Functions

- `hello` - Sample function demonstrating basic structure

## Deployment

Functions are automatically deployed when you push to GitHub (if auto-deploy is enabled in Coolify).

### Manual Deploy

Trigger a manual deploy in Coolify:

1. Go to your Edge Functions service
2. Click "Deploy"
3. Wait for build to complete

## Testing

### Local Testing

```bash
# Run with watch mode
deno run --allow-all --watch supabase/functions/my-function/index.ts

# Test with curl
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Production Testing

```bash
curl -X POST https://your-domain.com/my-function \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"test": "data"}'
```

## Best Practices

1. **Always handle CORS** - Use the `handleCors()` helper
2. **Validate input** - Check request body before processing
3. **Use TypeScript** - Full type safety with Deno
4. **Error logging** - Use `console.error()` for debugging
5. **Keep functions small** - One responsibility per function
6. **Use shared code** - Put common logic in `_shared/`
7. **Secure sensitive operations** - Use service role key only when needed
8. **Test locally first** - Before deploying to production

## Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Standard Library](https://deno.land/std)
- [Deno Third Party Modules](https://deno.land/x)
