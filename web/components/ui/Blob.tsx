import { SVGProps } from "react"

interface BlobProps extends SVGProps<SVGSVGElement> {
  color?: string
  size?: number
  circularity?: number
  wobbleAmount?: number
  wobbleSpeed?: number
  bobSpeed?: number
  bobAmount?: number
}

export function Blob({
  color = "#10b981",
  size = 200,
  circularity = 0.004,
  wobbleAmount = 48,
  wobbleSpeed = 10,
  bobSpeed = 1.4,
  bobAmount = 15,
  ...props
}: BlobProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation: `bob ${bobSpeed}s ease-in-out infinite`,
      }}
      {...props}
    >
      <defs>
        <filter id="blobFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={circularity}
            numOctaves="3"
            result="noise"
            seed="2"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={wobbleAmount}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-${bobAmount}px); }
        }
      `}</style>

      <circle
        cx="100"
        cy="100"
        r="60"
        fill={color}
        filter="url(#blobFilter)"
        style={{
          animation: `wobble ${wobbleSpeed}s ease-in-out infinite`,
        }}
      />

      <style>{`
        @keyframes wobble {
          0% { filter: url(#blobFilter); }
          50% { filter: url(#blobFilter); }
          100% { filter: url(#blobFilter); }
        }
      `}</style>
    </svg>
  )
}
