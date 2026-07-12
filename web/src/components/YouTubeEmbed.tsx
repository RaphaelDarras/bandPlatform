// YouTube iframe embed (WEB-02). Uses youtube-nocookie.com (Pitfall 6) —
// no third-party cookies set until the visitor presses play. Lazy-loaded.
export default function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
      width="560"
      height="315"
      className="aspect-video h-auto w-[60%]"
      frameBorder={0}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
      title="YouTube video player"
    />
  )
}
