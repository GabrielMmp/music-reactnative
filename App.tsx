import { useState, useEffect, useRef, useCallback } from "react"
import Entypo from "@expo/vector-icons/Entypo"
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from "react-native"
import { AudioContext, AudioBuffer, AudioBufferSourceNode } from "react-native-audio-api"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated"

interface Track {
  id: string
  title: string
  artist: string
  url: string
}

const SPOTIFY_GREEN = "#1DB954"
const SPOTIFY_BLACK = "#191414"
const SPOTIFY_LIGHT_GRAY = "#B3B3B3"
const SPOTIFY_WHITE = "#FFFFFF"
const SPOTIFY_CARD = "#242424"

const TRACKS: Track[] = [
  { id: "1", title: "Música 1", artist: "Artista 1", url: "https://.../musica-01.mp3" },
  { id: "2", title: "Música 2", artist: "Artista 2", url: "https://.../musica-02.mp3" },
  { id: "3", title: "Música 3", artist: "Artista 3", url: "https://.../musica-03.mp3" },
  { id: "4", title: "Música 4", artist: "Artista 4", url: "https://.../musica-04.mp3" },
  { id: "5", title: "Música 5", artist: "Artista 5", url: "https://.../musica-05.mp3" },
  { id: "6", title: "Música 6", artist: "Artista 6", url: "https://.../musica-06.mp3" },
  { id: "7", title: "Música 7", artist: "Artista 7", url: "https://.../musica-07.mp3" },
  { id: "8", title: "Música 8", artist: "Artista 8", url: "https://.../musica-08.mp3" },
  { id: "9", title: "Música 9", artist: "Artista 9", url: "https://.../musica-09.mp3" },
  { id: "10", title: "Música 10", artist: "Artista 10", url: "https://.../musica-10.mp3" },
]


