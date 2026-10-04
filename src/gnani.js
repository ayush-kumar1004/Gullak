/**
 * Gnani.ai Voice Rail Client
 * 
 * Supports Live Gnani API integration when GNANI_API_KEY is configured,
 * and clean unavailable / development parsing states when credentials are not configured.
 * 
 * Official Endpoints:
 * - STT: POST https://api.vachana.ai/stt/v3 (Header: X-API-Key-ID)
 * - TTS: POST https://api.vachana.ai/api/v1/tts/inference (Header: X-API-Key-ID)
 */

class GnaniVoiceRail {
  constructor() {
    this.apiKey = process.env.GNANI_API_KEY || null;
    this.sttUrl = 'https://api.vachana.ai/stt/v3';
    this.ttsUrl = 'https://api.vachana.ai/api/v1/tts/inference';
    this.timeoutMs = 5000;
  }

  getIntegrationStatus() {
    return {
      provider: 'Gnani.ai',
      is_live: !!this.apiKey,
      mode: this.apiKey ? 'LIVE_GNANI_PRODUCTION' : 'VOICE_SERVICE_NOT_CONFIGURED',
      stt_endpoint: this.sttUrl,
      tts_endpoint: this.ttsUrl,
      supported_models: ['timbre-v2.5'],
      language_codes: ['hi-IN', 'en-IN']
    };
  }

