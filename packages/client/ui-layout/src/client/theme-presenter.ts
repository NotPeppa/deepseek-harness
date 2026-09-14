/**
 * Global theme DOM applier: projects the resolved ThemeSnapshot onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), `body[data-ds-dark-theme]` for the token palette, the active
 * theme's alias-token overrides as inline CSS variables on body, the content
 * font-size axis (`--dsh-content-font-size`), and one presenter-owned
 * `meta[name="theme-color"]` for surrounding browser UI. Pure DOM writes, no
 * React involvement; the presenter only ever retracts what it wrote itself,
 * so foreign attributes, metadata, and inline styles survive.
 */
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Body attribute selecting the dark base palette in the token stylesheets. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/** Body variable carrying the user's content font size in px. */
export const CONTENT_FONT_SIZE_VARIABLE = '--dsh-content-font-size'

/** Body variables carrying the custom background image, blur radius, and opacity. */
export const BACKGROUND_IMAGE_VARIABLE = '--dsh-bg-image'
export const BACKGROUND_BLUR_VARIABLE = '--dsh-bg-blur'
export const BACKGROUND_OPACITY_VARIABLE = '--dsh-bg-opacity'

/**
 * Body variable letting wallpaper-permeable surfaces drop their opaque fill.
 * Surfaces read it as `var(--dsh-bg-surface, <their normal fill>)`, so it is
 * set only while a wallpaper is active and absent otherwise.
 */
export const BACKGROUND_SURFACE_VARIABLE = '--dsh-bg-surface'

/**
 * Body variable carrying how much of their own fill wallpaper-permeable panels
 * keep. Panels read it as the `color-mix` amount, so its absence (the no-
 * wallpaper case) resolves to 100% and leaves them exactly as designed. Panels
 * stay tinted rather than clear so their text keeps a readable ground.
 */
export const BACKGROUND_PANEL_ALPHA_VARIABLE = '--dsh-bg-panel-alpha'

/** Fill a permeable panel keeps while a wallpaper is showing through it. */
const PANEL_ALPHA = '55%'

/** Applies theme snapshots to the document; one instance per plugin fiber. */
export class ThemePresenter {
  /** Token names this presenter wrote in the last apply (its retraction set). */
  private appliedTokens: string[] = []
  /** The single metadata node this presenter inserts and removes. */
  private readonly themeColorMeta: HTMLMetaElement

  /** Create the presenter-owned metadata node before the first snapshot arrives. */
  constructor() {
    this.themeColorMeta = document.createElement('meta')
    this.themeColorMeta.name = 'theme-color'
  }

  /**
   * Project a snapshot onto the document: set root `color-scheme` and the body
   * palette attribute from `active.colorScheme` (never the id — `system` is
   * resolved upstream), publish the content font-size axis, then replace the
   * previously applied token variables with `active.tokens`. Browser
   * theme-color metadata follows the computed body background after those
   * writes, so the rendered palette remains the color authority.
   * @param snapshot - resolved theme snapshot from ctx.theme.
   */
  apply(snapshot: ThemeSnapshot): void {
    const scheme = snapshot.active.colorScheme
    document.documentElement.style.colorScheme = scheme
    const body = document.body
    if (scheme === 'dark') body.setAttribute(DARK_ATTRIBUTE, '')
    else body.removeAttribute(DARK_ATTRIBUTE)
    body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`)
    this.applyBackground(body, snapshot)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value)
      this.appliedTokens.push(name)
    }
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta)
  }

  /**
   * Publish the custom-background axis: the image (as a CSS `url()` or `none`),
   * blur radius, and opacity fraction. An empty image URL clears all three so
   * the AppFrame wallpaper layer collapses to nothing.
   */
  private applyBackground(body: HTMLElement, snapshot: ThemeSnapshot): void {
    if (snapshot.backgroundImage === '') {
      body.style.removeProperty(BACKGROUND_IMAGE_VARIABLE)
      body.style.removeProperty(BACKGROUND_BLUR_VARIABLE)
      body.style.removeProperty(BACKGROUND_OPACITY_VARIABLE)
      body.style.removeProperty(BACKGROUND_SURFACE_VARIABLE)
      body.style.removeProperty(BACKGROUND_PANEL_ALPHA_VARIABLE)
      return
    }
    body.style.setProperty(BACKGROUND_IMAGE_VARIABLE, `url("${cssUrl(snapshot.backgroundImage)}")`)
    body.style.setProperty(BACKGROUND_BLUR_VARIABLE, `${snapshot.backgroundBlur}px`)
    body.style.setProperty(BACKGROUND_OPACITY_VARIABLE, `${snapshot.backgroundOpacity / 100}`)
    // Let the permeable surfaces above the wallpaper stop painting over it.
    body.style.setProperty(BACKGROUND_SURFACE_VARIABLE, 'transparent')
    body.style.setProperty(BACKGROUND_PANEL_ALPHA_VARIABLE, PANEL_ALPHA)
  }

  /** Retract root color-scheme, the palette attribute, token variables, the font-size axis, and the owned metadata node. */
  dispose(): void {
    document.documentElement.style.removeProperty('color-scheme')
    const body = document.body
    body.removeAttribute(DARK_ATTRIBUTE)
    body.style.removeProperty(CONTENT_FONT_SIZE_VARIABLE)
    body.style.removeProperty(BACKGROUND_IMAGE_VARIABLE)
    body.style.removeProperty(BACKGROUND_BLUR_VARIABLE)
    body.style.removeProperty(BACKGROUND_OPACITY_VARIABLE)
    body.style.removeProperty(BACKGROUND_SURFACE_VARIABLE)
    body.style.removeProperty(BACKGROUND_PANEL_ALPHA_VARIABLE)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    this.themeColorMeta.remove()
  }
}

/**
 * Escape a user-supplied URL for safe interpolation inside `url("…")`: neutralise
 * the quote, backslash, and parenthesis that would otherwise break out of the
 * CSS string and let arbitrary declarations through.
 */
function cssUrl(url: string): string {
  return url.replace(/[\\"()]/g, char => `\\${char}`)
}
