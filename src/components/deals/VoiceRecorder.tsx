'use client'

import { useState, useRef } from 'react'

type Props = {
  onTranscript: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        await transcribe(blob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setRecording(true)
    } catch {
      alert('Could not access microphone')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.text) onTranscript(data.text)
    } catch {
      alert('Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      disabled={transcribing}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        recording
          ? 'bg-red-600 text-white hover:bg-red-700'
          : transcribing
            ? 'border border-border opacity-40 cursor-not-allowed'
            : 'border border-border text-foreground hover:bg-black/5'
      }`}
    >
      {recording ? 'Stop Recording' : transcribing ? 'Transcribing...' : 'Record Voice'}
    </button>
  )
}
