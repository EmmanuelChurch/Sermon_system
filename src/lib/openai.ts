import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate social media snippets from a sermon transcription
 * @param transcription The sermon transcription text
 * @returns A structured object with social media content ideas for different platforms
 */
export const generateSnippets = async (transcription: string) => {
  try {
    const prompt = `
      Analyze the following sermon transcript and generate social media post ideas for Instagram, X (Twitter), Facebook, and TikTok. For each platform, provide 10 distinct ideas that align with the platform's style and audience. Organize ideas into these categories:

      Key Quotes/Statements (short, impactful lines)
      Actionable Takeaways (practical advice or challenges)
      Story/Illustration Highlights (engaging stories or metaphors)
      Questions/Reflections (thought-provoking prompts)

      Platform-Specific Guidelines:
      Instagram: Include visuals (e.g., text-over-image, infographics) and hashtag suggestions.
      X (Twitter): Focus on concise text (under 280 characters) and relevant hashtags.
      Facebook: Longer captions (1-2 paragraphs) with discussion prompts.
      TikTok: Script ideas for short videos (e.g., voiceover clips, text-on-screen, trending sounds).

      Additional Instructions:
      Pull direct quotes or paraphrased insights from the sermon.
      Prioritize emotionally resonant or surprising content.
      Avoid jargon; keep language conversational.
      Include a mix of formats (e.g., carousels, reels, polls).
      For each idea, estimate the timestamp in the sermon where the content appears.

      Format your response as a JSON object with platforms as top-level keys, and each platform having arrays of content ideas organized by category. Each idea should include content, format suggestions, and timestamp.

      Sermon Transcript:
      ${transcription}
    `;

    // Option 1: Use a model that supports JSON response format
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k", // Using 3.5 Turbo with larger context instead of GPT-4
      messages: [
        {
          role: "system",
          content: "You are a professional social media content strategist for a church, skilled at converting sermon content into engaging social media posts tailored for specific platforms. You must respond with valid JSON that can be parsed.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      // Removed response_format parameter as it's not supported by all models
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error("No response from OpenAI");
    }

    console.log("Raw OpenAI response:", result.substring(0, 300) + "...");
    
    // We need to handle the result carefully since it might not be in JSON format
    try {
      // Try to parse it directly first
      const parsedResult = JSON.parse(result);
      console.log("Generated snippets:", JSON.stringify(parsedResult, null, 2).substring(0, 200) + "...");
      return parsedResult;
    } catch (parseError) {
      console.error("Failed to parse JSON directly:", parseError);
      
      // If it fails, try to extract JSON from the text
      const jsonMatch = result.match(/```json\n([\s\S]*)\n```/) || 
                         result.match(/{[\s\S]*}/);
                         
      if (jsonMatch) {
        try {
          const jsonContent = jsonMatch[1] || jsonMatch[0];
          const parsedResult = JSON.parse(jsonContent);
          console.log("Extracted JSON snippets:", JSON.stringify(parsedResult, null, 2).substring(0, 200) + "...");
          return parsedResult;
        } catch (extractError) {
          console.error("Failed to extract JSON:", extractError);
          throw new Error("Failed to parse OpenAI response as JSON");
        }
      } else {
        console.error("No JSON structure found in response");
        throw new Error("No valid JSON found in OpenAI response");
      }
    }
  } catch (error) {
    console.error("Error generating snippets:", error);
    throw error;
  }
};
