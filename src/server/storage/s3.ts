import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function getS3Config() {
  return {
    region: process.env.REGION ?? "us-west-2",
    endpoint: requireEnv("SUPABASE_BUCKET_ENDPOINT"),
    bucket: requireEnv("BUCKET_NAME"),
    accessKeyId: requireEnv("SUPABASE_BUCKET_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("SUPABASE_BUCKET_SECRET"),
  };
}

let cachedClient: S3Client | null = null;

function getS3Client() {
  if (cachedClient) return cachedClient;
  const cfg = getS3Config();
  cachedClient = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

export function getBucketName() {
  return getS3Config().bucket;
}

export async function putObject(args: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
}) {
  const client = getS3Client();
  const bucket = getS3Config().bucket;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
    })
  );
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  if (typeof Blob !== "undefined" && stream instanceof Blob) {
    const ab = await stream.arrayBuffer();
    return Buffer.from(ab);
  }

  // Node stream
  const readable = stream as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getObjectBuffer(args: { key: string }) {
  const client = getS3Client();
  const bucket = getS3Config().bucket;
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: args.key }));
  if (!res.Body) {
    throw new Error("S3_OBJECT_BODY_EMPTY");
  }
  return streamToBuffer(res.Body);
}