  /**
   * Speech-to-Text (STT): Transcribes audio clip to text
   * If live Gnani is unavailable, returns a clean error/unavailable state.
   * NEVER fabricates a hardcoded transaction.
   */
  async transcribeAudio(audioBuffer, languageCode = 'hi-IN', providedTranscript = null, mimeType = 'audio/wav') {
    if (this.apiKey && audioBuffer) {
      try {
        const formData = new FormData();
        const ext = mimeType.includes('webm') ? 'recording.webm' : 'recording.wav';
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append('audio_file', blob, ext);
        formData.append('language_code', languageCode);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(this.sttUrl, {
          method: 'POST',
          headers: {
            'X-API-Key-ID': this.apiKey
          },
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`Gnani STT API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const transcript = data.transcript || data.text || '';
        return {
          status: 'SUCCESS',
          mode: 'LIVE_GNANI_PRODUCTION',
          transcript,
          confidence: data.confidence !== undefined ? data.confidence : 0.95
        };
      } catch (err) {
        console.warn(`[Gnani Live STT Failed]: ${err.message}.`);
        return {
          status: 'ERROR',
          mode: 'LIVE_FAILED',
          error: 'STT_TRANSCRIBE_FAILED',
          message: `Live Gnani STT failed: ${err.message}`,
          transcript: null,
          confidence: 0
        };
      }
    }

    // If actual transcript text was passed into fallback, use it
    if (providedTranscript && typeof providedTranscript === 'string' && providedTranscript.trim()) {
      return {
        status: 'SUCCESS',
        mode: 'TRANSCRIPT_PASSED',
        transcript: providedTranscript.trim(),
        confidence: 0.95
      };
    }

    // Clean unavailable state - NEVER fabricate a transaction!
    return {
      status: 'UNAVAILABLE',
      mode: 'VOICE_SERVICE_UNAVAILABLE',
      error: 'GNANI_API_KEY_NOT_CONFIGURED',
      message: 'Gnani voice STT is currently unavailable (GNANI_API_KEY not configured). Please submit text clarification.',
      transcript: null,
      confidence: 0
    };
  }

  /**
   * Helper: Transcribes base64-encoded audio directly
   */
  async transcribeBase64Audio(base64Data, mimeType = 'audio/webm', language = 'hi-IN') {
    if (!base64Data || typeof base64Data !== 'string') {
      return {
        status: 'ERROR',
        error: 'INVALID_AUDIO_DATA',
        message: 'Valid base64 audio data is required.',
        transcript: null,
        confidence: 0
      };
    }

    try {
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const audioBuffer = Buffer.from(cleanBase64, 'base64');
      if (audioBuffer.length === 0) {
        return {
          status: 'ERROR',
          error: 'EMPTY_AUDIO_BUFFER',
          message: 'Decoded audio buffer is empty.',
          transcript: null,
          confidence: 0
        };
      }
      return await this.transcribeAudio(audioBuffer, language, null, mimeType);
    } catch (err) {
      return {
        status: 'ERROR',
        error: 'BASE64_DECODE_FAILED',
        message: `Failed to decode base64 audio: ${err.message}`,
        transcript: null,
        confidence: 0
      };
    }
  }

  /**
   * Text-to-Speech (TTS): Converts agent response into audio
   * If live Gnani is unavailable, returns a clean synthesis response with no fake URL.
   */
  async synthesizeSpeech(text, language = 'hi-IN') {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return {
        status: 'ERROR',
        error: 'INVALID_INPUT',
        message: 'Text is required for TTS synthesis.'
      };
    }

    if (this.apiKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(this.ttsUrl, {
          method: 'POST',
          headers: {
            'X-API-Key-ID': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            language,
            voice: 'timbre-v2.5',
            audio_config: { audio_format: 'wav' }
          }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`Gnani TTS Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          status: 'SUCCESS',
          mode: 'LIVE_GNANI_PRODUCTION',
          audio_url: data.audio_url || null,
          audio_base64: data.audio_base64 || null,
          voice: 'timbre-v2.5'
        };
      } catch (err) {
        console.warn(`[Gnani Live TTS Failed]: ${err.message}.`);
        return {
          status: 'ERROR',
          mode: 'LIVE_FAILED',
          error: 'TTS_SYNTHESIS_FAILED',
          message: `Live Gnani TTS failed: ${err.message}`,
          audio_url: null,
          audio_base64: null
        };
      }
    }

    // Clean fallback when live key not present - NO fake audio endpoints
    return {
      status: 'MOCK_SYNTHESIS',
      mode: 'DEVELOPMENT_MOCK',
      message: 'GNANI_API_KEY not configured; live audio generation is disabled.',
      text,
      language,
      voice: 'timbre-v2.5',
      audio_url: null,
      audio_base64: null,
      synthesized_at: new Date().toISOString()
    };
  }

  /**
   * Parses Hinglish / Indian speech into financial entities
   * Robust parser supporting arbitrary counterparty names, arbitrary numbers, and Hindi/English idioms.
   */
  parseHinglishTranscript(transcript) {
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return { intent: 'UNKNOWN', counterparty: null, amount: null, user_share: null, confidence: 0 };
    }
    const raw = transcript.trim();
    const text = raw.toLowerCase();

    let intent = 'UNKNOWN';
    let counterparty = null;
    let amount = null;
    let userShare = null;

    // 1. Detect Intent: REPAYMENT takes precedence when return/repay keywords are present
    if (/\b(wapas|lautaya|repaid|paid back|chuka diya|settled the loan|returned)\b/i.test(text) || text.includes('borrowed from me') || text.includes('udhaar liye the')) {
      intent = 'REPAYMENT';
    } else if (/\b(udhaar|loan|lent|lend|borrowed|borrow)\b/i.test(text)) {
      intent = 'LOAN';
    } else if (/\b(split|share|mera share|portion|contribute|pool|owes me)\b/i.test(text) || text.includes('dosto me') || text.includes('me split')) {
      intent = 'SPLIT';
    } else if (/\b(dinner|lunch|breakfast|food|meal|grocery|shopping|coffee|cafe|swiggy|zomato|party|cab|uber)\b/i.test(text)) {
      intent = 'CONSUMPTION';
    } else if (/\b(reimburse|reimbursement|claim)\b/i.test(text)) {
      intent = 'REIMBURSEMENT';
    } else if (/\b(transfer|bheje|sent|diye)\b/i.test(text)) {
      if (text.includes('udhaar') || text.includes('loan')) {
        intent = 'LOAN';
      } else {
        intent = 'TRANSFER';
      }
    }

    // 2. Extract Amount
    // Hindi spoken number idioms
    if (text.includes('pandrah sau') || text.includes('dedh hazaar') || text.includes('dedh hazar')) {
      amount = 1500;
    } else if (text.includes('barah sau')) {
      amount = 1200;
    } else if (text.includes('sau')) {
      const sauMatch = text.match(/\b(ek|do|teen|char|paanch|chhe|saat|aath|nau)\s+sau\b/);
      if (sauMatch) {
        const wordMap = { ek: 100, do: 200, teen: 300, char: 400, paanch: 500, chhe: 600, saat: 700, aath: 800, nau: 900 };
        amount = wordMap[sauMatch[1]];
      }
    }
    if (!amount) {
      if (text.includes('do hazaar') || text.includes('do hazar')) {
        amount = 2000;
      } else if (text.includes('dhai hazaar') || text.includes('dhai hazar')) {
        amount = 2500;
      } else if (text.includes('hazaar') || text.includes('hazar')) {
        const hazarMatch = text.match(/\b(ek|do|teen|char|paanch|das)\s+haz(?:aa)?r\b/);
        if (hazarMatch) {
          const map = { ek: 1000, do: 2000, teen: 3000, char: 4000, paanch: 5000, das: 10000 };
          amount = map[hazarMatch[1]];
        }
      }
    }
    // Regex for numeric amount e.g. "800", "₹1000", "500", "4000"
    if (!amount) {
      const match = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/);
      if (match && match[1]) {
        amount = parseFloat(match[1].replace(/,/g, ''));
      }
    }

