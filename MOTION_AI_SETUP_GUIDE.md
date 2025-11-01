# Motion AI Setup Guide
*Printyx CRM with Claude AI Integration*

## 🚀 Quick Start

This guide will help you set up the Motion AI integration in your Printyx CRM system.

### Prerequisites

- Printyx CRM system running
- Claude API access (Anthropic account)

---

## Step 1: Environment Configuration

### 1.1 Set Up Claude API Key

1. **Get Claude API Key**:
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create an account or sign in
   - Generate an API key

2. **Configure in Replit**:
   ```bash
   # In Replit, go to Secrets (Environment Variables)
   # Add the following key-value pair:
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

---

## Step 2: Database Migration

### 2.1 Run AI Enhancement Migration

```bash
# Navigate to server directory
cd server

# Run the AI migration script
npm run ts-node run-ai-migration.ts
```

---

## Step 3: Test Integration

### 3.1 Test API Endpoints

```bash
# Test health endpoint
curl http://localhost:5000/api/ai/health

# Test lead analysis
curl -X POST http://localhost:5000/api/ai/leads/analyze \
  -H "Content-Type: application/json" \
  -d '{"leadData": {"companyName": "Test Corp", "industry": "Manufacturing"}}'
```

---

## Step 4: Available Endpoints

- `GET /api/ai/health` - Health check
- `POST /api/ai/leads/analyze` - Analyze lead data

---

## Next Steps

1. **Set CLAUDE_API_KEY** in your environment
2. **Run the migration** to add AI database tables
3. **Test the endpoints** to verify integration
4. **Extend with more AI features** as needed

---

## Troubleshooting

If you encounter issues:

1. Check that CLAUDE_API_KEY is set
2. Verify the database migration completed
3. Check server logs for errors

---

**Welcome to intelligent CRM!** 🚀
