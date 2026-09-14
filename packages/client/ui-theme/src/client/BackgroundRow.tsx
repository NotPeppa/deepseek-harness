/**
 * Custom-background preference row registered into the General section item
 * slot: an image-URL field plus blur and opacity sliders. Registered by this
 * package — the theme feature owns appearance settings. The displayed values
 * follow the persisted setting, never the local input echo.
 */
import type { ChangeEvent } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  BACKGROUND_BLUR_MAX, BACKGROUND_BLUR_MIN,
  BACKGROUND_OPACITY_MAX, BACKGROUND_OPACITY_MIN, BACKGROUND_ROUTE,
} from '../theme-settings.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createBackgroundRowStore } from './settings-store.ts'
import css from './BackgroundRow.module.css'

/** Injected business face: the background writes (t rides the standard locale seat). */
export interface BackgroundRowInjected {
  /** Set the background image URL (empty disables the custom background). */
  setBackgroundImage: (url: string) => void
  /** Set the background blur radius (integer px within the schema bounds). */
  setBackgroundBlur: (px: number) => void
  /** Set the background opacity (integer percent within the schema bounds). */
  setBackgroundOpacity: (percent: number) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type BackgroundRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createBackgroundRowStore>>
  & PropsLocale<'settings.theme'> & BackgroundRowInjected

/**
 * Longest edge kept for a picked wallpaper. This is a display bound, not a
 * storage one: the image is stored as a Host file and served over HTTP, so the
 * only ceiling is the route's upload cap. 4K covers the widest desktop the
 * wallpaper is stretched across; below that the browser upscales and the
 * picture goes soft.
 */
const MAX_IMAGE_EDGE = 3840

/**
 * JPEG quality for the re-encoded wallpaper. High, because a wallpaper is
 * looked at all day and a 4K frame at this quality still lands far under the
 * route's cap. The re-encode itself is not optional — it is what makes the
 * stored bytes match the declared type, which a picked file may not.
 */
const IMAGE_QUALITY = 0.92

/**
 * Decode a picked image, downscale it to {@link MAX_IMAGE_EDGE}, and re-encode
 * it as a bounded JPEG.
 * @param file - the user's picked image file.
 * @returns the encoded JPEG blob to store.
 */
async function downscaleToJpeg(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => { resolve() }
      image.onerror = () => { reject(new Error('image decode failed')) }
      image.src = src
    })
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('canvas 2d context unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY)
    })
    if (blob === null) throw new Error('image encode failed')
    return blob
  } finally {
    URL.revokeObjectURL(src)
  }
}

/**
 * Upload the encoded wallpaper to the Host and return the settings value that
 * addresses it. The bytes live in a Host file, so the settings document only
 * ever carries this short versioned route — a bulk image inlined there would
 * be re-read and re-written on every unrelated settings change.
 * @param blob - the re-encoded JPEG to store.
 * @returns the versioned route to persist as the background value.
 */
async function uploadBackground(blob: Blob): Promise<string> {
  const response = await fetch(BACKGROUND_ROUTE, { method: 'POST', body: blob })
  if (!response.ok) throw new Error(`background upload failed: ${String(response.status)}`)
  // The stored file keeps one path, so the version query is what makes a
  // replacement a different URL and defeats the immutable cache entry.
  return `${BACKGROUND_ROUTE}?v=${String(Date.now())}`
}

/**
 * Render the custom-background row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function BackgroundRow({
  t, useStore, setBackgroundImage, setBackgroundBlur, setBackgroundOpacity,
}: BackgroundRowComponentProps) {
  const image = useStore(s => s.image)
  const blur = useStore(s => s.blur)
  const opacity = useStore(s => s.opacity)
  // A local pick is stored as the Host route (older settings may still hold an
  // inline data: URL); neither belongs in the URL field, so a badge with a
  // clear action stands in for it.
  const isLocal = image.startsWith(BACKGROUND_ROUTE) || image.startsWith('data:')
  const pickFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = '' // let the same file be re-picked after a clear
    if (file === undefined) return
    void downscaleToJpeg(file).then(uploadBackground).then(setBackgroundImage, () => {
      // A file the decoder or the Host rejects leaves the background untouched.
    })
  }
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('background.title')}</div>
        <div className={css.desc}>{t('background.description')}</div>
      </div>
      <div className={css.control}>
        <div className={css.source}>
          {isLocal
            ? (
              <span className={css.localBadge}>
                {t('background.localImage')}
                <button type="button" className={css.clear} onClick={() => { setBackgroundImage('') }}>
                  {t('background.clear')}
                </button>
              </span>
            )
            : (
              <input
                type="text"
                className={css.url}
                value={image}
                placeholder={t('background.imagePlaceholder')}
                onChange={(e) => { setBackgroundImage(e.currentTarget.value) }}
              />
            )}
          <label className={css.choose}>
            {t('background.choose')}
            <input type="file" accept="image/*" hidden onChange={pickFile} />
          </label>
        </div>
        <label className={css.slider}>
          <span className={css.sliderLabel}>{t('background.blur')}</span>
          <input
            type="range"
            min={BACKGROUND_BLUR_MIN}
            max={BACKGROUND_BLUR_MAX}
            step={1}
            value={blur}
            onChange={(e) => { setBackgroundBlur(e.currentTarget.valueAsNumber) }}
          />
          <span className={css.sliderValue}>{blur}px</span>
        </label>
        <label className={css.slider}>
          <span className={css.sliderLabel}>{t('background.opacity')}</span>
          <input
            type="range"
            min={BACKGROUND_OPACITY_MIN}
            max={BACKGROUND_OPACITY_MAX}
            step={1}
            value={opacity}
            onChange={(e) => { setBackgroundOpacity(e.currentTarget.valueAsNumber) }}
          />
          <span className={css.sliderValue}>{opacity}%</span>
        </label>
      </div>
    </div>
  )
}