    // 3. Extract Counterparty (arbitrary names: Neha, Aman, Priya, Rahul, etc.)
    const skipWords = new Set([
      'mera', 'meri', 'mere', 'mujhe', 'maine', 'usne', 'usko', 'unko', 'kisi', 'koi',
      'the', 'a', 'an', 'this', 'that', 'dinner', 'lunch', 'bill', 'loan', 'udhaar', 'share',
      'office', 'travel', 'food', 'party', 'split', 'payment', 'money', 'paise', 'rupaye',
      'dosto', 'friends', 'bhai', 'dost'
    ]);

    // Pattern 1: "<Word> ko"
    const koMatch = raw.match(/([A-Za-z]+)\s+ko\b/i);
    if (koMatch && !skipWords.has(koMatch[1].toLowerCase())) {
      counterparty = koMatch[1].charAt(0).toUpperCase() + koMatch[1].slice(1).toLowerCase();
    }

    // Pattern 2: "<Word> ne"
    if (!counterparty) {
      const neMatch = raw.match(/([A-Za-z]+)\s+ne\b/i);
      if (neMatch && !skipWords.has(neMatch[1].toLowerCase())) {
        counterparty = neMatch[1].charAt(0).toUpperCase() + neMatch[1].slice(1).toLowerCase();
      }
    }

    // Pattern 3: "<Word> se"
    if (!counterparty) {
      const seMatch = raw.match(/([A-Za-z]+)\s+se\b/i);
      if (seMatch && !skipWords.has(seMatch[1].toLowerCase())) {
        counterparty = seMatch[1].charAt(0).toUpperCase() + seMatch[1].slice(1).toLowerCase();
      }
    }

    // Pattern 4: "<Word> ke saath / ke sath"
    if (!counterparty) {
      const sathMatch = raw.match(/([A-Za-z]+)\s+ke\s+sa?ath\b/i);
      if (sathMatch && !skipWords.has(sathMatch[1].toLowerCase())) {
        counterparty = sathMatch[1].charAt(0).toUpperCase() + sathMatch[1].slice(1).toLowerCase();
      }
    }

    // Pattern 5: "<Word> repaid/paid/returned/sent"
    if (!counterparty) {
      const actionMatch = raw.match(/([A-Za-z]+)\s+(?:repaid|paid|returned|sent|lent|gave)\b/i);
      if (actionMatch && !skipWords.has(actionMatch[1].toLowerCase())) {
        counterparty = actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1).toLowerCase();
      }
    }

    // Pattern 6: "to/from <Word>"
    if (!counterparty) {
      const prepMatch = raw.match(/\b(?:to|from|for|with)\s+([A-Za-z]+)\b/i);
      if (prepMatch && !skipWords.has(prepMatch[1].toLowerCase())) {
        counterparty = prepMatch[1].charAt(0).toUpperCase() + prepMatch[1].slice(1).toLowerCase();
      }
    }

    // 4. Extract User Share (e.g. "mera share 500", "my share was 500")
    const shareMatch = text.match(/(?:mera share|my share|portion|share)[^\d]*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (shareMatch && shareMatch[1]) {
      userShare = parseFloat(shareMatch[1].replace(/,/g, ''));
      if (intent === 'UNKNOWN') intent = 'SPLIT';
    }

    return {
      raw_transcript: transcript,
      intent,
      counterparty,
      amount,
      user_share: userShare,
      confidence: (intent !== 'UNKNOWN' && amount) ? 0.95 : 0.50
    };
  }
}

module.exports = new GnaniVoiceRail();
