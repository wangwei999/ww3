import { NextRequest, NextResponse } from 'next/server';
import { uploadSessions } from '../init/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    
    if (!chunk || !uploadId || isNaN(chunkIndex)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 获取上传会话
    const session = uploadSessions.get(uploadId);
    if (!session) {
      return NextResponse.json({ error: '上传会话不存在或已过期' }, { status: 404 });
    }
    
    // 读取分块数据
    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 存储分块
    session.chunks[chunkIndex] = buffer;
    
    console.log(`收到分块 ${chunkIndex + 1}/${totalChunks}, 大小: ${buffer.length} bytes`);
    
    return NextResponse.json({
      success: true,
      chunkIndex,
      received: buffer.length,
    });
    
  } catch (error) {
    console.error('上传分块失败:', error);
    return NextResponse.json(
      { error: `上传分块失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
