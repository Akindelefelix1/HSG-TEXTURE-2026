import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client:S3Client; private readonly bucket:string; private readonly endpoint:string;
  constructor(config:ConfigService){this.bucket=config.getOrThrow('STORAGE_BUCKET');this.endpoint=config.getOrThrow<string>('AWS_ENDPOINT_URL_S3').replace(/\/+$/,'');this.client=new S3Client({region:config.getOrThrow('AWS_REGION'),endpoint:this.endpoint,forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',credentials:{accessKeyId:config.getOrThrow('AWS_ACCESS_KEY_ID'),secretAccessKey:config.getOrThrow('AWS_SECRET_ACCESS_KEY')}})}
  private normalizeKey(key:string|string[]){const raw=Array.isArray(key)?key.join('/'):key;return raw.includes('/')?raw:raw.replace(/,/g,'/')}
  async createUploadUrl(key:string,contentType:string){const normalized=this.normalizeKey(key);const url=await getSignedUrl(this.client,new PutObjectCommand({Bucket:this.bucket,Key:normalized,ContentType:contentType}),{expiresIn:300,signableHeaders:new Set(['content-type'])});return{key:normalized,url,contentType,expiresIn:300}}
  createReadUrl(key:string|string[]){const normalized=this.normalizeKey(key);const encodedKey=normalized.split('/').map(encodeURIComponent).join('/');const url=new URL(`${this.bucket}/${encodedKey}`,`${this.endpoint}/`).toString();return{key:normalized,url}}
  async remove(key:string|string[]){const normalized=this.normalizeKey(key);await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:normalized}))}
}
