export const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
export const btnSecondary =
  "min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

export type Persona = {
  id: string;
  name: string;
  description: string;
  relationship: string | null;
  voiceProfile: string | null;
  voiceDistilledAt: string | null;
  voiceSampleChars: number;
};

export const VOICE_MIN = 200;
export const VOICE_MAX = 20000;

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
    if (data?.error) return JSON.stringify(data.error);
  } catch {
    // ignore
  }
  return fallback;
}
