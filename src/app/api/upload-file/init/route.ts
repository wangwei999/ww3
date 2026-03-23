import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 内存中存储上传状态（生产环境应使用 Redis 或数据库）
const uploadSessions = new Map<string, {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  chunks: Buffer[];
  createdAt: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileSize, totalChunks } = await request.json();
    
    if (!fileName || !fileSize || !totalChunks) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 生成安全的文件名
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `book-uploads/${Date.now()}_${safeName}`;
    
    // 生成上传 ID
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 初始化上传会话
    uploadSessions.set(uploadId, {
      fileName,
      fileSize,
      totalChunks,
      chunks: new Array(totalChunks).fill(null),
      createdAt: Date.now(),
    });
    
    // 清理过期会话（超过 1 小时）
    for (const [id, session] of uploadSessions.entries()) {
      if (Date.now() - session.createdAt > 3600000) {
        uploadSessions.delete(id);
      }
    }
    
    console.log(`初始化上传: ${uploadId}, 文件: ${fileName}, 分块数: ${totalChunks}`);
    
    return NextResponse.json({
      success: true,
      uploadId,
      key,
    });
    
  } catch (error) {
    console.error('初始化上传失败:', error);
    return NextResponse.json(
      { error: `初始化上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export { uploadSessions };
