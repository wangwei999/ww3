import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { uploadSessions } from '../init/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export async function POST(request: NextRequest) {
  try {
    const { uploadId, key } = await request.json();
    
    if (!uploadId || !key) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 获取上传会话
    const session = uploadSessions.get(uploadId);
    if (!session) {
      return NextResponse.json({ error: '上传会话不存在或已过期' }, { status: 404 });
    }
    
    // 检查所有分块是否已上传
    const missingChunks = session.chunks.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
    if (missingChunks.length > 0) {
      return NextResponse.json({ 
        error: '部分分块未上传', 
        missingChunks 
      }, { status: 400 });
    }
    
    // 合并所有分块
    const totalSize = session.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const mergedBuffer = Buffer.concat(session.chunks, totalSize);
    
    console.log(`合并分块完成，总大小: ${mergedBuffer.length} bytes`);
    
    // 上传到对象存储
    const actualKey = await storage.uploadFile({
      fileContent: mergedBuffer,
      fileName: key,
      contentType: 'application/octet-stream',
    });
    
    // 清理上传会话
    uploadSessions.delete(uploadId);
    
    console.log(`文件上传到对象存储成功: ${actualKey}`);
    
    return NextResponse.json({
      success: true,
      key: actualKey,
      size: mergedBuffer.length,
    });
    
  } catch (error) {
    console.error('完成上传失败:', error);
    return NextResponse.json(
      { error: `完成上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
