import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 解析PDF
async function parsePDF(buffer: Buffer): Promise<string> {
  // pdf-parse 新版本 API
  const pdfParse = await import('pdf-parse');
  const PDFParse = (pdfParse as unknown as { PDFParse: new () => { load: (buf: Buffer) => Promise<void>; getText: () => Promise<string> } }).PDFParse;
  const parser = new PDFParse();
  await parser.load(buffer);
  return await parser.getText();
}

// 解析EPUB
async function parseEPUB(buffer: Buffer): Promise<string> {
  const EPub = (await import('epub')).default;
  const epub = new EPub(buffer);
  
  return new Promise((resolve, reject) => {
    let fullText = '';
    let pendingCount = 0;
    
    epub.on('end', () => {
      // 使用 spine.contents 获取章节列表
      const chapters = epub.spine.contents;
      if (!chapters || chapters.length === 0) {
        resolve(fullText);
        return;
      }
      
      pendingCount = chapters.length;
      
      chapters.forEach((item: { id: string }) => {
        epub.getChapter(item.id, (err: Error | null, data: string) => {
          if (!err && data) {
            // 移除HTML标签
            const text = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            fullText += text + '\n';
          }
          pendingCount--;
          if (pendingCount === 0) {
            resolve(fullText);
          }
        });
      });
    });
    
    epub.on('error', reject);
    epub.parse();
  });
}

// 解析DOCX
async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// 使用LLM提取要点和金句
async function extractKeyPoints(text: string, customHeaders: Record<string, string>): Promise<string[]> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);
  
  // 截取前20000字符以避免超出token限制
  const truncatedText = text.slice(0, 20000);
  
  const prompt = `请从以下书籍内容中提取要点和金句。要求：
1. 提取5-15个核心要点或精彩金句
2. 每个要点或金句单独一行
3. 保持原文的精炼和深度
4. 金句要能独立理解，有启发性

书籍内容：
${truncatedText}

请直接输出要点和金句，每行一个，不要添加序号或其他格式：`;

  const messages = [{ role: 'user' as const, content: prompt }];
  
  const response = await client.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.7,
  });
  
  // 解析结果，每行作为一个要点
  const lines = response.content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^[\d\-•\.\)]+\s*/)); // 过滤空行和纯序号行
  
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;
    
    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }
    
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let text = '';
    
    // 根据文件类型解析
    switch (fileType.toLowerCase()) {
      case 'pdf':
        text = await parsePDF(buffer);
        break;
      case 'epub':
        text = await parseEPUB(buffer);
        break;
      case 'docx':
      case 'doc':
        text = await parseDOCX(buffer);
        break;
      default:
        return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }
    
    if (!text || text.trim().length < 100) {
      return NextResponse.json({ error: '文件内容太少或无法解析' }, { status: 400 });
    }
    
    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 使用AI提取要点和金句
    const keyPoints = await extractKeyPoints(text, customHeaders);
    
    return NextResponse.json({
      success: true,
      keyPoints,
      originalLength: text.length,
    });
    
  } catch (error) {
    console.error('提取失败:', error);
    return NextResponse.json(
      { error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
