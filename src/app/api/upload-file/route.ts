import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }
    
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 生成安全的文件名
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `book-uploads/${Date.now()}_${safeName}`;
    
    // 上传到对象存储
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: fileName,
      contentType: file.type || 'application/octet-stream',
    });
    
    console.log(`文件上传成功: ${key}, 大小: ${buffer.length} bytes`);
    
    return NextResponse.json({
      success: true,
      key: key,
      fileName: file.name,
      size: buffer.length,
    });
    
  } catch (error) {
    console.error('上传失败:', error);
    return NextResponse.json(
      { error: `上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
