import { useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Slider, SliderThumb, SliderTrack } from 'react-aria-components'
import { formatTime } from './formatTime'
import type { Section } from './VideoPlayer'

interface VideoTimelineProps {
  currentTime: number
  duration: number | null
  onSeek: (time: number) => void
  /** The A↔B section: tinted on the track, with a draggable marker at each end. */
  section?: Section | null
  /** A set on its own, before B: shown as a lone marker. */
  pendingStart?: number | null
  onSectionChange?: (section: Section) => void
}

/** Seek slider with the time under the pointer shown above it before clicking. */
export function VideoTimeline({
  currentTime,
  duration,
  onSeek,
  section = null,
  pendingStart = null,
  onSectionChange
}: VideoTimelineProps): JSX.Element {
  const { t } = useTranslation()
  const [hover, setHover] = useState<{ ratio: number } | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  function ratioAt(clientX: number): number | null {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return null
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }

  function trackHover(e: PointerEvent<HTMLDivElement>): void {
    const ratio = ratioAt(e.clientX)
    if (ratio !== null) setHover({ ratio })
  }

  const percent = (time: number): string => `${duration ? (time / duration) * 100 : 0}%`

  /**
   * A marker drags its own end of the section. Pointer capture keeps the drag
   * alive off the track, and stopPropagation keeps the slider from seeking.
   * Keyboard users set the ends with [ and ] instead (markers are hidden from
   * assistive tech, the section button names the state).
   */
  function dragMarker(edge: 'start' | 'end') {
    return (e: PointerEvent<HTMLSpanElement>): void => {
      if (!section || !duration || !onSectionChange) return
      e.stopPropagation()
      e.preventDefault()
      const marker = e.currentTarget
      marker.setPointerCapture(e.pointerId)
      const move = (ev: globalThis.PointerEvent): void => {
        const ratio = ratioAt(ev.clientX)
        if (ratio !== null) onSectionChange({ ...section, [edge]: ratio * duration })
      }
      const up = (): void => {
        marker.removeEventListener('pointermove', move)
        marker.removeEventListener('pointerup', up)
      }
      marker.addEventListener('pointermove', move)
      marker.addEventListener('pointerup', up)
    }
  }

  return (
    <Slider
      aria-label={t('videoPlayer.seek')}
      className="video-timeline"
      minValue={0}
      maxValue={duration ?? 1}
      step={0.01}
      value={duration === null ? 0 : Math.min(currentTime, duration)}
      onChange={(value) => onSeek(value as number)}
      isDisabled={duration === null}
    >
      <SliderTrack
        ref={trackRef}
        className="video-timeline-track"
        onPointerMove={trackHover}
        onPointerLeave={() => setHover(null)}
      >
        {({ state }) => (
          <>
            {section && duration !== null && (
              <span
                className="video-section-range"
                style={{
                  left: percent(section.start),
                  width: percent(section.end - section.start)
                }}
                aria-hidden="true"
              />
            )}
            <div
              className="video-timeline-fill"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            {section && duration !== null && (
              <>
                <span
                  className="video-section-marker"
                  style={{ left: percent(section.start) }}
                  onPointerDown={dragMarker('start')}
                  aria-hidden="true"
                />
                <span
                  className="video-section-marker"
                  style={{ left: percent(section.end) }}
                  onPointerDown={dragMarker('end')}
                  aria-hidden="true"
                />
              </>
            )}
            {!section && pendingStart !== null && duration !== null && (
              <span
                className="video-section-marker is-pending"
                style={{ left: percent(pendingStart) }}
                aria-hidden="true"
              />
            )}
            <SliderThumb className="video-timeline-thumb" />
            {hover && duration !== null && (
              <span
                className="video-timeline-hover"
                style={{ left: `${hover.ratio * 100}%` }}
                aria-hidden="true"
              >
                {formatTime(hover.ratio * duration)}
              </span>
            )}
          </>
        )}
      </SliderTrack>
    </Slider>
  )
}
