import * as fs from 'fs-extra';
import * as path from 'path';
import Tesseract from 'tesseract.js';
import ShortUniqueId from 'short-unique-id';
import { logger } from '../utils/logger';

// Import pdf-parse v2 API
const { PDFParse } = require('pdf-parse');

const uid = new ShortUniqueId({ length: 10 });

export interface DocumentChunk {
  id: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  createdAt: string;
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  fileType: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  extractedText: string;
  processedAt: string;
}

class DocumentService {
  private uploadsDir = path.join(__dirname, '../../uploads');
  private documentsStore: Map<string, ProcessedDocument> = new Map();
  private userDocuments: Map<string, string[]> = new Map(); // userId -> documentIds[]

  constructor() {
    // Ensure uploads directory exists
    fs.ensureDirSync(this.uploadsDir);
  }

  /**
   * Extract text from PDF
   */
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      logger.info('Starting PDF extraction', { filePath });
      
      // Read the PDF file
      const dataBuffer = await fs.readFile(filePath);
      logger.info('PDF file read successfully', { size: dataBuffer.length });
      
      // Create PDF parser instance with data
      const parser = new PDFParse({ 
        verbosity: 0,
        data: dataBuffer
      });
      
      // Load the PDF
      await parser.load();
      logger.info('PDF loaded successfully');
      
      // Extract text from all pages
      const result = await parser.getText();
      logger.info('PDF text extracted successfully', { 
        resultType: typeof result,
        hasText: result && typeof result === 'object' && 'text' in result
      });
      
      // The result is an object with a text property
      const text = typeof result === 'object' && result !== null && 'text' in result 
        ? (result as any).text 
        : String(result || '');
      
      logger.info('Final text length:', text.length);
      
      // Clean up
      await parser.destroy();
      
      return text || '';
    } catch (error) {
      logger.error('PDF extraction error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filePath 
      });
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(filePath: string): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.info(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      return text;
    } catch (error) {
      logger.error('OCR extraction error', { error, filePath });
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Chunk text into manageable pieces
   */
  chunkText(text: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Process uploaded file
   */
  async processFile(
    filePath: string,
    filename: string,
    userId: string
  ): Promise<ProcessedDocument> {
    try {
      const fileExt = path.extname(filename).toLowerCase();
      let extractedText = '';

      // Extract text based on file type
      if (fileExt === '.pdf') {
        extractedText = await this.extractTextFromPDF(filePath);
        
        // If PDF text is empty, it might be scanned - try OCR
        if (!extractedText.trim()) {
          logger.info('PDF appears to be scanned, attempting OCR');
          extractedText = await this.extractTextFromImage(filePath);
        }
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExt)) {
        extractedText = await this.extractTextFromImage(filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // Clean text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!extractedText) {
        throw new Error('No text could be extracted from the file');
      }

      // IMPORTANT: Clear old documents before adding new one
      // This prevents document accumulation across uploads
      logger.info('Clearing previous documents before adding new one', { userId });
      this.clearUserDocuments(userId);

      // Chunk the text
      const textChunks = this.chunkText(extractedText, 1000);
      const documentId = uid.rnd();

      // Create document chunks
      const chunks: DocumentChunk[] = textChunks.map((content, index) => ({
        id: `${documentId}_chunk_${index}`,
        documentId,
        filename,
        chunkIndex: index,
        content,
        createdAt: new Date().toISOString()
      }));

      // Create processed document
      const processedDoc: ProcessedDocument = {
        id: documentId,
        filename,
        fileType: fileExt,
        chunks,
        totalChunks: chunks.length,
        extractedText,
        processedAt: new Date().toISOString()
      };

      // Store document
      this.documentsStore.set(documentId, processedDoc);

      // Associate with user (now only this document)
      this.userDocuments.set(userId, [documentId]);

      // Clean up uploaded file
      await fs.remove(filePath);

      logger.info('Document processed successfully', {
        documentId,
        filename,
        chunks: chunks.length,
        textLength: extractedText.length
      });

      return processedDoc;
    } catch (error) {
      // Clean up file on error
      await fs.remove(filePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Search documents using simple keyword matching
   */
  searchDocuments(query: string, userId: string, topK: number = 5): DocumentChunk[] {
    const userDocs = this.userDocuments.get(userId) || [];
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    
    const scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const docId of userDocs) {
      const doc = this.documentsStore.get(docId);
      if (!doc) continue;

      for (const chunk of doc.chunks) {
        const content = chunk.content.toLowerCase();
        let score = 0;

        // Count keyword matches
        for (const keyword of keywords) {
          const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
        }

        if (score > 0) {
          scoredChunks.push({ chunk, score });
        }
      }
    }

    // Sort by score and return top K
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  }

  /**
   * Get user's documents
   */
  getUserDocuments(userId: string): ProcessedDocument[] {
    const userDocs = this.userDocuments.get(userId) || [];
    return userDocs
      .map(docId => this.documentsStore.get(docId))
      .filter((doc): doc is ProcessedDocument => doc !== undefined);
  }

  /**
   * Delete document
   */
  deleteDocument(documentId: string, userId: string): boolean {
    const userDocs = this.userDocuments.get(userId) || [];
    const docIndex = userDocs.indexOf(documentId);
    
    if (docIndex === -1) {
      return false;
    }

    // Remove from user's documents
    userDocs.splice(docIndex, 1);
    this.userDocuments.set(userId, userDocs);

    // Remove from store
    this.documentsStore.delete(documentId);

    logger.info('Document deleted', { documentId, userId });
    return true;
  }

  /**
   * Clear all documents for a user
   */
  clearUserDocuments(userId: string): void {
    const userDocs = this.userDocuments.get(userId) || [];
    
    // Remove all documents from store
    userDocs.forEach(docId => {
      this.documentsStore.delete(docId);
    });
    
    // Clear user's document list
    this.userDocuments.set(userId, []);
    
    logger.info('Cleared all documents for user', { userId, count: userDocs.length });
  }
}

export const documentService = new DocumentService();
