import { useT } from '../i18n'

/**
 * TeaserVideo — silent, auto-looping hero showcase.
 *
 * The source clip has no audio track, so it plays muted on a loop with no
 * sound controls. `muted` + `playsInline` are required for autoplay under
 * browser policies. `preload="metadata"` keeps the initial page light; the
 * poster renders instantly while the loop warms up.
 */
export default function TeaserVideo(): React.JSX.Element {
  const { t } = useT()

  return (
    <section className="w-full max-w-3xl mx-auto px-4 mt-4">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
        {t('home.teaser.title')}
      </p>
      <div className="rounded-2xl overflow-hidden border border-border bg-text shadow-xl shadow-primary/5">
        <video
          className="w-full aspect-video object-cover"
          src="/concourse-teaser.mp4"
          poster="/concourse-teaser-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={t('home.teaser.title')}
        />
      </div>
    </section>
  )
}
