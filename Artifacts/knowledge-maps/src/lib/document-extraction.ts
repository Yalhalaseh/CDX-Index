import mammoth from 'mammoth';
import { unzipSync, strFromU8 } from 'fflate';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 100_000;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;

export type ExtractedDocument = {
  text: string;
  fileName: string;
  truncated: boolean;
};

function normalizeText(text: string) {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

function finalize(text: string, fileName: string): ExtractedDocument {
  const normalized = normalizeText(text);
  if (!normalized) throw new Error('No readable text was found in this file.');
  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS),
    fileName,
    truncated: normalized.length > MAX_EXTRACTED_CHARACTERS,
  };
}

async function extractPdf(file: File) {
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
  }
  const text = pages.join('\n\n');
  if (!text.trim()) throw new Error('This PDF appears to contain scanned images without readable text.');
  return text;
}

async function extractPptx(file: File) {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(entries);
  if (names.length > MAX_ARCHIVE_ENTRIES) throw new Error('This presentation contains too many embedded files.');
  const totalBytes = names.reduce((total, name) => total + entries[name].byteLength, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error('This presentation is too large after extraction.');
  const slideNames = names
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  return slideNames.map((name, index) => {
    const xml = new DOMParser().parseFromString(strFromU8(entries[name]), 'application/xml');
    const text = Array.from(xml.getElementsByTagNameNS('*', 't')).map((node) => node.textContent ?? '').join(' ');
    return `Slide ${index + 1}\n${text}`;
  }).join('\n\n');
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 25 MB.');
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();
  let text: string;
  if (extension === 'txt' || extension === 'md' || extension === 'markdown') {
    text = await file.text();
  } else if (extension === 'pdf') {
    text = await extractPdf(file);
  } else if (extension === 'docx') {
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (extension === 'pptx') {
    text = await extractPptx(file);
  } else if (extension === 'doc' || extension === 'ppt') {
    throw new Error('Legacy Word and PowerPoint files are not supported. Save the file as .docx or .pptx first.');
  } else {
    throw new Error('Supported files are TXT, Markdown, PDF, DOCX, and PPTX.');
  }
  return finalize(text, file.name);
}
