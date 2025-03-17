import { Storage } from '@google-cloud/storage';
import { SpeechClient, protos } from '@google-cloud/speech';
import path from 'path';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS,
});

// Initialize Google Cloud Speech-to-Text
const speechClient = new SpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS,
});

// Define the bucket name for storing audio files
const bucketName = 'sermon-audio-files';

// Create the bucket if it doesn't exist
export const createBucketIfNotExists = async () => {
  try {
    const [exists] = await storage.bucket(bucketName).exists();
    if (!exists) {
      await storage.createBucket(bucketName);
      console.log(`Bucket ${bucketName} created.`);
    }
  } catch (error) {
    console.error('Error creating bucket:', error);
    throw error;
  }
};

// Upload an audio file to Google Cloud Storage
export const uploadAudioFile = async (filePath: string, fileName: string) => {
  try {
    await createBucketIfNotExists();
    
    const destination = `sermons/${fileName}`;
    await storage.bucket(bucketName).upload(filePath, {
      destination,
      metadata: {
        contentType: 'audio/wav', // Adjust based on file type
      },
    });
    
    return `gs://${bucketName}/${destination}`;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Transcribe an audio file using Google Cloud Speech-to-Text
export const transcribeAudio = async (gcsUri: string) => {
  try {
    const request: protos.google.cloud.speech.v1.ILongRunningRecognizeRequest = {
      audio: {
        uri: gcsUri,
      },
      config: {
        encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
    };

    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();
    
    const transcription = response.results
      ? response.results
          .map((result: protos.google.cloud.speech.v1.ISpeechRecognitionResult) => 
            result.alternatives?.[0]?.transcript || '')
          .join('\n')
      : '';
    
    return transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};

export { storage, speechClient, bucketName }; 