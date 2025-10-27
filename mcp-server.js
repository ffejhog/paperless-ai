const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const ragService = require('./services/ragService');
const paperlessService = require('./services/paperlessService');

class PaperlessAIMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "paperless-ai",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupHandlers();
  }

  setupTools() {
    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_documents",
          description: "Search documents using Paperless-AI's semantic RAG search",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search terms or semantic query"
              },
              max_results: {
                type: "number",
                description: "Maximum documents to return",
                default: 5
              },
              from_date: {
                type: "string",
                description: "Filter from date (YYYY-MM-DD)"
              },
              to_date: {
                type: "string",
                description: "Filter to date (YYYY-MM-DD)"
              },
              correspondent: {
                type: "string",
                description: "Filter by correspondent name"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "get_document",
          description: "Retrieve full document content and metadata by document ID",
          inputSchema: {
            type: "object",
            properties: {
              document_id: {
                type: "number",
                description: "Document ID from search results"
              }
            },
            required: ["document_id"]
          }
        }
      ]
    }));
  }

  setupHandlers() {
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "search_documents":
          return await this.searchDocuments(args);
        case "get_document":
          return await this.getDocument(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async searchDocuments(args) {
    try {
      // Check if RAG service is enabled
      if (process.env.RAG_SERVICE_ENABLED !== 'true') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "RAG service is not enabled. Please enable it in your environment configuration."
            }, null, 2)
          }],
          isError: true
        };
      }

      const results = await ragService.search(args.query, {
        from_date: args.from_date,
        to_date: args.to_date,
        correspondent: args.correspondent
      });

      const limitedResults = results.slice(0, args.max_results || 5);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            query: args.query,
            total_found: results.length,
            results: limitedResults.map(doc => ({
              doc_id: doc.doc_id,
              title: doc.title,
              score: doc.score,
              snippet: doc.snippet || doc.text?.substring(0, 200)
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('[MCP] Search error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Search error: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  async getDocument(args) {
    try {
      // Get document content and metadata
      const [content, metadata] = await Promise.all([
        paperlessService.getDocumentContent(args.document_id),
        paperlessService.getDocument(args.document_id)
      ]);

      // Get tag names from tag IDs
      let tagNames = [];
      if (metadata.tags && metadata.tags.length > 0) {
        tagNames = await Promise.all(
          metadata.tags.map(async (tagId) => {
            try {
              return await paperlessService.getTagNameById(tagId);
            } catch (error) {
              console.error(`[MCP] Error fetching tag name for ID ${tagId}:`, error);
              return null;
            }
          })
        );
        tagNames = tagNames.filter(name => name !== null);
      }

      // Get correspondent name if available
      let correspondentName = null;
      if (metadata.correspondent) {
        try {
          const correspondent = await paperlessService.getCorrespondentNameById(metadata.correspondent);
          correspondentName = correspondent?.name || null;
        } catch (error) {
          console.error('[MCP] Error fetching correspondent name:', error);
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            id: args.document_id,
            title: metadata.title,
            content: content,
            tags: tagNames,
            correspondent: correspondentName,
            created: metadata.created,
            document_type: metadata.document_type,
            added: metadata.added,
            modified: metadata.modified
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('[MCP] Document retrieval error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Document retrieval error: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}

module.exports = PaperlessAIMCPServer;
