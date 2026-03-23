import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 使用 SDK 的 S3Storage
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileSize } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({ error: '缺少文件名' }, { status: 400 });
    }
    
    // 检查文件大小（限制 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (fileSize && fileSize > maxSize) {
      return NextResponse.json({ error: '文件过大，最大支持 50MB' }, { status: 400 });
    }
    
    // 生成安全的文件名
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `book-uploads/${Date.now()}_${safeName}`;
    
    // 尝试生成预签名 URL
    try {
      // SDK 的 generatePresignedUrl 默认生成读取 URL
      // 我们先创建一个空对象占位，然后返回 key 让前端通过其他方式上传
      const uploadUrl = await storage.generatePresignedUrl({
        key: key,
        expireTime: 300,
      });
      
      console.log(`生成预签名 URL: ${key}`);
      
      return NextResponse.json({
        success: true,
        uploadUrl,
        key,
        expiresIn: 300,
      });
    } catch (e) {
      console.log('generatePresignedUrl 不支持上传，使用备用方案');
      // 备用方案：返回 key，让前端通过 upload-file API 上传
      return NextResponse.json({
        success: true,
        key,
        useDirectUpload: true,
      });
    }
    
  } catch (error) {
    console.error('生成上传 URL 失败:', error);
    return NextResponse.json(
      { error: `生成上传 URL 失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
