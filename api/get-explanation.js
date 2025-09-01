// api/get-explanation.js
// This new Serverless Function handles requests for AI-powered explanations.

export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    // Retrieve the Gemini API Key securely from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return response.status(500).json({ message: 'Server configuration error: API key not found.' });
    }

    try {
        const { question, userAnswer, correctAnswer } = request.body;

        // Construct the prompt for the Gemini API
        const systemPrompt = "You are a helpful and concise English and General Knowledge tutor. A student answered a quiz question incorrectly. Explain why their answer was wrong and why the correct answer is right in a friendly and easy-to-understand way. Keep the explanation to 2-3 sentences.";
        const userQuery = `Question: "${question}"\nMy Incorrect Answer: "${userAnswer}"\nCorrect Answer: "${correctAnswer}"\n\nExplain my mistake.`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };

        // Call the Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`Gemini API responded with status: ${geminiResponse.status}`);
        }

        const result = await geminiResponse.json();
        
        // Extract the generated text from the response
        const explanation = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate an explanation for this question.";

        // Send the explanation back to the frontend
        return response.status(200).json({ explanation });

    } catch (error) {
        console.error('API Error in get-explanation:', error);
        return response.status(500).json({ message: 'An error occurred while getting the explanation.' });
    }
}
