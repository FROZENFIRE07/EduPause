import Groq from 'groq-sdk';

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'demo-key',
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Summarize a transcript chunk using Groq LLM
 */
export async function summarizeChunk(chunkText, videoTitle = '') {
    if (!process.env.GROQ_API_KEY) {
        // Demo fallback
        return `Summary of chunk from "${videoTitle}": ${chunkText.substring(0, 200)}...`;
    }

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are an expert educational content summarizer. Create a rich, detailed summary that:
- Preserves technical precision (formulas, steps, definitions)
- Notes prerequisites explicitly
- Includes approximate timestamps when available
- Uses clear, educational tone
- Target length: 20-35% of the original
- Always highlight key concepts in bold`
            },
            {
                role: 'user',
                content: `Summarize this transcript chunk from the video "${videoTitle}":\n\n${chunkText}`
            }
        ],
        temperature: 0.3,
        max_tokens: 800,
    });

    return response.choices[0]?.message?.content || '';
}

/**
 * Extract concepts and prerequisite relationships from a summary
 * Returns: [{ concept, prerequisites: [string], definitions: string }]
 */
export async function extractConcepts(summaryText) {
    if (!process.env.GROQ_API_KEY) {
        // Demo: extract simple concept-like phrases
        const words = summaryText.split(/\s+/);
        const concepts = [];
        for (let i = 0; i < words.length - 1; i += 15) {
            concepts.push({
                concept: words.slice(i, i + 2).join(' '),
                prerequisites: [],
                definition: '',
            });
        }
        return concepts.slice(0, 3);
    }

    const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are a knowledge graph extractor for educational content. Extract concepts and their prerequisite relationships.

Output strict JSON array with this schema:
[
  {
    "concept": "concept name (lowercase, hyphenated)",
    "label": "Human Readable Label",
    "prerequisites": ["prerequisite-concept-1", "prerequisite-concept-2"],
    "definition": "One-line definition"
  }
]

Rules:
- Extract only domain-specific academic concepts, not generic terms
- Prerequisites must be concepts that logically must be understood BEFORE this concept
- Use consistent naming (lowercase, hyphenated: "gradient-descent", "chain-rule")
- Limit to 3-6 concepts per chunk
- Evaluate prerequisite direction carefully - A → B means A must be known before B`
            },
            {
                role: 'user',
                content: `Extract concepts and prerequisites from:\n\n${summaryText}`
            }
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
    });

    try {
        const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
        return Array.isArray(parsed) ? parsed : (parsed.concepts || []);
    } catch {
        return [];
    }
}

/**
 * Generate a Socratic question about a concept
 */
export async function generateSocraticQuestion(concept, context) {
    if (!process.env.GROQ_API_KEY) {
        return {
            type: 'mcq',
            question: `What is the key principle behind ${concept}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: 0,
            hint: `Think about the fundamental definition of ${concept}.`,
        };
    }

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

    try {
        return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch {
        return { type: 'text', question: `Explain ${concept} in your own words.` };
    }
}