const formatTime = (timeInSeconds: number): string => {
  const safe = Math.max(0, Math.floor(timeInSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}

export default function App() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const progress = useSharedValue(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const durationRef = useRef(0)
  const startContextTimeRef = useRef(0)
  const pausedOffsetRef = useRef(0)
  const isManualStopRef = useRef(false)

  const currentTrack = TRACKS[currentTrackIndex]

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  const progressBarAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const stopCurrentSource = useCallback((resetOffset = false) => {
    isManualStopRef.current = true
    stopAnimationLoop()

    try {
      bufferSourceRef.current?.stop()
    } catch {
      // Ignora se já estiver parado
    }
    bufferSourceRef.current?.disconnect()
    bufferSourceRef.current = null

    if (resetOffset) {
      pausedOffsetRef.current = 0
      startContextTimeRef.current = 0
    }
  }, [stopAnimationLoop])

  const updateProgress = useCallback(
    (elapsedTime: number) => {
      const total = durationRef.current
      const clamped = total > 0 ? Math.min(Math.max(elapsedTime, 0), total) : 0
      setCurrentTime(clamped)
      progress.value = withTiming(total > 0 ? clamped / total : 0, {
        duration: 100,
      })
    },
    [progress]
  )

  const tickProgress = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return

    const elapsedSinceStart = Math.max(0, ctx.currentTime - startContextTimeRef.current)
    updateProgress(pausedOffsetRef.current + elapsedSinceStart)

    animationFrameRef.current = requestAnimationFrame(tickProgress)
  }, [updateProgress])

  const startPlayback = useCallback(
    async (offsetSeconds = 0) => {
      const ctx = audioContextRef.current
      const buffer = audioBufferRef.current
      if (!ctx || !buffer) return

      if (ctx.state === "suspended") {
        await ctx.resume()
      }

      stopCurrentSource(false)

      const safeOffset =
        offsetSeconds >= buffer.duration ? 0 : Math.max(0, offsetSeconds)
      pausedOffsetRef.current = safeOffset

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)

      isManualStopRef.current = false
      startContextTimeRef.current = ctx.currentTime

      source.onended = () => {
        if (isManualStopRef.current) {
          isManualStopRef.current = false
          return
        }
        stopAnimationLoop()
        pausedOffsetRef.current = 0
        startContextTimeRef.current = 0
        setIsPlaying(false)
        updateProgress(0)
      }

      bufferSourceRef.current = source
      setIsPlaying(true)
      source.start(0, safeOffset)

      stopAnimationLoop()
      animationFrameRef.current = requestAnimationFrame(tickProgress)
    },
    [stopCurrentSource, stopAnimationLoop, tickProgress, updateProgress]
  )

  const handlePlayPause = async () => {
    const ctx = audioContextRef.current
    const buffer = audioBufferRef.current
    if (!ctx || !buffer) return

    if (isPlaying) {
      const elapsedSinceStart = Math.max(0, ctx.currentTime - startContextTimeRef.current)
      pausedOffsetRef.current = Math.min(
        pausedOffsetRef.current + elapsedSinceStart,
        buffer.duration
      )
      stopCurrentSource(false)
      updateProgress(pausedOffsetRef.current)
      setIsPlaying(false)
      return
    }

    await startPlayback(pausedOffsetRef.current)
  }

  const handleSelectTrack = (index: number) => {
    if (index < 0 || index >= TRACKS.length) return
    if (index === currentTrackIndex) {
      handlePlayPause()
      return
    }
    setCurrentTrackIndex(index)
  }

  const handlePrevTrack = () => {
    const prevIndex =
      currentTrackIndex === 0 ? TRACKS.length - 1 : currentTrackIndex - 1
    setCurrentTrackIndex(prevIndex)
  }

  const handleNextTrack = () => {
    const nextIndex =
      currentTrackIndex === TRACKS.length - 1 ? 0 : currentTrackIndex + 1
    setCurrentTrackIndex(nextIndex)
  }

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    return () => {
      stopCurrentSource(true)
      audioContextRef.current?.close()
    }
  }, [stopCurrentSource])

  useEffect(() => {
    let isMounted = true
    const wasPlaying = isPlaying

    const loadTrack = async () => {
      const ctx = audioContextRef.current
      if (!ctx) return

      stopCurrentSource(true)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      progress.value = 0
      audioBufferRef.current = null
      setIsLoading(true)

      try {
        const response = await fetch(currentTrack.url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer)

        if (!isMounted) return

        audioBufferRef.current = decodedBuffer
        setDuration(decodedBuffer.duration)

        if (wasPlaying) {
          await startPlayback(0)
        }
      } catch (error) {
        console.error("Erro ao carregar música:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadTrack()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.songTitle}>{currentTrack.title}</Text>
        <Text style={styles.artistName}>{currentTrack.artist}</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.timeIndicator}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[styles.progressBar, progressBarAnimatedStyle]}
          />
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handlePrevTrack}
          activeOpacity={0.8}
        >
          <Entypo name="controller-jump-to-start" size={24} color={SPOTIFY_WHITE} />
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.playButton}>
            <ActivityIndicator color={SPOTIFY_BLACK} size="small" />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            disabled={!audioBufferRef.current}
            activeOpacity={0.8}
          >
            <Entypo
              name={isPlaying ? "controller-paus" : "controller-play"}
              size={26}
              color={SPOTIFY_BLACK}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleNextTrack}
          activeOpacity={0.8}
        >
          <Entypo name="controller-next" size={24} color={SPOTIFY_WHITE} />
        </TouchableOpacity>
      </View>

      <View style={styles.playlistContainer}>
        <Text style={styles.playlistTitle}>Músicas</Text>
        <FlatList
          data={TRACKS}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isSelected = index === currentTrackIndex
            return (
              <TouchableOpacity
                style={[styles.trackItem, isSelected && styles.trackItemActive]}
                onPress={() => handleSelectTrack(index)}
                activeOpacity={0.8}
              >
                <View>
                  <Text
                    style={[
                      styles.trackTitle,
                      isSelected && styles.trackTitleActive,
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.trackArtist}>{item.artist}</Text>
                </View>
                {isSelected && isPlaying && (
                  <Entypo name="sound" size={18} color={SPOTIFY_GREEN} />
                )}
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPOTIFY_BLACK,
  },
  headerContainer: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  songTitle: {
    color: SPOTIFY_WHITE,
    fontSize: 22,
    fontWeight: "bold",
  },
  artistName: {
    color: SPOTIFY_LIGHT_GRAY,
    fontSize: 15,
    marginTop: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: `${SPOTIFY_LIGHT_GRAY}40`,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: 4,
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 2,
  },
  timeIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timeText: {
    color: SPOTIFY_LIGHT_GRAY,
    fontSize: 12,
  },
  controlsContainer: {
    flexDirection: "row",
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
  },
  skipButton: {
    padding: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SPOTIFY_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  playlistTitle: {
    color: SPOTIFY_WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  trackItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: SPOTIFY_CARD,
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  trackItemActive: {
    borderWidth: 1,
    borderColor: SPOTIFY_GREEN,
  },
  trackTitle: {
    color: SPOTIFY_WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  trackTitleActive: {
    color: SPOTIFY_GREEN,
  },
  trackArtist: {
    color: SPOTIFY_LIGHT_GRAY,
    fontSize: 13,
    marginTop: 2,
  },
})