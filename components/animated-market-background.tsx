const threads = [
  "M50 720 Q200 590 350 540 Q500 490 650 520 Q800 550 950 460 Q1100 370 1200 340",
  "M80 730 Q250 620 400 570 Q550 520 700 550 Q850 580 1000 490 Q1150 400 1300 370",
  "M20 710 Q180 580 320 530 Q460 480 600 510 Q740 540 880 450 Q1020 360 1200 330",
  "M120 740 Q280 640 450 590 Q620 540 770 570 Q920 600 1070 510 Q1220 420 1350 390",
  "M60 725 Q220 600 380 550 Q540 500 680 530 Q820 560 960 470 Q1100 380 1280 350",
  "M150 735 Q300 660 480 610 Q660 560 800 590 Q940 620 1080 530 Q1220 440 1400 410",
  "M40 715 Q190 585 340 535 Q490 485 630 515 Q770 545 910 455 Q1050 365 1250 335",
  "M100 728 Q260 630 420 580 Q580 530 720 560 Q860 590 1000 500 Q1140 410 1320 380",
  "M30 722 Q170 595 310 545 Q450 495 590 525 Q730 555 870 465 Q1010 375 1180 345",
  "M90 732 Q240 625 390 575 Q540 525 680 555 Q820 585 960 495 Q1100 405 1300 375",
  "M70 727 Q210 605 360 555 Q510 505 650 535 Q790 565 930 475 Q1070 385 1260 355",
  "M110 738 Q270 645 430 595 Q590 545 730 575 Q870 605 1010 515 Q1150 425 1380 395",
  "M45 718 Q185 588 325 538 Q465 488 605 518 Q745 548 885 458 Q1025 368 1220 338",
  "M130 721 Q290 630 460 580 Q630 530 770 560 Q910 590 1050 500 Q1190 410 1350 380",
  "M25 713 Q165 583 305 533 Q445 483 585 513 Q725 543 865 453 Q1005 363 1200 333",
  "M85 719 Q235 605 385 555 Q535 505 675 535 Q815 565 955 475 Q1095 385 1320 355",
  "M50 720 Q180 660 320 620 Q460 580 600 600 Q740 620 880 560 Q1020 500 1200 340",
  "M50 720 Q200 680 350 640 Q500 600 650 620 Q800 640 950 580 Q1100 520 1200 340",
  "M50 720 Q160 670 280 630 Q400 590 540 610 Q680 630 820 570 Q960 510 1200 340",
  "M50 720 Q220 690 380 650 Q540 610 680 630 Q820 650 960 590 Q1100 530 1200 340",
]

export function AnimatedMarketBackground({ compact = false }: { compact?: boolean }) {
  return (
    <div className="cp-bg" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="pulseA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="30%" stopColor="rgba(251,146,60,1)" />
            <stop offset="70%" stopColor="rgba(249,115,22,0.8)" />
            <stop offset="100%" stopColor="rgba(249,115,22,0)" />
          </radialGradient>
          <radialGradient id="pulseB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="25%" stopColor="rgba(251,146,60,0.9)" />
            <stop offset="60%" stopColor="rgba(234,88,12,0.7)" />
            <stop offset="100%" stopColor="rgba(234,88,12,0)" />
          </radialGradient>
          <radialGradient id="heroTextBg" cx="30%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(249,115,22,0.15)" />
            <stop offset="40%" stopColor="rgba(251,146,60,0.08)" />
            <stop offset="80%" stopColor="rgba(234,88,12,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="threadA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,1)" />
            <stop offset="16%" stopColor="rgba(249,115,22,0.82)" />
            <stop offset="84%" stopColor="rgba(249,115,22,0.82)" />
            <stop offset="100%" stopColor="rgba(0,0,0,1)" />
          </linearGradient>
          <linearGradient id="threadB" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,1)" />
            <stop offset="12%" stopColor="rgba(251,146,60,0.68)" />
            <stop offset="88%" stopColor="rgba(251,146,60,0.68)" />
            <stop offset="100%" stopColor="rgba(0,0,0,1)" />
          </linearGradient>
          <filter id="heroBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feTurbulence baseFrequency="0.7" numOctaves="4" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
            <feComponentTransfer in="monoNoise" result="alphaAdjustedNoise">
              <feFuncA type="discrete" tableValues="0.03 0.06 0.09 0.12" />
            </feComponentTransfer>
            <feComposite in="blur" in2="alphaAdjustedNoise" operator="multiply" result="noisyBlur" />
            <feMerge>
              <feMergeNode in="noisyBlur" />
            </feMerge>
          </filter>
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="330" cy="345" rx="420" ry="215" fill="url(#heroTextBg)" filter="url(#heroBlur)" opacity={compact ? "0.35" : "0.62"} />
        <ellipse cx="385" cy="322" rx="560" ry="265" fill="url(#heroTextBg)" filter="url(#heroBlur)" opacity={compact ? "0.18" : "0.36"} />

        {threads.map((path, index) => {
          const id = `market-thread-${index}`
          const stroke = index % 2 === 0 ? "url(#threadA)" : "url(#threadB)"
          const pulse = index % 2 === 0 ? "url(#pulseA)" : "url(#pulseB)"
          const width = 0.35 + (index % 5) * 0.28
          const radius = 0.9 + (index % 4) * 0.58
          const duration = 4 + (index % 8) * 0.25

          return (
            <g key={id}>
              <path d={path} id={id} stroke={stroke} strokeWidth={width} fill="none" opacity={compact ? "0.4" : "0.74"} />
              <circle r={radius} fill={pulse} opacity="1" filter="url(#neonGlow)">
                <animateMotion dur={`${duration}s`} repeatCount="indefinite">
                  <mpath href={`#${id}`} />
                </animateMotion>
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
