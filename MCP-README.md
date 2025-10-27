# MCP Server for Paperless-AI

## Overview

Paperless-AI now includes a Model Context Protocol (MCP) server that allows external AI agents and applications to search and retrieve documents via a standardized interface. This enables any MCP-compatible AI system (like Claude Desktop, custom AI agents, etc.) to access your document repository.

## Features

- **Semantic Document Search**: Search documents using RAG-powered semantic search
- **Document Retrieval**: Get full document content and metadata by ID
- **Secure Authentication**: Bearer token authentication using your existing API key
- **SSE Transport**: Real-time Server-Sent Events for efficient communication

## Setup

### 1. Enable MCP Server

Add to your `.env` file:

```bash
# Enable MCP server
ENABLE_MCP_SERVER=true

# Your API key (if not already set)
API_KEY=your-static-api-key-here
```

### 2. Ensure RAG Service is Running

The MCP server requires the RAG service for semantic search. Make sure these are set in your `.env`:

```bash
RAG_SERVICE_ENABLED=true
RAG_SERVICE_URL=http://localhost:8000
```

### 3. Start the Server

```bash
npm start
```

You should see:
```
Initializing MCP server...
MCP server endpoints registered
```

## Testing

Run the included test client:

```bash
npm run mcp-test
```

This will:
1. Connect to the MCP server
2. List available tools
3. Perform a sample document search
4. Retrieve a document's full content

## Available Tools

### 1. search_documents

Search documents using semantic RAG search.

**Parameters:**
- `query` (required): Search terms or semantic query
- `max_results` (optional): Maximum documents to return (default: 5)
- `from_date` (optional): Filter from date (YYYY-MM-DD)
- `to_date` (optional): Filter to date (YYYY-MM-DD)
- `correspondent` (optional): Filter by correspondent name

**Example:**
```json
{
  "name": "search_documents",
  "arguments": {
    "query": "expense reports March 2024",
    "max_results": 5,
    "from_date": "2024-03-01",
    "to_date": "2024-03-31"
  }
}
```

**Response:**
```json
{
  "query": "expense reports March 2024",
  "total_found": 3,
  "results": [
    {
      "doc_id": 123,
      "title": "Travel Expense Report - March 2024",
      "score": 0.89,
      "snippet": "March 2024 business travel expenses..."
    }
  ]
}
```

### 2. get_document

Retrieve full document content and metadata by document ID.

**Parameters:**
- `document_id` (required): Document ID from search results

**Example:**
```json
{
  "name": "get_document",
  "arguments": {
    "document_id": 123
  }
}
```

**Response:**
```json
{
  "id": 123,
  "title": "Travel Expense Report - March 2024",
  "content": "Full document text content here...",
  "tags": ["expenses", "travel", "2024"],
  "correspondent": "Acme Corp",
  "created": "2024-03-15T10:30:00Z",
  "document_type": "Invoice"
}
```

## API Endpoints

### Discovery Endpoint

```
GET http://localhost:3000/mcp
```

Returns server information and available tools.

### SSE Endpoint (MCP Connection)

```
GET http://localhost:3000/mcp/sse
Authorization: Bearer your-api-key-here
```

Server-Sent Events endpoint for MCP client connections.

## Client Integration

### Node.js Client Example

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

async function connectToMCP() {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new SSEClientTransport(
    new URL("http://localhost:3000/mcp/sse"),
    {
      headers: {
        'Authorization': 'Bearer your-api-key-here'
      }
    }
  );

  await client.connect(transport);

  // Search documents
  const result = await client.callTool({
    name: "search_documents",
    arguments: {
      query: "invoice",
      max_results: 3
    }
  });

  console.log(result);
}
```

### Claude Desktop Configuration

Add to your Claude Desktop configuration file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "paperless-ai": {
      "command": "node",
      "args": ["/path/to/paperless-ai/test-mcp-client.js"],
      "env": {
        "API_KEY": "your-paperless-ai-api-key",
        "PAPERLESS_AI_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Python Client Example

```python
import asyncio
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {
        "Authorization": "Bearer your-api-key-here"
    }

    async with sse_client("http://localhost:3000/mcp/sse", headers=headers) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            # Initialize
            await session.initialize()

            # Search documents
            result = await session.call_tool(
                "search_documents",
                {"query": "invoice", "max_results": 3}
            )
            print(result)

asyncio.run(main())
```

## Security

### Authentication

All MCP endpoints require Bearer token authentication using your API key:

```
Authorization: Bearer your-api-key-here
```

### Best Practices

1. **Secure Your API Key**: Never commit your `.env` file or expose your API key
2. **Use HTTPS**: In production, serve the MCP server over HTTPS
3. **Rate Limiting**: Consider implementing rate limiting for production use
4. **Access Control**: Ensure proper Paperless-ngx permissions are configured

## Troubleshooting

### "Missing Authorization header"

Make sure you're including the Bearer token in your requests:
```
Authorization: Bearer your-api-key-here
```

### "Invalid API key"

Verify that:
1. `API_KEY` is set in your `.env` file
2. The key matches what you're sending in the Authorization header
3. There are no extra spaces or encoding issues

### "RAG service is not enabled"

Ensure in your `.env`:
```bash
RAG_SERVICE_ENABLED=true
RAG_SERVICE_URL=http://localhost:8000
```

And that the RAG service is running on port 8000.

### "Document not found"

Verify:
1. The document ID exists in Paperless-ngx
2. Your Paperless-AI user has permission to access the document
3. The document has been indexed by the RAG service

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agent      │───▶│  MCP Client     │───▶│ Paperless-AI    │
│ (Claude, etc.)  │    │ (SSE Transport) │    │ MCP Server      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                              ┌─────────────────────────────────────┐
                              │     Paperless-AI Services          │
                              │                                     │
                              │  ┌─────────────┐ ┌─────────────┐   │
                              │  │ RAG Service │ │ Paperless   │   │
                              │  │ (Port 8000) │ │ Service     │   │
                              │  └─────────────┘ └─────────────┘   │
                              └─────────────────────────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Paperless-ngx  │
                                              │   (Documents)   │
                                              └─────────────────┘
```

## Implementation Files

- `mcp-server.js`: Core MCP server implementation
- `server.js`: Integration with main Express app (lines 11, 456-519)
- `test-mcp-client.js`: Test client for verification
- `.env.example`: Configuration template

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs for error messages
3. Ensure all prerequisites (RAG service, Paperless-ngx) are running
4. Open an issue on the Paperless-AI GitHub repository

## License

Same as Paperless-AI main project (MIT)
