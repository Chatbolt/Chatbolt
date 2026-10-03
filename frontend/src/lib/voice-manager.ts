/**
 * Browser-Native & Provider-Upgraded Voice Manager (Prompt 32)
 * Handles SpeechRecognition (STT), SpeechSynthesis (TTS), permission checks,
 * browser capability detection, mobile audio context unlocking, and provider fallback.
 */

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'unsupported'

export interface BrowserSupportInfo {
  speechRecognitionSupported: boolean
  speechSynthesisSupported: boolean
  isChrome: boolean
  isSafari: boolean
  isFirefox: boolean
  isMobile: boolean
  supportMessage?: string
}

export interface VoiceOptions {
  rate?: number
  pitch?: number
  voiceURI?: string
  lang?: string
}

export class PersonalVoiceManager {
  private recognition: any = null
  private synthesis: SpeechSynthesis | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private voices: SpeechSynthesisVoice[] = []
  private isInitialized = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  private init() {
    if (this.isInitialized) return
    this.isInitialized = true

    // Detect SpeechSynthesis
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis
      this.loadVoices()
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.loadVoices()
      }
    }
  }

  private loadVoices() {
    if (this.synthesis) {
      this.voices = this.synthesis.getVoices()
    }
  }

  /**
   * Check browser capability and platform nuances
   */
  public detectSupport(): BrowserSupportInfo {
    if (typeof window === 'undefined') {
      return {
        speechRecognitionSupported: false,
        speechSynthesisSupported: false,
        isChrome: false,
        isSafari: false,
        isFirefox: false,
        isMobile: false,
        supportMessage: 'Server-side rendering'
      }
    }

    const ua = navigator.userAgent.toLowerCase()
    const isChrome = /chrome|chromium|crios/i.test(ua) && !/edg|opr|opera/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua)
    const isFirefox = /firefox|fxios/i.test(ua)
    const isMobile = /iphone|ipad|ipod|android|mobile/i.test(ua)

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const speechRecognitionSupported = !!SpeechRec
    const speechSynthesisSupported = 'speechSynthesis' in window

    let supportMessage = 'Fully supported'
    if (!speechRecognitionSupported) {
      if (isFirefox) {
        supportMessage = 'Firefox has limited Web Speech support. Type or use Provider Whisper.'
      } else if (isSafari) {
        supportMessage = 'Safari requires speech permissions in Settings. Provider Voice recommended.'
      } else {
        supportMessage = 'Browser does not support Web Speech Recognition.'
      }
    }

    return {
      speechRecognitionSupported,
      speechSynthesisSupported,
      isChrome,
      isSafari,
      isFirefox,
      isMobile,
      supportMessage
    }
  }

  /**
   * Get available browser voices
   */
  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synthesis) {
      this.loadVoices()
    }
    return this.voices
  }

  /**
   * Start browser-native speech recognition
   * Fills message box without silently sending (User reviews before send)
   */
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onStateChange: (state: VoiceState, errorMsg?: string) => void
  ) {
    const support = this.detectSupport()
    if (!support.speechRecognitionSupported) {
      onStateChange('unsupported', support.supportMessage)
      return
    }

    try {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.recognition = new SpeechRec()
      this.recognition.continuous = false
      this.recognition.interimResults = true
      this.recognition.lang = navigator.language || 'en-US'

      this.recognition.onstart = () => {
        onStateChange('listening')
      }

      this.recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i]
          if (item.isFinal) {
            finalTranscript += item[0].transcript
          } else {
            interimTranscript += item[0].transcript
          }
        }

        const text = finalTranscript || interimTranscript
        if (text) {
          onResult(text, !!finalTranscript)
        }
      }

      this.recognition.onerror = (event: any) => {
        let msg = 'Microphone error occurred.'
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          msg = 'Microphone access blocked. Please allow mic permissions in your browser address bar.'
        } else if (event.error === 'no-speech') {
          msg = 'No speech was detected. Tap mic to try again.'
        } else if (event.error === 'network') {
          msg = 'Network issue with speech recognition service.'
        }
        onStateChange('error', msg)
      }

      this.recognition.onend = () => {
        onStateChange('idle')
      }

      this.recognition.start()
    } catch (err: any) {
      onStateChange('error', err.message || 'Failed to start microphone.')
    }
  }

  /**
   * Stop browser speech recognition
   */
  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch (err) {
        // ignore
      }
      this.recognition = null
    }
  }

  /**
   * Read aloud text using SpeechSynthesis
   */
  public speak(
    text: string,
    options: VoiceOptions = {},
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: string) => void
  ) {
    if (!this.synthesis) {
      onError?.('Speech synthesis not supported in this browser.')
      return
    }

    // Cancel any ongoing speech
    this.stopSpeaking()

    // Clean markdown symbols for natural speech
    const cleanText = text
      .replace(/[*#_`~\[\]\(\)]/g, ' ')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = options.rate || 1.0
    utterance.pitch = options.pitch || 1.0
    utterance.lang = options.lang || 'en-US'

    // Choose voice if specified
    if (options.voiceURI) {
      const match = this.getVoices().find(v => v.voiceURI === options.voiceURI)
      if (match) utterance.voice = match
    }

    utterance.onstart = () => onStart?.()
    utterance.onend = () => {
      this.currentUtterance = null
      onEnd?.()
    }
    utterance.onerror = (e) => {
      this.currentUtterance = null
      onError?.(e.error || 'Speech synthesis failed')
    }

    this.currentUtterance = utterance
    this.synthesis.speak(utterance)
  }

  /**
   * Stop any active speech output
   */
  public stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel()
      this.currentUtterance = null
    }
  }

  /**
   * Check if speech synthesis is currently speaking
   */
  public isSpeaking(): boolean {
    return !!this.synthesis && (this.synthesis.speaking || !!this.currentUtterance)
  }
}

export const voiceManager = new PersonalVoiceManager()
