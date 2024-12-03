import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DocumentChunk {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  preview: string;
}

export interface DocumentInfo {
  id: string;
  filename: string;
  fileType: string;
  totalChunks: number;
  textLength: number;
  processedAt: string;
}

class DocumentApi {
  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Search within uploaded documents for a specific conversation
   */
  async searchDocuments(query: string, conversationId: string, topK: number = 5): Promise<DocumentChunk[]> {
    try {
      const response = await axios.post(
        `${API_URL}/api/documents/search`,
        { query, conversationId, topK },
        { headers: this.getHeaders() }
      );
      return response.data.results || [];
    } catch (error) {
      console.error('Document search error:', error);
      throw error;
    }
  }

  /**
   * List documents for a specific conversation
   */
  async listDocuments(conversationId: string): Promise<DocumentInfo[]> {
    try {
      const response = await axios.get(
        `${API_URL}/api/documents/list?conversationId=${conversationId}`,
        { headers: this.getHeaders() }
      );
      return response.data.documents || [];
    } catch (error) {
      console.error('List documents error:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_URL}/api/documents/${documentId}`,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      console.error('Delete document error:', error);
      throw error;
    }
  }

  /**
   * Enhance a chat message with document context
   */
  async enhanceMessageWithDocuments(message: string, conversationId: string): Promise<string> {
    try {
      // Search for relevant document chunks
      const chunks = await this.searchDocuments(message, conversationId, 3);
      
      if (chunks.length === 0) {
        return message;
      }

      // Build enhanced message with document context
      const contextParts = chunks.map((chunk, index) => 
        `[Document ${index + 1}: ${chunk.filename}]\n${chunk.content}`
      );

      const enhancedMessage = `${message}\n\n--- Document Context ---\n${contextParts.join('\n\n---\n\n')}`;
      
      return enhancedMessage;
    } catch (error) {
      console.error('Error enhancing message with documents:', error);
      return message; // Return original message on error
    }
  }

  /**
   * Send a message with document context to AI
   */
  async sendMessageWithDocuments(message: string): Promise<string> {
    try {
      const response = await axios.post(
        `${API_URL}/api/ai/search`,
        { 
          query: message,
          useDocuments: true 
        },
        { headers: this.getHeaders() }
      );
      return response.data.response || '';
    } catch (error) {
      console.error('Send message with documents error:', error);
      throw error;
    }
  }
}

export const documentApi = new DocumentApi();
