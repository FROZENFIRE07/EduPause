/**
 * Quiz Service — Checkpoint-based quiz generation and management
 * Triggers only after video completion (non-intrusive)
 */

import { getDB } from './mongoClient.js';
import { getConceptGraph } from './neo4jClient.js';
import { log } from './logger.js';
import axios from 'axios';
import { ObjectId } from 'mongodb';

const AGENT_CORE_URL = process.env.AGENT_CORE_URL || 'http://localhost:8000';

/**
 * Determine if quiz should be triggered after video completion
 * @param {string} userId 
 * @param {string} playlistId 
 * @param {string} videoId 
 * @returns {Promise<{shouldTrigger: boolean, reason: string}>}
 */
export async function shouldTriggerQuiz(userId, playlistId, videoId) {
    try {
        const db = await getDB();
        
        // Get user progress to check quiz history
        const progress = await db.collection('user_progress').findOne({ userId, playlistId });
        
        if (!progress) {
            log('📝', 'QUIZ', `No progress found for user — skipping quiz trigger`);
            return { shouldTrigger: false, reason: 'No progress data' };
        }

        // Check if user has already taken quiz for this video recently
        const recentQuizzes = await db.collection('quiz_results').find({
            userId,
            playlistId,
            videoId,
            takenAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).toArray();

        if (recentQuizzes.length > 0) {
            log('📝', 'QUIZ', `User already took quiz for video ${videoId} recently — skipping`);
            return { shouldTrigger: false, reason: 'Quiz already taken recently' };
        }

        // Get concepts from this video
        const graph = await getConceptGraph(playlistId, videoId);
        const concepts = graph.concepts;

        if (concepts.length === 0) {
            log('📝', 'QUIZ', `No concepts found for video ${videoId} — skipping quiz`);
            return { shouldTrigger: false, reason: 'No concepts in video' };
        }

        // Trigger quiz if video has concepts
        log('✅', 'QUIZ', `Quiz trigger conditions met for video ${videoId}`);
        return { 
            shouldTrigger: true, 
            reason: `Video contains ${concepts.length} concept(s)`,
            conceptCount: concepts.length
        };

    } catch (err) {
        log('❌', 'QUIZ', `Error checking quiz trigger: ${err.message}`);
        return { shouldTrigger: false, reason: 'Error checking conditions' };
    }
}

/**
 * Generate quiz for a completed video using quiz_generator agent
 * @param {string} userId 
 * @param {string} playlistId 
 * @param {string} videoId 
 * @returns {Promise<Object>} Quiz data with questions
 */
export async function generateQuiz(userId, playlistId, videoId, difficulty = 'medium') {
    try {
        const db = await getDB();

        // Get video details from playlist payload (source of truth in this codebase)
        const playlist = await db.collection('playlists').findOne({ playlistId });
        const video = playlist?.videos?.find(v => v.videoId === videoId) || null;

        // Get transcript
        const transcript = await db.collection('transcripts').findOne({ videoId });
        const transcriptText = transcript?.plainText || transcript?.fullText || transcript?.text || '';

        if (!transcriptText) {
            log('⚠️', 'QUIZ', `No transcript for video ${videoId} — using fallback quiz`);
        }

        // Get concepts from knowledge graph
        const graph = await getConceptGraph(playlistId, videoId);
        const concepts = graph.concepts.map(c => c.id);

        // Call quiz_generator agent
        log('📤', 'QUIZ', `Calling quiz_generator agent for video ${videoId}`);
        
        // Use the correct /invoke endpoint with InvokeRequest schema
        const agentPayload = {
            sessionId: `${userId}_${playlistId}`,
            action: 'quiz_generator',
            currentConcept: concepts[0] || 'general',
            videoId: videoId,
            transcriptContext: transcriptText.substring(0, 4000),
            difficulty: difficulty,
        };

        const agentResponse = await axios.post(`${AGENT_CORE_URL}/invoke`, agentPayload, {
            timeout: 30000 // 30 second timeout
        });

        const quiz = agentResponse.data?.result?.quiz;

        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            log('⚠️', 'QUIZ', `Agent returned empty quiz — using fallback`);
            const fallbackQuiz = createFallbackQuiz(video?.title || 'Video Content', concepts[0]);
            const fallbackResult = await db.collection('quiz_sessions').insertOne({
                userId,
                playlistId,
                videoId,
                quiz: fallbackQuiz,
                generatedAt: new Date(),
                status: 'pending',
            });
            return { quizSessionId: fallbackResult.insertedId.toString(), quiz: fallbackQuiz };
        }

        // Store generated quiz in database
        const quizDoc = {
            userId,
            playlistId,
            videoId,
            quiz,
            generatedAt: new Date(),
            status: 'pending', // pending, completed, skipped
        };

        const result = await db.collection('quiz_sessions').insertOne(quizDoc);
        
        log('✅', 'QUIZ', `Quiz generated with ${quiz.questions.length} questions — session ${result.insertedId}`);

        return {
            quizSessionId: result.insertedId.toString(),
            quiz,
        };

    } catch (err) {
        log('❌', 'QUIZ', `Quiz generation failed: ${err.message}`);

        // Return fallback quiz on error
        return {
            quiz: createFallbackQuiz('Video Content', 'concepts'),
            error: err.message
        };
    }
}

/**
 * Create a simple fallback quiz when agent fails
 */
function createFallbackQuiz(videoTitle, concept) {
    return {
        concept,
        video_title: videoTitle,
        questions: [
            {
                difficulty: 'easy',
                question: `What was the main topic discussed in "${videoTitle}"?`,
                options: [
                    'A) The video covered key concepts and explanations',
                    'B) The video was purely theoretical',
                    'C) The video focused on history',
                    'D) The video discussed alternatives'
                ],
                correct_index: 0,
                explanation: 'The video primarily focused on explaining the core concepts.'
            }
        ],
        fallback: true,
        generated_at: new Date().toISOString()
    };
}

