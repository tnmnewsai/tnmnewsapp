import fs from "node:fs";
import path from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const required = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
}

const storageRoot = path.resolve(process.argv[2] ?? "../../.data/storage");
if (!fs.existsSync(storageRoot)) throw new Error(`Storage directory not found: ${storageRoot}`);

const client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

const files = walk(storageRoot);
let uploaded = 0;
let verified = 0;
let bytes = 0;

for (const localPath of files) {
  const key = path.relative(storageRoot, localPath).split(path.sep).join("/");
  const size = fs.statSync(localPath).size;

  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(localPath),
  }));
  uploaded += 1;
  bytes += size;

  const head = await client.send(new HeadObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  }));
  if (Number(head.ContentLength) !== size) {
    throw new Error(`Size verification failed for uploaded object ${uploaded}`);
  }
  verified += 1;
}

console.log(JSON.stringify({ uploaded, verified, bytes }));
