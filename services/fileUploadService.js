const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

class FileUploadService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf']
    };
    
    this.setupUploadDirectory();
  }

  async setupUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'kyc'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'temp'), { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directories:', error);
    }
  }

  // Configure multer storage
  getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(this.uploadDir, 'temp');
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    });
  }

  // File filter
  fileFilter(req, file, cb) {
    const mimeType = file.mimetype;
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (this.allowedMimeTypes[mimeType] && this.allowedMimeTypes[mimeType].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${Object.keys(this.allowedMimeTypes).join(', ')}`), false);
    }
  }

  // Get multer configuration
  getMulterConfig() {
    return {
      storage: this.getStorage(),
      fileFilter: this.fileFilter.bind(this),
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Maximum 5 files per request
      }
    };
  }

  // Process uploaded file
  async processFile(tempFilePath, originalFileName, documentType, userId) {
    try {
      const ext = path.extname(originalFileName).toLowerCase();
      const fileName = `${userId}_${documentType}_${Date.now()}${ext}`;
      const finalPath = path.join(this.uploadDir, 'kyc', fileName);

      // Get file stats
      const stats = await fs.stat(tempFilePath);
      const mimeType = this.getMimeType(ext);

      // Process based on file type
      if (mimeType.startsWith('image/')) {
        await this.processImage(tempFilePath, finalPath);
      } else if (mimeType === 'application/pdf') {
        await this.processPDF(tempFilePath, finalPath);
      } else {
        // Copy file as is
        await fs.copyFile(tempFilePath, finalPath);
      }

      // Clean up temp file
      await fs.unlink(tempFilePath);

      return {
        fileName,
        originalFileName,
        filePath: finalPath,
        fileSize: stats.size,
        mimeType
      };
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('Failed to clean up temp file:', unlinkError);
      }
      throw error;
    }
  }

  // Process image files
  async processImage(inputPath, outputPath) {
    try {
      await sharp(inputPath)
        .resize(1200, 1200, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(outputPath);
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error('Failed to process image');
    }
  }

  // Process PDF files
  async processPDF(inputPath, outputPath) {
    try {
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Basic PDF validation - ensure it's not corrupted
      const pageCount = pdfDoc.getPageCount();
      if (pageCount === 0) {
        throw new Error('Invalid PDF: No pages found');
      }

      // Save processed PDF
      const pdfBytesProcessed = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytesProcessed);
    } catch (error) {
      console.error('PDF processing failed:', error);
      throw new Error('Failed to process PDF');
    }
  }

  // Get MIME type from extension
  getMimeType(ext) {
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf'
    };
    return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
  }

  // Validate file size
  validateFileSize(fileSize) {
    return fileSize <= this.maxFileSize;
  }

  // Get file info
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error('File not found');
    }
  }

  // Delete file
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  // Generate file URL
  generateFileUrl(fileName) {
    return `/api/kyc/download/${fileName}`;
  }

  // Clean up old temp files
  async cleanupTempFiles() {
    try {
      const tempDir = path.join(this.uploadDir, 'temp');
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }
}

module.exports = new FileUploadService();
