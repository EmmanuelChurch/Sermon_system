import axios from 'axios';

/**
 * Handle Dropbox links to ensure they're accessible by the API
 * 
 * @param url Dropbox URL (e.g., https://www.dropbox.com/scl/fi/...)
 * @returns A directly accessible URL
 */
function convertDropboxUrl(url: string): string {
  // Check if this is a Dropbox URL
  if (url.includes('dropbox.com')) {
    try {
      console.log('Original Dropbox URL:', url);
      
      // If it already has dl=1, use it as is - this is already a direct download link
      if (url.includes('dl=1')) {
        console.log('URL already has dl=1 parameter, using as is');
        return url;
      }
      
      // Parse the URL to get its components
      const urlObj = new URL(url);
      
      // Add dl=1 parameter to the URL to make it a direct download link
      urlObj.searchParams.set('dl', '1');
      const directUrl = urlObj.toString();
      
      console.log('Converted to direct download URL:', directUrl);
      return directUrl;
    } catch (error) {
      console.error('Error converting Dropbox URL:', error);
    }
  }
  
  // Return the original URL if not a Dropbox URL or if conversion failed
  return url;
}

/**
 * Transcribe audio using WhisperX model via Replicate API
 * This requires a Replicate API key which offers a free tier
 * 
 * @param audioUrl URL to the audio file or base64 encoded audio data
 * @returns The transcribed text
 */
export async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  try {
    console.log('Transcribing with WhisperX:', audioUrl);
    console.log('API KEY EXISTS:', !!process.env.REPLICATE_API_KEY);
    console.log('API KEY LENGTH:', process.env.REPLICATE_API_KEY?.length || 0);
    
    // For testing without API key, return mock transcription
    if (!process.env.REPLICATE_API_KEY) {
      console.log('No Replicate API key found, returning mock transcription');
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return `This is a mock transcription of the sermon using Whisper. 
      
      In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.
      
      And God said, "Let there be light," and there was light. And God saw that the light was good. And God separated the light from the darkness. God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.
      
      Thank you for listening to this sermon. May God bless you.`;
    }
    
    // Use the URL as provided - the proxy handling should happen at a higher level
    let finalAudioUrl = audioUrl;
    
    // For debugging - check if the audio file exists and get content type
    try {
      console.log('Checking if audio file is accessible at:', finalAudioUrl);
      const checkResponse = await axios.head(finalAudioUrl, {
        headers: {
          // Add headers that help with Dropbox and other services
          'Accept': 'audio/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        // Increase timeout for large files
        timeout: 30000
      });
      console.log('Audio file check status:', checkResponse.status);
      console.log('Audio file content type:', checkResponse.headers['content-type']);
      console.log('Audio file size:', checkResponse.headers['content-length']);
    } catch (error: any) {
      console.error('Audio file not accessible:', error.message);
      throw new Error(`Audio file not accessible at ${finalAudioUrl}: ${error.message}`);
    }
    
    console.log('Starting Replicate API call with URL:', finalAudioUrl);
    
    // Using WhisperX model as recommended by Replicate support
    // Changed to a specific version hash of a known working model
    const whisperModelId = "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c";
    
    // Start the transcription job
    try {
      console.log('Sending request to Replicate with model:', whisperModelId);
      const response = await axios.post(
        'https://api.replicate.com/v1/predictions',
        {
          version: whisperModelId,
          input: {
            audio: finalAudioUrl,
            language: "en",
            timestamp_method: "spot",
            model_name: "large-v3",
            temperature: 0,
            patience: 1,
            suppress_tokens: "-1",
            condition_on_previous_text: false,
            vad_filter: true,
            word_timestamps: true
          }
        },
        {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Replicate API response:', response.status, response.data);
      
      // Check the status and get the transcription
      const predictionId = response.data.id;
      let transcription = '';
      let status = 'starting';
      
      // Poll for results
      let pollCount = 0;
      const maxPolls = 90; // 90 seconds max wait time
      
      while (status !== 'succeeded' && status !== 'failed' && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        pollCount++;
        
        console.log(`Polling for results (attempt ${pollCount}/${maxPolls})...`);
        
        const statusRes = await axios.get(
          `https://api.replicate.com/v1/predictions/${predictionId}`,
          {
            headers: {
              'Authorization': `Token ${process.env.REPLICATE_API_KEY}`
            }
          }
        );
        
        status = statusRes.data.status;
        console.log('Transcription status:', status);
        
        if (statusRes.data.output) {
          console.log('Output available:', typeof statusRes.data.output);
        }
        
        if (status === 'succeeded') {
          if (typeof statusRes.data.output === 'string') {
            transcription = statusRes.data.output;
          } else if (typeof statusRes.data.output === 'object') {
            // Handle different output formats from the model
            if (statusRes.data.output.text) {
              // WhisperX format
              transcription = statusRes.data.output.text;
            } else if (statusRes.data.output.transcription) {
              // Incredibly-fast-whisper format
              transcription = statusRes.data.output.transcription;
            } else if (statusRes.data.output.segments) {
              // Some models return segments
              transcription = statusRes.data.output.segments
                .map((segment: any) => segment.text)
                .join(' ');
            } else {
              // Use any string field we can find
              const possibleTextFields = Object.entries(statusRes.data.output)
                .filter(([_, value]) => typeof value === 'string')
                .map(([key, value]) => ({ key, value: value as string }));
              
              if (possibleTextFields.length > 0) {
                // Use the longest string field
                const longest = possibleTextFields.reduce((prev, current) => 
                  (current.value.length > prev.value.length) ? current : prev
                );
                transcription = longest.value;
                console.log(`Using '${longest.key}' field for transcription`);
              } else {
                // Last resort: stringify the whole output
                console.log('Unexpected output format:', statusRes.data.output);
                transcription = JSON.stringify(statusRes.data.output);
              }
            }
          } else if (Array.isArray(statusRes.data.output) && statusRes.data.output.length > 0) {
            transcription = statusRes.data.output.join(' ');
          } else {
            console.log('Unexpected output format:', statusRes.data.output);
            transcription = JSON.stringify(statusRes.data.output);
          }
          console.log('Transcription text (preview):', transcription.substring(0, 100) + '...');
        } else if (status === 'failed') {
          console.error('Replicate API error:', statusRes.data.error);
          throw new Error(`Whisper transcription failed: ${statusRes.data.error || 'Unknown error'}`);
        }
      }
      
      if (pollCount >= maxPolls && status !== 'succeeded') {
        throw new Error('Transcription timed out after 90 seconds');
      }
      
      return transcription || 'No transcription was generated.';
    } catch (error: any) {
      console.error('Replicate API error:', error.message);
      if (error.response?.data) {
        console.error('API response data:', JSON.stringify(error.response.data));
        throw new Error(`Replicate API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error transcribing with Whisper:', error);
    throw error;
  }
} 