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
            
            // Check for uniqueness using Redis Sets for efficiency
            const isEmailTaken = await redis.sismember('registered_emails', email);
            if (isEmailTaken) {
                return response.status(409).json({ message: 'This email is already registered.' });
            }

            const isPhoneTaken = await redis.sismember('registered_phones', phone);
            if (isPhoneTaken) {
                return response.status(409).json({ message: 'This phone number is already registered.' });
            }

            // User passed uniqueness checks, check their attempts (they might be returning)
            const userKey = `user:${email}`;
            const userData = await redis.hgetall(userKey);

            if (userData) {
                // This case handles a user who registered but never finished a quiz. Let's check attempts anyway.
                const attempts = Number(userData.quiz_attempts) || 0;
                if (attempts >= 3) {
                    return response.status(403).json({ message: 'You have reached the maximum of 3 attempts.' });
                }
                return response.status(200).json({ message: 'Welcome back! Starting quiz.' });
            } else {
                // User is completely new. Create their record and add to uniqueness sets.
                const multi = redis.multi();
                multi.sadd('registered_emails', email);
                multi.sadd('registered_phones', phone);
                multi.hset(userKey, { name, email, phone, quiz_attempts: 0 });
                await multi.exec();
                
                return response.status(201).json({ message: 'User registered successfully.' });
            }

        } else if (action === 'save-results') {
            const { user, score, total, answers } = data;
            const email = user.email;
            const userKey = `user:${email}`;
            const resultKey = `quiz_result:${email}:${Date.now()}`;

            const resultData = {
                ...user,
                score,
                total,
                answers: JSON.stringify(answers),
                completedAt: new Date().toISOString()
            };

            await redis.hmset(resultKey, resultData);
            
            const newAttempts = await redis.hincrby(userKey, 'quiz_attempts', 1);

            return response.status(200).json({ 
                message: 'Quiz results saved successfully.',
                newAttempts: newAttempts 
            });
        } else {
            return response.status(400).json({ message: 'Invalid action specified.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        return response.status(500).json({ message: 'An error occurred on the server.' });
    }
}

