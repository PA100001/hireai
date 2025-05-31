const fs = require('fs');
const path = require('path');
const WordExtractor = require('word-extractor');
const pdfParse = require('pdf-parse');

const extractor = new WordExtractor();

/**
 * Extracts text from a Word (.doc) or PDF (.pdf) file.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} - The extracted text.
 */
async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    if (ext === '.doc') {
        const doc = await extractor.extract(filePath);
        return doc.getBody();
    } else if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } else {
        throw new Error('Unsupported file type. Only .doc and .pdf are supported.');
    }
}

module.exports = extractText;
