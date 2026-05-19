import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { EnvService } from './env';

type UploadedFileLike = {
  buffer?: Buffer;
  mimetype?: string;
  originalname: string;
  path?: string;
  size?: number;
};

type StoredObject = {
  filePath?: string;
  body?: NodeJS.ReadableStream;
  contentType?: string;
};

@Injectable()
export class ObjectStorageService {
  private s3Client: S3Client | null = null;

  constructor(private readonly env: EnvService) {}

  async saveUploadedFile(file: UploadedFileLike, keyPrefix: string): Promise<string> {
    const buffer = await this.getFileBuffer(file);
    const fileName = this.buildObjectFileName(file.originalname);

    if (this.env.storageDriver === 'r2') {
      const bucket = this.env.r2Bucket;
      const key = this.joinKeyParts(this.env.uploadStorageKeyPrefix, keyPrefix, fileName);

      await this.getS3Client().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype || undefined,
          ContentLength: file.size || buffer.length
        })
      );

      return `r2://${bucket}/${key}`;
    }

    const dir = path.resolve(
      process.cwd(),
      this.env.uploadStorageLocalDir,
      this.normalizeKeyPrefix(this.env.uploadStorageKeyPrefix),
      this.normalizeKeyPrefix(keyPrefix)
    );
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, buffer);
    return filePath;
  }

  async openStoredObject(storedPath: string): Promise<StoredObject> {
    if (!this.isR2Uri(storedPath)) {
      return { filePath: this.resolveLocalPath(storedPath) };
    }

    const { bucket, key } = this.parseR2Uri(storedPath);
    const response = await this.getS3Client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    return {
      body: this.toNodeStream(response.Body),
      contentType: response.ContentType
    };
  }

  getStoredObjectExtension(storedPath: string): string {
    return path.extname(this.isR2Uri(storedPath) ? this.parseR2Uri(storedPath).key : storedPath);
  }

  private async getFileBuffer(file: UploadedFileLike): Promise<Buffer> {
    if (file.buffer?.length) {
      return file.buffer;
    }

    if (file.path) {
      return readFile(file.path);
    }

    throw new InternalServerErrorException('Uploaded file body is missing');
  }

  private getS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }

    this.s3Client = new S3Client({
      region: this.env.r2Region,
      endpoint: this.env.r2Endpoint,
      credentials: {
        accessKeyId: this.env.r2AccessKeyId,
        secretAccessKey: this.env.r2SecretAccessKey
      },
      forcePathStyle: true
    });

    return this.s3Client;
  }

  private buildObjectFileName(originalName: string): string {
    const extension = path.extname(originalName || '').toLowerCase();
    return `${Date.now()}_${randomUUID()}${extension}`;
  }

  private normalizeKeyPrefix(value: string): string {
    return value
      .split('/')
      .map((part) => part.trim().replace(/[^a-zA-Z0-9._=-]/g, '_'))
      .filter(Boolean)
      .join('/');
  }

  private joinKeyParts(...parts: string[]): string {
    return parts
      .flatMap((part) => this.normalizeKeyPrefix(part).split('/'))
      .filter(Boolean)
      .join('/');
  }

  private isR2Uri(value: string): boolean {
    return value.startsWith('r2://');
  }

  private parseR2Uri(value: string): { bucket: string; key: string } {
    const withoutScheme = value.slice('r2://'.length);
    const separatorIndex = withoutScheme.indexOf('/');
    if (separatorIndex <= 0 || separatorIndex === withoutScheme.length - 1) {
      throw new InternalServerErrorException('Stored R2 object path is invalid');
    }

    return {
      bucket: withoutScheme.slice(0, separatorIndex),
      key: withoutScheme.slice(separatorIndex + 1)
    };
  }

  private resolveLocalPath(storedPath: string): string {
    if (path.isAbsolute(storedPath)) {
      return storedPath;
    }

    const fileName = path.basename(storedPath);
    const candidates = [
      path.resolve(process.cwd(), storedPath),
      path.resolve(process.cwd(), this.env.uploadStorageLocalDir, fileName),
      path.resolve(process.cwd(), 'apps/api', storedPath),
      path.resolve(process.cwd(), 'apps/api/uploads', fileName),
      path.resolve(process.cwd(), '..', '..', storedPath),
      path.resolve(process.cwd(), '..', '..', 'apps/api/uploads', fileName)
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
  }

  private toNodeStream(body: unknown): NodeJS.ReadableStream {
    if (body instanceof Readable) {
      return body;
    }

    if (body && typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
      return Readable.from(body as AsyncIterable<Uint8Array>);
    }

    throw new InternalServerErrorException('Stored object body is not readable');
  }
}
