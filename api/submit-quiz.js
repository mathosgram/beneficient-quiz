// api/submit-quiz.js
// This is a Vercel Serverless Function. It's a simple, powerful backend.
// Vercel automatically detects this file in the `/api` directory and makes it a live API endpoint.

import { Redis } from '@upstash/redis';

// This special syntax allows Vercel to handle CORS for you.
// It means your frontend (on the same domain) can talk to this API.
export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(request, response) {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Securely get the Redis URL from Vercel's Environment Variables
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        const { action, data } = request.body;
        
        if (action === 'register-user') {
            const { name, email, phone } = data;
            const userKey = `user:${email}`;

            // Check if user exists. If not, initialize with quiz_attempts.
            const userExists = await redis.exists(userKey);
            if (!userExists) {
                 await redis.hset(userKey, { name, email, phone, quiz_attempts: 0 });
            } else {
                 await redis.hset(userKey, { name, email, phone }); // Update details if they exist
            }

            return response.status(201).json({ message: 'User registered successfully.' });

        } else if (action === 'save-results') {
            const { user, score, total, answers } = data;
            const email = user.email;
            const userKey = `user:${email}`;
            const resultKey = `quiz_result:${email}:${Date.now()}`;

            const resultData = {
                ...user,
                score,
                total,
                answers: JSON.stringify(answers), // This already stores all answered questions
                completedAt: new Date().toISOString()
            };

            await redis.hmset(resultKey, resultData);
            
            // Atomically increment the user's quiz attempt counter
            await redis.hincrby(userKey, 'quiz_attempts', 1);

            return response.status(200).json({ message: 'Quiz results saved successfully.' });
        } else {
            return response.status(400).json({ message: 'Invalid action specified.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        return response.status(500).json({ message: 'An error occurred on the server.' });
    }
}

