const { Storage } = require('@google-cloud/storage');

function hasMeaningfulValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function buildStorageClient() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (hasMeaningfulValue(credentialsJson)) {
    const parsed = JSON.parse(String(credentialsJson));
    return new Storage({ credentials: parsed });
  }

  return new Storage();
}

class GcsService {
  isEnabled() {
    return hasMeaningfulValue(process.env.GCS_BUCKET);
  }

  getBucketName() {
    return String(process.env.GCS_BUCKET || '').trim();
  }

  async uploadBuffer({ objectName, buffer, contentType }) {
    if (!this.isEnabled()) {
      throw new Error('GCS_BUCKET nao configurado');
    }

    const bucketName = this.getBucketName();
    const storage = buildStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      resumable: false,
      contentType: contentType || 'application/octet-stream',
      metadata: {
        cacheControl: 'private, max-age=0, no-transform'
      }
    });

    return { bucket: bucketName, object: objectName };
  }

  async downloadBuffer({ bucketName, objectName }) {
    const storage = buildStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);
    const [data] = await file.download();
    return data;
  }
}

module.exports = new GcsService();

