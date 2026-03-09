'use client'

import { useState, useRef } from 'react'

type Props = {
  onTranscript: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    let transcript = ''

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' '
        }
      }
    }

    recognition.onend = () => {
      setRecording(false)
      if (transcript.trim()) {
        onTranscript(transcript.trim())
      }
    }

    recognition.onerror = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={`px-4 py-2 rounded-md text-sm ${
        recording
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'border hover:bg-gray-50'
      }`}
    >
      {recording ? 'Stop Recording' : 'Record Voice'}
    </button>
  )
}
