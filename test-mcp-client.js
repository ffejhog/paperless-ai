const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
require('dotenv').config();

async function testMCP() {
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const baseUrl = process.env.PAPERLESS_AI_URL || "http://localhost:3000";
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error('Error: API_KEY environment variable is not set');
    console.error('Please set API_KEY in your .env file');
    process.exit(1);
  }

  const transport = new SSEClientTransport(
    new URL(`${baseUrl}/mcp/sse`),
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  );

  try {
    console.log('Connecting to Paperless-AI MCP server...');
    await client.connect(transport);
    console.log('✓ Connected to Paperless-AI MCP server\n');

    // List available tools
    console.log('Listing available tools...');
    const tools = await client.listTools();
    console.log('✓ Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test search
    console.log('Testing search_documents tool...');
    const searchResult = await client.callTool({
      name: "search_documents",
      arguments: {
        query: "invoice",
        max_results: 3
      }
    });

    console.log('✓ Search results:');
    if (searchResult.content && searchResult.content[0]) {
      const results = JSON.parse(searchResult.content[0].text);
      console.log(`  Query: "${results.query}"`);
      console.log(`  Total found: ${results.total_found}`);
      console.log(`  Returned: ${results.results.length}`);

      if (results.results.length > 0) {
        console.log('\n  Documents:');
        results.results.forEach((doc, index) => {
          console.log(`  ${index + 1}. [ID: ${doc.doc_id}] ${doc.title}`);
          console.log(`     Score: ${doc.score}`);
          if (doc.snippet) {
            console.log(`     Snippet: ${doc.snippet.substring(0, 100)}...`);
          }
        });

        // Test document retrieval with the first result
        if (results.results[0]) {
          const docId = results.results[0].doc_id;
          console.log(`\n\nTesting get_document tool with document ID ${docId}...`);

          const docResult = await client.callTool({
            name: "get_document",
            arguments: { document_id: docId }
          });

          console.log('✓ Document retrieved:');
          if (docResult.content && docResult.content[0]) {
            const document = JSON.parse(docResult.content[0].text);
            console.log(`  ID: ${document.id}`);
            console.log(`  Title: ${document.title}`);
            console.log(`  Tags: ${document.tags.join(', ')}`);
            console.log(`  Correspondent: ${document.correspondent || 'None'}`);
            console.log(`  Created: ${document.created}`);
            console.log(`  Content length: ${document.content.length} characters`);
            console.log(`  Content preview: ${document.content.substring(0, 150)}...`);
          }
        }
      } else {
        console.log('  No documents found matching the query');
      }
    }

    console.log('\n✓ All tests completed successfully!');

  } catch (error) {
    console.error('\n✗ MCP test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  } finally {
    try {
      await client.close();
    } catch (error) {
      // Ignore close errors
    }
  }
}

// Run the test
console.log('='.repeat(60));
console.log('Paperless-AI MCP Server Test Client');
console.log('='.repeat(60));
console.log('');

testMCP().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
