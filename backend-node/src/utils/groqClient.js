import Groq from 'groq-sdk';
import { log } from './logger.js';

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'demo-key',
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Summarize a transcript chunk using Groq LLM
 * @param {string} chunkText
 * @param {string} videoTitle
 * @param {object} [timeRange] - { startTime, endTime } e.g. { startTime: '00:02:15', endTime: '00:05:30' }
 */
export async function summarizeChunk(chunkText, videoTitle = '', timeRange = null) {
    const timeLabel = timeRange ? ` [${timeRange.startTime}–${timeRange.endTime}]` : '';

    if (!process.env.GROQ_API_KEY) {
        log('🤖', 'GROQ', `summarizeChunk [MOCK] — "${videoTitle}"${timeLabel} (${chunkText.length} chars)`);
        return `Summary of chunk from "${videoTitle}"${timeLabel}: ${chunkText.substring(0, 200)}...`;
    }

    log('🤖', 'GROQ', `summarizeChunk [${MODEL}] — "${videoTitle}"${timeLabel} (${chunkText.length} chars)`);
    const start = Date.now();

    const timeContext = timeRange
        ? `\nThis chunk covers video timestamps ${timeRange.startTime} to ${timeRange.endTime}. Reference these timestamps in your summary.`
        : '';

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are an expert educational content summarizer. Create a rich, detailed summary that:
- Preserves technical precision (formulas, steps, definitions)
- Notes prerequisites explicitly
- References video timestamps when provided
- Uses clear, educational tone
- Target length: 20-35% of the original
- Always highlight key concepts in bold`
            },
            {
                role: 'user',
                content: `Summarize this transcript chunk from the video "${videoTitle}":${timeContext}\n\n${chunkText}`
            }
        ],
        temperature: 0.3,
        max_tokens: 800,
    });

    const elapsed = Date.now() - start;
    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;
    log('✅', 'GROQ', `summarizeChunk done [${elapsed}ms] — tokens: ${usage?.total_tokens || '?'} output: ${content.length} chars`);

    return content;
}

/**
 * Extract concepts and prerequisite relationships from a summary
 * @param {string} summaryText
 * @param {object} [anchor] - { videoId, startTime, endTime } to attach to each concept
 * @param {string[]} [existingConcepts] - concept IDs already extracted (for deduplication)
 */
export async function extractConcepts(summaryText, anchor = null, existingConcepts = []) {
    if (!process.env.GROQ_API_KEY) {
        log('🤖', 'GROQ', `extractConcepts [MOCK] — (${summaryText.length} chars)`);
        const words = summaryText.split(/\s+/);
        const concepts = [];
        for (let i = 0; i < words.length - 1; i += 15) {
            concepts.push({
                concept: words.slice(i, i + 2).join(' '),
                parentConcept: null,
                prerequisites: [],
                definition: '',
                ...(anchor || {}),
            });
        }
        return concepts.slice(0, 2);
    }

    log('🤖', 'GROQ', `extractConcepts [${MODEL}] — (${summaryText.length} chars, ${existingConcepts.length} existing)`);
    const start = Date.now();

    const existingNote = existingConcepts.length > 0
        ? `\n\nAlready extracted concepts (DO NOT repeat these): ${existingConcepts.join(', ')}`
        : '';

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are a knowledge graph extractor for educational content. Extract ONLY the most important, high-level concepts.

Output strict JSON array with this schema:
[
  {
    "concept": "concept-id (lowercase, hyphenated)",
    "label": "Human Readable Label",
    "parentConcept": "parent-concept-id or null",
    "prerequisites": ["prerequisite-concept-1"],
    "definition": "One-line definition"
  }
]

Critical Rules:
- Extract ONLY 2-4 core concepts per chunk — quality over quantity
- Focus on BROAD, meaningful concepts, NOT fine-grained terms
  ✗ Bad: "sigmoid-function", "tanh-function", "relu-function" (too granular)
  ✓ Good: "activation-functions" (the parent concept)
- Use parentConcept to group: if a specific concept is a subtype of a broader concept, set parentConcept to the broader one (e.g. "sigmoid-function" → parentConcept: "activation-functions")
- Prerequisites = concepts that MUST be understood BEFORE this one
- Use consistent naming (lowercase, hyphenated: "gradient-descent", "chain-rule")
- Skip generic terms like "example", "introduction", "overview", "summary"
- Skip concepts already in the existing list`
            },
            {
                role: 'user',
                content: `Extract the core concepts from:\n\n${summaryText}${existingNote}`
            }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
    });

    const elapsed = Date.now() - start;

    try {
        const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
        let concepts = Array.isArray(parsed) ? parsed : (parsed.concepts || []);
        // Ensure parentConcept field exists
        concepts = concepts.map(c => ({
            ...c,
            parentConcept: c.parentConcept || null,
            ...(anchor || {}),
        }));
        // Filter out any that duplicate existing concepts
        if (existingConcepts.length > 0) {
            concepts = concepts.filter(c => !existingConcepts.includes(c.concept));
        }
        log('✅', 'GROQ', `extractConcepts done [${elapsed}ms] — ${concepts.length} concepts extracted`);
        return concepts;
    } catch {
        log('⚠️', 'GROQ', `extractConcepts parse failed [${elapsed}ms]`);
        return [];
    }
}

/**
 * Generate a Socratic question about a concept
 */
export async function generateSocraticQuestion(concept, context) {
    if (!process.env.GROQ_API_KEY) {
        log('🤖', 'GROQ', `generateSocraticQuestion [MOCK] — concept="${concept}"`);
        return {
            type: 'mcq',
            question: `What is the key principle behind ${concept}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: 0,
            hint: `Think about the fundamental definition of ${concept}.`,
        };
    }

    log('🤖', 'GROQ', `generateSocraticQuestion [${MODEL}] — concept="${concept}"`);
    const start = Date.now();

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are a Socratic tutor. Generate a diagnostic question to test understanding.

Output JSON:
{
  "type": "mcq",
  "question": "Clear, specific question",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "hint": "A guiding hint without giving the answer",
  "explanation": "Why the correct answer is correct"
}`
            },
            {
                role: 'user',
                content: `Generate a question about "${concept}" in this context:\n${context}`
            }
        ],
        temperature: 0.5,
        max_tokens: 400,
        response_format: { type: 'json_object' },
    });

    const elapsed = Date.now() - start;

    try {
        const result = JSON.parse(response.choices[0]?.message?.content || '{}');
        log('✅', 'GROQ', `generateSocraticQuestion done [${elapsed}ms] — type=${result.type}`);
        return result;
    } catch {
        log('⚠️', 'GROQ', `generateSocraticQuestion parse failed [${elapsed}ms]`);
        return { type: 'text', question: `Explain ${concept} in your own words.` };
    }
}
