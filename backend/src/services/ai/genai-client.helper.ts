import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

export const DEFAULT_GEMINI_FLASH_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_FLASH_LITE_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GEMINI_TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

const LEGACY_DEPRECATED_MODEL_PREFIXES = [
  'gemini-1.5',
  'gemini-2.0',
  'gemini-2.5',
  'gemini-3-flash',
  'gemini-3.5-flash',
  'gemini-3.6',
  'gemini-3.7',
];

/**
 * Normaliza el nombre del modelo configurado en entorno, reemplazando automáticamente
 * cualquier identificador legado/deprecado (1.5, 2.0, 2.5, 3.6) por `gemini-3.8-flash`.
 */
export function resolveCurrentGeminiModel(configuredModel?: string | null): string {
  const trimmed = (configuredModel || '').trim();
  if (!trimmed) {
    return DEFAULT_GEMINI_FLASH_MODEL;
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'gemini-3.5-flash-lite') {
    return FALLBACK_GEMINI_FLASH_LITE_MODEL;
  }

  const isLegacy = LEGACY_DEPRECATED_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
  if (isLegacy) {
    return DEFAULT_GEMINI_FLASH_MODEL;
  }

  return trimmed;
}

/**
 * Construye la cascada de modelos vigentes para llamadas multimodales o de texto.
 */
export function buildGeminiModelCascade(
  preferredModels?: string[],
  envModel = process.env.GEMINI_MODEL,
): string[] {
  const normalizedPrimary = resolveCurrentGeminiModel(envModel);
  const candidates = [
    ...(preferredModels || []),
    normalizedPrimary,
    DEFAULT_GEMINI_FLASH_MODEL,
    FALLBACK_GEMINI_FLASH_LITE_MODEL,
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}

export type InlineMultimodalBlock =
  | { type: 'image'; data: string; mime_type: string }
  | { type: 'audio'; data: string; mime_type: string }
  | { type: 'video'; data: string; mime_type: string }
  | { type: 'document'; data: string; mime_type: string };

export type InteractionContentItem =
  | { type: 'text'; text: string }
  | InlineMultimodalBlock;

/**
 * Convierte un archivo Base64 + MIME en el bloque tipado exacto de Interactions API (`@google/genai`).
 */
export function buildInlineMediaContent(
  mimeType: string,
  base64Data: string,
): InlineMultimodalBlock {
  const normalizedMime = (mimeType || 'application/octet-stream').trim().toLowerCase();
  if (normalizedMime.startsWith('image/')) {
    return { type: 'image', data: base64Data, mime_type: normalizedMime };
  }
  if (normalizedMime.startsWith('audio/')) {
    return { type: 'audio', data: base64Data, mime_type: normalizedMime };
  }
  if (normalizedMime.startsWith('video/')) {
    return { type: 'video', data: base64Data, mime_type: normalizedMime };
  }
  return { type: 'document', data: base64Data, mime_type: normalizedMime };
}

export function isGeminiApiKeyConfigured(key = process.env.GEMINI_API_KEY): boolean {
  const trimmed = (key || '').trim();
  return Boolean(trimmed && trimmed !== 'tu-api-key-aqui');
}

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

export function getGenAIClient(overrideClient?: GoogleGenAI): GoogleGenAI {
  if (overrideClient) return overrideClient;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export function extractInteractionOutputText(interaction: any): string {
  if (typeof interaction?.output_text === 'string' && interaction.output_text.trim().length > 0) {
    return interaction.output_text.trim();
  }

  if (Array.isArray(interaction?.steps)) {
    const texts: string[] = [];
    for (const step of interaction.steps) {
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item?.type === 'text' && typeof item.text === 'string') {
            texts.push(item.text);
          }
        }
      }
    }
    if (texts.length > 0) {
      return texts.join('').trim();
    }
  }

  return '';
}

export interface RunGeminiInteractionOptions {
  input: string | InteractionContentItem[];
  systemInstruction?: string;
  jsonSchema?: Record<string, any>;
  preferredModels?: string[];
  client?: GoogleGenAI;
}

/**
 * Ejecuta `client.interactions.create` sobre `@google/genai` con:
 * - Privacidad por defecto (`store: false` para no retener facturas ni conversaciones sensibles externamente).
 * - Salida estructurada estricta (`response_format` JSON Schema) cuando se indica `jsonSchema`.
 * - Cascada resiliente entre modelos actuales (`gemini-3.8-flash` -> `gemini-3.5-flash-lite`).
 */
export async function runGeminiInteraction(options: RunGeminiInteractionOptions): Promise<string> {
  const client = getGenAIClient(options.client);
  const models = buildGeminiModelCascade(options.preferredModels);
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const interaction = await client.interactions.create({
        model,
        input: options.input as any,
        system_instruction: options.systemInstruction,
        store: false,
        response_format: options.jsonSchema
          ? {
              type: 'text',
              mime_type: 'application/json',
              schema: options.jsonSchema,
            }
          : undefined,
      });

      const text = extractInteractionOutputText(interaction);
      if (!text) {
        throw new Error(`El modelo ${model} devolvió una respuesta vacía.`);
      }
      return text;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[GenAI] Modelo ${model} falló o no estuvo disponible: ${err?.message || err}. Probando siguiente...`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo completar la interacción con Gemini AI.');
}