/**
 * Submit quiz answers and evaluate using evaluator agent
 * @param {string} quizSessionId 
 * @param {Array} responses - User's answers [{questionIndex, answerIndex}]
 * @returns {Promise<Object>} Evaluation results
 */
export async function submitQuizAnswers(quizSessionId, responses) {
    try {
        const db = await getDB();
        
        // Get quiz session
        const session = await db.collection('quiz_sessions').findOne({ 
            _id: new ObjectId(quizSessionId) 
        });

        if (!session) {
            throw new Error('Quiz session not found');
        }

        const { userId, playlistId, videoId, quiz } = session;
        const questions = quiz.questions;

        // Evaluate each answer
        const evaluations = [];
        let correctCount = 0;
        let totalScore = 0;

        for (const response of responses) {
            const { questionIndex, answerIndex } = response;
            const question = questions[questionIndex];
            
            if (!question) continue;

            const isCorrect = answerIndex === question.correct_index;
            const difficultyMultiplier = {
                'easy': 0.8,
                'medium': 1.0,
                'hard': 1.2
            }[question.difficulty] || 1.0;

            const score = isCorrect ? (100 * difficultyMultiplier) : 0;
            
            if (isCorrect) correctCount++;
            totalScore += score;

            evaluations.push({
                questionIndex,
                question: question.question,
                difficulty: question.difficulty,
                userAnswer: answerIndex,
                correctAnswer: question.correct_index,
                isCorrect,
                score,
                explanation: question.explanation
            });
        }

        const averageScore = responses.length > 0 ? totalScore / responses.length : 0;
        const percentageCorrect = responses.length > 0 ? (correctCount / responses.length) * 100 : 0;

        // Store quiz results
        const resultDoc = {
            userId,
            playlistId,
            videoId,
            quizSessionId,
            responses,
            evaluations,
            correctCount,
            totalQuestions: responses.length,
            percentageCorrect,
            averageScore,
            takenAt: new Date(),
        };

        await db.collection('quiz_results').insertOne(resultDoc);

        // Update quiz session status
        await db.collection('quiz_sessions').updateOne(
            { _id: new ObjectId(quizSessionId) },
            { 
                $set: { 
                    status: 'completed',
                    completedAt: new Date(),
                    result: resultDoc
                } 
            }
        );

        // Update concept mastery in user_progress (using evaluator agent pattern)
        const concepts = quiz.concept ? [quiz.concept] : [];
        if (concepts.length > 0) {
            await updateConceptMasteryFromQuiz(userId, playlistId, concepts[0], evaluations, averageScore);
        }

        log('✅', 'QUIZ', `Quiz completed: ${correctCount}/${responses.length} correct (${percentageCorrect.toFixed(1)}%)`);

        return {
            success: true,
            evaluations,
            correctCount,
            totalQuestions: responses.length,
            percentageCorrect,
            averageScore,
            passed: percentageCorrect >= 60 // 60% pass threshold
        };

    } catch (err) {
        log('❌', 'QUIZ', `Quiz submission failed: ${err.message}`);
        throw err;
    }
}

/**
 * Update concept mastery based on quiz performance
 * Integrates with existing progressService mastery tracking
 */
async function updateConceptMasteryFromQuiz(userId, playlistId, conceptId, evaluations, averageScore) {
    try {
        const db = await getDB();
        
        // Get current progress
        const progress = await db.collection('user_progress').findOne({ userId, playlistId });
        if (!progress) return;

        const conceptData = progress.conceptsCovered?.[conceptId] || {
            exposureCount: 0,
            quizAttempts: 0,
            quizScores: [],
            confidenceScore: 0,
            skillConfidence: 'low'
        };

        // Update quiz data
        conceptData.quizAttempts = (conceptData.quizAttempts || 0) + 1;
        conceptData.quizScores = Array.isArray(conceptData.quizScores) ? conceptData.quizScores : [];
        conceptData.quizScores.push({
            score: averageScore / 100,
            difficulty: 'mixed',
            takenAt: new Date(),
        });
        conceptData.lastQuizAt = new Date();

        // Calculate confidence using existing formula
        const exposureScore = Math.min((conceptData.exposureCount || 0) / 5, 1.0);
        const quizScore = averageScore / 100;
        const confidence = (exposureScore * 0.4) + (quizScore * 0.6);

        conceptData.confidenceScore = confidence;
        conceptData.skillConfidence = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';

        // Update in database
        await db.collection('user_progress').updateOne(
            { userId, playlistId },
            { 
                $set: { 
                    [`conceptsCovered.${conceptId}`]: conceptData,
                    lastActivity: new Date()
                } 
            }
        );

        log('📈', 'QUIZ', `Updated mastery for ${conceptId}: confidence=${(confidence * 100).toFixed(1)}%`);

    } catch (err) {
        log('❌', 'QUIZ', `Failed to update concept mastery: ${err.message}`);
    }
}

/**
 * Skip quiz (user chose not to take it)
 * @param {string} quizSessionId 
 */
export async function skipQuiz(quizSessionId) {
    try {
        const db = await getDB();
        
        await db.collection('quiz_sessions').updateOne(
            { _id: new ObjectId(quizSessionId) },
            { 
                $set: { 
                    status: 'skipped',
                    skippedAt: new Date()
                } 
            }
        );

        log('⏭️', 'QUIZ', `Quiz ${quizSessionId} skipped by user`);
        
        return { success: true };
    } catch (err) {
        log('❌', 'QUIZ', `Failed to skip quiz: ${err.message}`);
        throw err;
    }
}
