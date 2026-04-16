"use client"

import { SVGProps, useId } from "react"

interface BlobProps extends SVGProps<SVGSVGElement> {
  color?: string
  size?: number
  circularity?: number
  wobbleAmount?: number
  wobbleSpeed?: number
  bobSpeed?: number
}

export function Blob({
  color = "#10b981",
  size = 200,
  circularity = 0.006,
  wobbleAmount = 47,
  wobbleSpeed = 8.5,
  bobSpeed = 2.2,
  ...props
}: BlobProps) {
  const filterId = useId().replace(/:/g, "")
  const noiseId = `${filterId}-noise`
  const bobAnimation = bobSpeed > 0 ? `bob ${bobSpeed}s ease-in-out infinite` : undefined

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation: bobAnimation,
      }}
      {...props}
    >
      <defs>
        <filter id={filterId}>
          <feTurbulence
            id={noiseId}
            type="fractalNoise"
            baseFrequency={circularity}
            numOctaves="3"
            result="noise"
            seed="2"
          >
            <animate
              attributeName="baseFrequency"
              dur={`${wobbleSpeed}s`}
              values={`${Math.max(0.001, circularity * 0.82)};${circularity};${Math.max(0.001, circularity * 1.18)};${circularity}`}
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={wobbleAmount}
            xChannelSelector="R"
            yChannelSelector="G"
          >
            <animate
              attributeName="scale"
              dur={`${wobbleSpeed * 0.75}s`}
              values={`${Math.max(1, wobbleAmount * 0.85)};${wobbleAmount};${Math.max(1, wobbleAmount * 1.15)};${wobbleAmount}`}
              repeatCount="indefinite"
            />
          </feDisplacementMap>
        </filter>
      </defs>

      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
      `}</style>

      <circle
        cx="100"
        cy="100"
        r="60"
        fill={color}
        filter={`url(#${filterId})`}
      />
    </svg>
  )
}
