import { useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Slider, SliderThumb, SliderTrack } from 'react-aria-components'
import { formatTime } from './formatTime'

interface VideoTimelineProps {
  currentTime: number
  duration: number | null
  onSeek: (time: number) => void
}

/** Seek slider with the time under the pointer shown above it before clicking. */
export function VideoTimeline({ currentTime, duration, onSeek }: VideoTimelineProps): JSX.Element {
  const { t } = useTranslation()
  const [hover, setHover] = useState<{ ratio: number } | null>(null)

  function trackHover(e: PointerEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    setHover({ ratio: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) })
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
        className="video-timeline-track"
        onPointerMove={trackHover}
        onPointerLeave={() => setHover(null)}
      >
        {({ state }) => (
          <>
            <div
              className="video-timeline-fill"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
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
