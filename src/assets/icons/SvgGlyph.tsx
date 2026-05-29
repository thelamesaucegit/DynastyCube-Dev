/**
 * Renders an SVG asset as a colored glyph via CSS masking, so the icon inherits
 * `currentColor` (or an explicit color) the same way a mana-font `<i>` does.
 * This lets us drop bundled keyword/counter SVGs into existing badges that
 * carry their own text color without altering the surrounding palette.
 */
export function SvgGlyph({
  url,
  size,
  color = 'currentColor',
}: {
  url: string
  size: number
  color?: string
}) {
  const maskUrl = `url("${url}")`
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}
