import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 配置运行时选项
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 增加执行时间限制

// 解析PDF - 使用 pdf-parse 1.x 版本
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF解析错误:', error);
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 解析EPUB - 使用 epub 2.x Promise-based API
async function parseEPUB(buffer: Buffer): Promise<string> {
  try {
    const EPubModule = await import('epub');
    const EPub = EPubModule.default || EPubModule;
    
    // 创建 EPub 实例
    const epub = new EPub(buffer, '/images/', '/chapters/');
    
    // 使用 Promise-based API 解析
    await epub.parse();
    
    let fullText = '';
    
    // 获取章节列表
    const chapters = epub.spine?.contents || epub.flow || [];
    
    if (chapters.length === 0) {
      return fullText;
    }
    
    // 逐个获取章节内容
    for (const item of chapters) {
      try {
        const chapterId = item.id || item.href;
        if (!chapterId) continue;
        
        const data = await epub.getChapter(chapterId);
        if (data) {
          // 移除HTML标签
          const text = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
          fullText += text + '\n';
        }
      } catch (chapterError) {
        console.warn('章节解析失败:', chapterError);
      }
    }
    
    return fullText;
  } catch (error) {
    console.error('EPUB解析错误:', error);
    throw new Error(`EPUB解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
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
  
  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-lite-251015',
      temperature: 0.7,
    });
    
    console.log('LLM原始响应:', response.content?.slice(0, 500));
    
    // 解析结果，每行作为一个要点
    // 先移除序号前缀，再过滤空行
    const lines = response.content
      .split('\n')
      .map(line => line.trim())
      .map(line => line.replace(/^[\d\-•\.\)、]+\s*/, '').trim()) // 移除序号前缀
      .filter(line => line.length > 5); // 过滤太短的行
    
    console.log('解析后的要点数量:', lines.length);
    
    return lines;
  } catch (error) {
    console.error('LLM调用失败:', error);
    throw new Error(`AI提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
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
      case 'txt':
        // 也支持TXT用于测试
        text = buffer.toString('utf-8');
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
